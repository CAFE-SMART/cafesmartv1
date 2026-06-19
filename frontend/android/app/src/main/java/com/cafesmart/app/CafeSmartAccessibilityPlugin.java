package com.cafesmart.app;

import android.Manifest;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.View;
import android.view.accessibility.AccessibilityManager;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "CafeSmartAccessibility")
public class CafeSmartAccessibilityPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        AccessibilityManager manager =
            (AccessibilityManager) getContext().getSystemService(Context.ACCESSIBILITY_SERVICE);

        boolean enabled = manager != null && manager.isEnabled();
        boolean touchExplorationEnabled =
            manager != null && manager.isTouchExplorationEnabled();
        boolean spokenFeedbackEnabled = false;
        JSArray activeServices = new JSArray();

        if (manager != null) {
            List<AccessibilityServiceInfo> services =
                manager.getEnabledAccessibilityServiceList(
                    AccessibilityServiceInfo.FEEDBACK_SPOKEN
                );
            spokenFeedbackEnabled = services != null && !services.isEmpty();

            if (services != null) {
                for (AccessibilityServiceInfo service : services) {
                    CharSequence label = service.getResolveInfo().loadLabel(
                        getContext().getPackageManager()
                    );
                    activeServices.put(label != null ? label.toString() : service.getId());
                }
            }
        }

        JSObject result = new JSObject();
        result.put("enabled", enabled);
        result.put("touchExplorationEnabled", touchExplorationEnabled);
        result.put("spokenFeedbackEnabled", spokenFeedbackEnabled);
        result.put("activeServices", activeServices);
        call.resolve(result);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("No pudimos abrir los ajustes de accesibilidad.", error);
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("No pudimos abrir los ajustes de Café Smart.", error);
        }
    }

    @PluginMethod
    public void getPermissionStatuses(PluginCall call) {
        JSObject result = new JSObject();
        result.put("camera", permissionStatus(Manifest.permission.CAMERA));
        result.put("photos", photosPermissionStatus());
        result.put("notifications", notificationsPermissionStatus());
        call.resolve(result);
    }

    @PluginMethod
    public void announce(PluginCall call) {
        String message = call.getString("message", "");
        if (message == null || message.trim().isEmpty()) {
            call.resolve();
            return;
        }

        try {
            View rootView = getActivity().getWindow().getDecorView();
            rootView.announceForAccessibility(message);
            call.resolve();
        } catch (Exception error) {
            call.reject("No pudimos anunciar el mensaje al lector de pantalla.", error);
        }
    }

    private JSObject permissionStatus(String permission) {
        JSObject status = new JSObject();
        boolean granted =
            ContextCompat.checkSelfPermission(getContext(), permission) ==
            PackageManager.PERMISSION_GRANTED;

        status.put("state", granted ? "granted" : "denied");
        status.put("canAskAgain", canAskAgain(permission));
        return status;
    }

    private JSObject notificationsPermissionStatus() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            JSObject status = new JSObject();
            status.put("state", "granted");
            status.put("canAskAgain", false);
            return status;
        }

        return permissionStatus(Manifest.permission.POST_NOTIFICATIONS);
    }

    private JSObject photosPermissionStatus() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            boolean fullAccess =
                ContextCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.READ_MEDIA_IMAGES
                ) == PackageManager.PERMISSION_GRANTED;
            boolean selectedAccess =
                ContextCompat.checkSelfPermission(
                    getContext(),
                    Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
                ) == PackageManager.PERMISSION_GRANTED;

            JSObject status = new JSObject();
            status.put(
                "state",
                fullAccess ? "granted" : selectedAccess ? "limited" : "denied"
            );
            status.put(
                "canAskAgain",
                canAskAgain(Manifest.permission.READ_MEDIA_IMAGES) ||
                canAskAgain(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)
            );
            return status;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return permissionStatus(Manifest.permission.READ_MEDIA_IMAGES);
        }

        return permissionStatus(Manifest.permission.READ_EXTERNAL_STORAGE);
    }

    private boolean canAskAgain(String permission) {
        if (getActivity() == null) {
            return false;
        }

        return ActivityCompat.shouldShowRequestPermissionRationale(
            getActivity(),
            permission
        );
    }
}
