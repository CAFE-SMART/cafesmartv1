import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const PHONE_PREFIX = '+57';

export const getPhoneDigits = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.slice(0, 15);
};

export const formatNationalPhone = (value: string): string => {
  const limited = getPhoneDigits(value);
  const part1 = limited.slice(0, 3);
  const part2 = limited.slice(3, 6);
  const part3 = limited.slice(6, 10);

  return [part1, part2, part3].filter(Boolean).join(' ');
};

export const formatPhone = (value: string): string => {
  const parsed = parsePhoneNumberFromString(value, 'CO');
  if (parsed?.isValid()) {
    return parsed.formatInternational();
  }

  const raw = value.trim();
  const limited = getPhoneDigits(value);
  const prefix = raw.startsWith('+') ? '+' : '';

  const part1 = limited.slice(0, 3);
  const part2 = limited.slice(3, 6);
  const part3 = limited.slice(6, 10);
  const part4 = limited.slice(10, 15);

  let formatted = prefix;

  if (part1) formatted += ` ${part1}`;
  if (part2) formatted += ` ${part2}`;
  if (part3) formatted += ` ${part3}`;
  if (part4) formatted += ` ${part4}`;

  return formatted.trim() || PHONE_PREFIX;
};

export const isValidPhone = (phone: string, optional = false): boolean => {
  if (!phone.trim()) return optional;
  const parsed = parsePhoneNumberFromString(phone, 'CO');
  return parsed?.isValid() ?? false;
};
