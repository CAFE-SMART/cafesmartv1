import React, { useEffect, useId, useRef } from 'react';

type AccessibleModalProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  labelledById?: string;
  describedById?: string;
  closeOnBackdrop?: boolean;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function AccessibleModal({
  title,
  description,
  children,
  onClose,
  className = '',
  labelledById,
  describedById,
  closeOnBackdrop = false,
}: AccessibleModalProps) {
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const titleId = labelledById ?? generatedTitleId;
  const descriptionId = describedById ?? generatedDescriptionId;
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      FOCUSABLE_SELECTOR,
    );
    window.setTimeout(() => {
      (focusable ?? dialogRef.current)?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ??
        [],
    ).filter((element) => element.offsetParent !== null);

    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 py-6 backdrop-blur-sm animate-in fade-in"
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`max-h-[calc(100vh-2rem)] w-full max-w-[430px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-2xl outline-none animate-in zoom-in-95 ${className}`.trim()}
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="sr-only">
            {description}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
