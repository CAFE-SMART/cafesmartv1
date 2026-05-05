import React from 'react';
import { formatPhone, getPhoneDigits, isValidPhone } from '../utils/formatPhone';

type FormattedPhoneInputProps = {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
  error?: string | null;
  hint?: string;
  className?: string;
  inputClassName?: string;
};

export { formatPhone, getPhoneDigits, isValidPhone as isValidColombianPhone };

export function FormattedPhoneInput({
  id,
  label = 'Telefono',
  value,
  onChange,
  optional = false,
  error,
  hint = 'Escribe solo el numero celular. Nosotros agregamos +57 y los espacios.',
  className = '',
  inputClassName = '',
}: FormattedPhoneInputProps) {
  const digits = getPhoneDigits(value);
  const displayValue = digits || !optional ? formatPhone(value) : '';
  const hasValue = digits.length > 0;
  const liveError =
    hasValue && !isValidPhone(value, optional)
      ? 'Revisa el celular: debe tener 10 digitos y empezar por 3.'
      : null;
  const message = error ?? liveError;
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDigits = getPhoneDigits(event.target.value);
    onChange(nextDigits || optional ? (nextDigits ? formatPhone(nextDigits) : '') : '+57');
  };
  const inputClass = `w-full bg-transparent px-4 py-4 text-base text-slate-900 outline-none placeholder:text-slate-400 ${inputClassName}`;

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 block text-base font-black text-slate-900">
        {label}
        {optional ? <span className="font-semibold text-slate-500"> (opcional)</span> : null}
      </label>
      <div
        className={`overflow-hidden rounded-[20px] border bg-[#f7f9fd] transition-colors ${
          message ? 'border-rose-300 bg-rose-50/50' : 'border-[#dde4f1] focus-within:border-[#173ea6]'
        }`}
      >
        {message ? (
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={displayValue}
            onChange={handleChange}
            placeholder="+57 300 123 4567"
            aria-invalid="true"
            className={inputClass}
          />
        ) : (
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={displayValue}
            onChange={handleChange}
            placeholder="+57 300 123 4567"
            aria-invalid="false"
            className={inputClass}
          />
        )}
      </div>
      <p className={`mt-2 text-sm font-semibold ${message ? 'text-rose-600' : 'text-slate-500'}`}>
        {message ?? hint}
      </p>
    </div>
  );
}
