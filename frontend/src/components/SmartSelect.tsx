import React, { SelectHTMLAttributes, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  selectMenuClass,
  selectOptionActiveClass,
  selectOptionClass,
  selectTriggerClass,
} from '../styles/uiClasses';

type SmartSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

type SmartOption = {
  value: string;
  label: string;
  disabled: boolean;
};

function getOptionText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getOptionText).join('');
  return '';
}

export function SmartSelect({
  className = '',
  children,
  disabled,
  value,
  defaultValue,
  onChange,
  name,
  id,
  'aria-label': ariaLabel,
  ...props
}: SmartSelectProps) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(
    String(value ?? defaultValue ?? ''),
  );

  const options = useMemo<SmartOption[]>(() => {
    return React.Children.toArray(children)
      .filter(React.isValidElement)
      .map((child) => {
        const props = child.props as {
          value?: string | number;
          disabled?: boolean;
          children?: React.ReactNode;
        };
        const label = getOptionText(props.children);
        return {
          value: String(props.value ?? label),
          label,
          disabled: Boolean(props.disabled),
        };
      });
  }, [children]);

  const selectedValue = String(value ?? internalValue);
  const selectedOption =
    options.find((option) => option.value === selectedValue) ?? options[0];

  useEffect(() => {
    if (value !== undefined) {
      setInternalValue(String(value));
    }
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const selectOption = (option: SmartOption) => {
    if (option.disabled || disabled) return;
    setInternalValue(option.value);
    setOpen(false);
    onChange?.({
      target: { value: option.value, name },
      currentTarget: { value: option.value, name },
    } as React.ChangeEvent<HTMLSelectElement>);
  };
  const listboxId = id ? `${id}-listbox` : undefined;

  return (
    <span ref={containerRef} className="relative inline-flex w-full">
      <input type="hidden" name={name} value={selectedValue} />
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={listboxId}
        aria-disabled={disabled ? 'true' : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen(true);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`${selectTriggerClass} ${className}`.trim()}
        {...props}
      >
        <span className="block truncate">
          {selectedOption?.label ?? 'Selecciona una opción'}
        </span>
      </button>
      <ChevronDown
        className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2f63d8] transition-transform duration-200 dark:text-slate-200 ${
          open ? 'rotate-180' : ''
        }`}
        aria-hidden="true"
      />
      <span
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        className={`${selectMenuClass} ${
          open
            ? 'scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0'
        }`}
      >
        {options.map((option) => {
          const selected = option.value === selectedValue;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={selected ? 'true' : 'false'}
              disabled={option.disabled}
              onClick={() => selectOption(option)}
              className={`${selectOptionClass} ${
                selected ? selectOptionActiveClass : ''
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </span>
    </span>
  );
}
