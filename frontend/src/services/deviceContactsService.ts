import { Capacitor, registerPlugin } from '@capacitor/core';
import { formatPhoneNumber } from '../utils/personValidation';

export type DeviceContactPhone = {
  label?: string;
  number: string;
};

export type DeviceContact = {
  cancelled?: boolean;
  name?: string;
  phones?: DeviceContactPhone[];
  emails?: string[];
};

type ImportedPhoneResult = {
  raw: string;
  normalized: string;
  formatted: string;
  isColombianMobile: boolean;
};

const CafeSmartContacts = registerPlugin<{
  pickContact: () => Promise<DeviceContact>;
}>('CafeSmartContacts');

export function canImportDeviceContacts() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function pickDeviceContact() {
  if (!canImportDeviceContacts()) {
    return {
      cancelled: true,
      unavailable: true,
    } as DeviceContact & { unavailable: boolean };
  }

  return CafeSmartContacts.pickContact();
}

export function normalizeImportedContactPhone(raw: string): ImportedPhoneResult {
  const withoutExtension = raw
    .replace(/(?:ext\.?|x|#)\s*\d+$/i, '')
    .trim();
  let compact = withoutExtension.replace(/[()\s.-]/g, '');

  if (compact.startsWith('0057')) compact = compact.slice(2);
  if (compact.startsWith('+57')) compact = compact.slice(3);
  if (compact.startsWith('57') && compact.length === 12) compact = compact.slice(2);

  const digits = compact.replace(/\D/g, '');
  const isColombianMobile = /^3\d{9}$/.test(digits);

  return {
    raw,
    normalized: digits,
    formatted: isColombianMobile ? formatPhoneNumber(digits) : digits,
    isColombianMobile,
  };
}

export function getPrimaryEmail(contact: DeviceContact) {
  return contact.emails?.find((email) => email.trim())?.trim() ?? '';
}
