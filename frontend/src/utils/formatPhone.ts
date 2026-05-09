export const PHONE_PREFIX = '+57';

export const getPhoneDigits = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  const clean = digits.startsWith('57') ? digits.slice(2) : digits;

  return clean.slice(0, 10);
};

export const formatNationalPhone = (value: string): string => {
  const limited = getPhoneDigits(value);
  const part1 = limited.slice(0, 3);
  const part2 = limited.slice(3, 6);
  const part3 = limited.slice(6, 10);

  return [part1, part2, part3].filter(Boolean).join(' ');
};

export const formatPhone = (value: string): string => {
  const limited = getPhoneDigits(value);

  const part1 = limited.slice(0, 3);
  const part2 = limited.slice(3, 6);
  const part3 = limited.slice(6, 10);

  let formatted = PHONE_PREFIX;

  if (part1) formatted += ` ${part1}`;
  if (part2) formatted += ` ${part2}`;
  if (part3) formatted += ` ${part3}`;

  return formatted;
};

export const isValidPhone = (phone: string, optional = false): boolean => {
  const nationalDigits = getPhoneDigits(phone);
  if (!nationalDigits) return optional;

  const digits = formatPhone(phone).replace(/\D/g, '');
  return digits.length === 12 && nationalDigits.startsWith('3');
};
