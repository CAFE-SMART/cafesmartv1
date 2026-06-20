package com.cafesmart.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "CafeSmartContacts")
public class CafeSmartContactsPlugin extends Plugin {
    @PluginMethod
    public void pickContact(PluginCall call) {
        try {
            Intent intent = new Intent(
                Intent.ACTION_PICK,
                ContactsContract.Contacts.CONTENT_URI
            );
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(call, intent, "contactPicked");
        } catch (Exception error) {
            call.reject("No pudimos abrir el selector de contactos.", error);
        }
    }

    @ActivityCallback
    private void contactPicked(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri contactUri = result.getData().getData();
        if (contactUri == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        try {
            JSObject contact = readSelectedContact(contactUri);
            contact.put("cancelled", false);
            call.resolve(contact);
        } catch (SecurityException error) {
            call.reject("CONTACTS_PERMISSION_REQUIRED", "No pudimos leer el contacto seleccionado.", error);
        } catch (Exception error) {
            call.reject("CONTACT_PICK_FAILED", "No pudimos importar el contacto seleccionado.", error);
        }
    }

    private JSObject readSelectedContact(Uri contactUri) {
        JSObject result = new JSObject();
        JSArray phones = new JSArray();
        JSArray emails = new JSArray();

        String contactId = null;
        String displayName = "";
        boolean hasPhones = false;

        String[] projection = new String[] {
            ContactsContract.Contacts._ID,
            ContactsContract.Contacts.DISPLAY_NAME,
            ContactsContract.Contacts.HAS_PHONE_NUMBER
        };

        try (Cursor cursor = getContext().getContentResolver().query(
            contactUri,
            projection,
            null,
            null,
            null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                contactId = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Contacts._ID));
                displayName = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Contacts.DISPLAY_NAME));
                String hasPhoneValue = cursor.getString(cursor.getColumnIndexOrThrow(ContactsContract.Contacts.HAS_PHONE_NUMBER));
                hasPhones = "1".equals(hasPhoneValue);
            }
        }

        if (contactId != null && hasPhones) {
            try (Cursor phoneCursor = getContext().getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                null,
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?",
                new String[] { contactId },
                null
            )) {
                if (phoneCursor != null) {
                    while (phoneCursor.moveToNext()) {
                        String number = phoneCursor.getString(
                            phoneCursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)
                        );
                        String label = phoneCursor.getString(
                            phoneCursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.LABEL)
                        );
                        int type = phoneCursor.getInt(
                            phoneCursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.TYPE)
                        );
                        CharSequence typeLabel = ContactsContract.CommonDataKinds.Phone.getTypeLabel(
                            getContext().getResources(),
                            type,
                            label
                        );

                        JSObject phone = new JSObject();
                        phone.put("number", number);
                        phone.put("label", typeLabel != null ? typeLabel.toString() : "Telefono");
                        phones.put(phone);
                    }
                }
            }
        }

        if (contactId != null) {
            try (Cursor emailCursor = getContext().getContentResolver().query(
                ContactsContract.CommonDataKinds.Email.CONTENT_URI,
                null,
                ContactsContract.CommonDataKinds.Email.CONTACT_ID + " = ?",
                new String[] { contactId },
                null
            )) {
                if (emailCursor != null) {
                    while (emailCursor.moveToNext()) {
                        String email = emailCursor.getString(
                            emailCursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Email.ADDRESS)
                        );
                        if (email != null && !email.trim().isEmpty()) {
                            emails.put(email.trim());
                        }
                    }
                }
            }
        }

        result.put("name", displayName != null ? displayName : "");
        result.put("phones", phones);
        result.put("emails", emails);
        return result;
    }
}
