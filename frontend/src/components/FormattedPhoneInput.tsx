import React, { useId } from 'react';
import {
  formatPhone,
  getPhoneDigits,
  isValidPhone,
} from '../utils/formatPhone';

/**
 * Archivo: FormattedPhoneInput.tsx
 * Proposito:
 * Renderiza un campo telefonico reutilizable para numeros celulares colombianos.
 *
 * Responsabilidad:
 * Normaliza la entrada del usuario, muestra el telefono con formato +57 y expone
 * mensajes accesibles de ayuda o error para formularios de Cafe Smart.
 *
 * Uso:
 * Es utilizado por pantallas de registro, clientes y otros formularios que
 * requieren capturar telefonos con validacion visual y soporte para lectores de pantalla.
 */

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

/**
 * Campo controlado para capturar y validar un telefono colombiano.
 *
 * @param id Identificador opcional para asociar label, input y mensaje.
 * @param label Texto visible del campo.
 * @param value Valor actual del telefono.
 * @param onChange Callback que recibe el telefono normalizado/formateado.
 * @param optional Indica si el campo puede quedar vacio.
 * @param error Mensaje de error externo enviado por el formulario.
 * @param hint Mensaje de ayuda cuando no hay error.
 * @param className Clases para el contenedor.
 * @param inputClassName Clases adicionales para el input.
 * @returns Input telefonico accesible con ayuda, error y formato visual.
 */
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
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const digits = getPhoneDigits(value);
  const displayValue = digits || !optional ? formatPhone(value) : '';
  const hasValue = digits.length > 0;
  const liveError =
    hasValue && !isValidPhone(value, optional)
      ? 'Revisa el celular: debe tener 10 digitos y empezar por 3.'
      : null;
  const message = error ?? liveError;

  /**
   * Extrae solo digitos de lo escrito por el usuario y emite el valor que debe
   * persistir el formulario. Mantiene el prefijo visual +57 cuando el campo es requerido.
   *
   * @param event Evento de cambio del input telefonico.
   * @returns No retorna valor; informa el cambio mediante onChange.
   */
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDigits = getPhoneDigits(event.target.value);
    onChange(
      nextDigits || optional
        ? nextDigits
          ? formatPhone(nextDigits)
          : ''
        : '+57',
    );
  };
  const inputClass = `w-full bg-transparent px-4 py-4 text-base text-slate-900 outline-none placeholder:text-slate-400 ${inputClassName}`;

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className="mb-2 block text-base font-black text-slate-900"
      >
        {label}
        {optional ? (
          <span className="font-semibold text-slate-500"> (opcional)</span>
        ) : null}
      </label>
      <div
        className={`overflow-hidden rounded-[20px] border bg-[#f7f9fd] transition-colors ${
          message
            ? 'border-rose-300 bg-rose-50/50'
            : 'border-[#dde4f1] focus-within:border-[#173ea6]'
        }`}
      >
        {message ? (
          <input
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={displayValue}
            onChange={handleChange}
            placeholder="+57 300 123 4567"
            aria-invalid="true"
            aria-describedby={messageId}
            className={inputClass}
          />
        ) : (
          <input
            id={inputId}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={displayValue}
            onChange={handleChange}
            placeholder="+57 300 123 4567"
            aria-invalid="false"
            aria-describedby={messageId}
            className={inputClass}
          />
        )}
      </div>
      {message ? (
        <p
          id={messageId}
          role="alert"
          aria-live="polite"
          className="mt-2 text-sm font-semibold text-rose-600"
        >
          {message}
        </p>
      ) : (
        <p id={messageId} className="mt-2 text-sm font-semibold text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
