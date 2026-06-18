import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, X } from 'lucide-react';
import { getTodayLocalDateValue } from '../../utils/date';

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

type CalendarView = 'days' | 'months' | 'years';

type CafeSmartDatePickerProps = {
  value: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
  label?: string;
  placeholder?: string;
  clearable?: boolean;
  hasError?: boolean;
  triggerClassName?: string;
  dialogLabel?: string;
};

function parseLocalDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function formatLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateValueInRange(value: string, min: string, max: string) {
  return value >= min && value <= max;
}

function formatLongDateLabel(value: string) {
  const date = parseLocalDateValue(value);
  if (!date) return '';

  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatShortDateLabel(value: string) {
  const date = parseLocalDateValue(value);
  if (!date) return '';

  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function ariaPressed(active: boolean) {
  return { 'aria-pressed': active ? 'true' : 'false' } as const;
}

export function CafeSmartDatePicker({
  value,
  open,
  onToggle,
  onClose,
  onChange,
  minDate = '2020-01-01',
  maxDate = getTodayLocalDateValue(),
  label = 'Fecha',
  placeholder = 'Selecciona fecha',
  clearable = true,
  hasError = false,
  triggerClassName = '',
  dialogLabel = 'Calendario Cafe Smart',
}: CafeSmartDatePickerProps) {
  const selectedDate = parseLocalDateValue(value);
  const todayValue = getTodayLocalDateValue();
  const todaySelectable = isDateValueInRange(todayValue, minDate, maxDate)
    ? todayValue
    : maxDate;
  const maxDateParsed = parseLocalDateValue(maxDate) ?? new Date();
  const minDateParsed = parseLocalDateValue(minDate) ?? new Date(2020, 0, 1);
  const visibleDate =
    selectedDate ?? parseLocalDateValue(todaySelectable) ?? maxDateParsed;
  const [calendarView, setCalendarView] = useState<CalendarView>('days');
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1),
  );
  const [draftValue, setDraftValue] = useState(value);

  useEffect(() => {
    if (!open) return;
    const nextDate =
      parseLocalDateValue(value) ??
      parseLocalDateValue(todaySelectable) ??
      maxDateParsed;
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setDraftValue(value || todaySelectable);
    setCalendarView('days');
  }, [maxDate, open, todaySelectable, value]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      1,
    );
    const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0,
    ).getDate();

    return [
      ...Array.from({ length: firstDay.getDay() }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth(),
          index + 1,
        );
        return { day: index + 1, value: formatLocalDateValue(date) };
      }),
    ];
  }, [visibleMonth]);

  const visibleYear = visibleMonth.getFullYear();
  const previousMonth = new Date(visibleYear, visibleMonth.getMonth() - 1, 1);
  const nextMonth = new Date(visibleYear, visibleMonth.getMonth() + 1, 1);
  const canGoPrevious =
    previousMonth >=
    new Date(minDateParsed.getFullYear(), minDateParsed.getMonth(), 1);
  const canGoNext =
    nextMonth <=
    new Date(maxDateParsed.getFullYear(), maxDateParsed.getMonth(), 1);
  const yearOptions = Array.from(
    { length: maxDateParsed.getFullYear() - minDateParsed.getFullYear() + 1 },
    (_, index) => minDateParsed.getFullYear() + index,
  );
  const longDraftLabel = draftValue ? formatLongDateLabel(draftValue) : '';
  const displayValue = value ? formatShortDateLabel(value) : placeholder;

  const applyDraft = () => {
    onChange(draftValue || (clearable ? '' : todaySelectable));
    onClose();
  };

  const selectToday = () => {
    const nextDate = parseLocalDateValue(todaySelectable) ?? maxDateParsed;
    setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    setDraftValue(todaySelectable);
    setCalendarView('days');
  };

  const clearSelection = () => {
    if (!clearable) return;
    setDraftValue('');
    onChange('');
    onClose();
  };

  return (
    <div
      className="relative w-full min-w-0"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open ? 'true' : 'false'}
        onClick={onToggle}
        className={`flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-2 rounded-[14px] border bg-[#fffaf2] px-3 py-2 text-left shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition hover:border-[#bd8b46] hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b36b16]/15 dark:bg-slate-900 dark:hover:bg-slate-800 ${
          hasError
            ? 'border-rose-300 bg-rose-50/70 dark:border-rose-500 dark:bg-rose-500/15'
            : open
              ? 'border-[#b36b16] dark:border-amber-300'
              : 'border-[#e4d7c3] dark:border-slate-600'
        } ${triggerClassName}`.trim()}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[0.68rem] font-black uppercase tracking-normal text-[#7a4d16] dark:text-amber-200">
            {label}
          </span>
          <span className="block truncate text-sm font-black leading-5 text-[#08256d] dark:text-slate-100">
            {displayValue}
          </span>
        </span>
        <CalendarDays
          size={19}
          className="shrink-0 text-[#b36b16] dark:text-amber-200"
          aria-hidden="true"
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Cerrar calendario"
            className="fixed inset-0 z-[118] cursor-default bg-slate-950/15 backdrop-blur-[1px] dark:bg-slate-950/45"
            onClick={onClose}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            className="fixed left-1/2 top-1/2 z-[120] w-[min(22rem,calc(100vw-1.5rem))] max-h-[calc(100dvh-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[22px] border border-[#decdb3] bg-[#fffaf2] p-4 shadow-[0_24px_60px_rgba(67,44,17,0.25)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_24px_60px_rgba(0,0,0,0.52)]"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.72rem] font-black uppercase tracking-normal text-[#9a5f1a] dark:text-amber-200">
                  {label}
                </p>
                <p className="truncate text-base font-black text-[#08256d] dark:text-white">
                  {MONTHS_ES[visibleMonth.getMonth()]} {visibleYear}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar calendario"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-[16px] border border-[#eadcc6] bg-white/75 p-1.5 dark:border-slate-700 dark:bg-slate-800/80">
              <button
                type="button"
                disabled={!canGoPrevious}
                onClick={() => setVisibleMonth(previousMonth)}
                aria-label="Mes anterior"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300 dark:text-blue-200 dark:hover:bg-slate-700 dark:disabled:text-slate-600"
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </button>
              <div className="flex min-w-0 items-center justify-center gap-1">
                <button
                  type="button"
                  {...ariaPressed(calendarView === 'months')}
                  onClick={() =>
                    setCalendarView((current) =>
                      current === 'months' ? 'days' : 'months',
                    )
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-black transition ${
                    calendarView === 'months'
                      ? 'bg-[#102d92] text-white'
                      : 'text-slate-900 hover:bg-[#eef4ff] dark:text-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {MONTHS_ES[visibleMonth.getMonth()]}
                </button>
                <button
                  type="button"
                  {...ariaPressed(calendarView === 'years')}
                  onClick={() =>
                    setCalendarView((current) =>
                      current === 'years' ? 'days' : 'years',
                    )
                  }
                  className={`rounded-full px-2.5 py-1 text-xs font-black transition ${
                    calendarView === 'years'
                      ? 'bg-[#102d92] text-white'
                      : 'text-slate-900 hover:bg-[#eef4ff] dark:text-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {visibleYear}
                </button>
              </div>
              <button
                type="button"
                disabled={!canGoNext}
                onClick={() => setVisibleMonth(nextMonth)}
                aria-label="Mes siguiente"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-not-allowed disabled:text-slate-300 dark:text-blue-200 dark:hover:bg-slate-700 dark:disabled:text-slate-600"
              >
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3">
              {calendarView === 'months' ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {MONTHS_ES.map((month, monthIndex) => {
                    const candidate = new Date(visibleYear, monthIndex, 1);
                    const disabled =
                      candidate <
                        new Date(
                          minDateParsed.getFullYear(),
                          minDateParsed.getMonth(),
                          1,
                        ) ||
                      candidate >
                        new Date(
                          maxDateParsed.getFullYear(),
                          maxDateParsed.getMonth(),
                          1,
                        );
                    const active = monthIndex === visibleMonth.getMonth();
                    return (
                      <button
                        key={month}
                        type="button"
                        disabled={disabled}
                        {...ariaPressed(active)}
                        onClick={() => {
                          setVisibleMonth(new Date(visibleYear, monthIndex, 1));
                          setCalendarView('days');
                        }}
                        className={`min-h-[40px] rounded-[12px] px-2 text-[0.72rem] font-black transition disabled:cursor-not-allowed disabled:text-slate-300 dark:disabled:text-slate-600 ${
                          active
                            ? 'bg-[#102d92] text-white shadow-[0_8px_18px_rgba(16,45,146,0.2)]'
                            : 'text-slate-800 hover:bg-white dark:text-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {month}
                      </button>
                    );
                  })}
                </div>
              ) : calendarView === 'years' ? (
                <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto">
                  {yearOptions.map((year) => {
                    const active = year === visibleYear;
                    return (
                      <button
                        key={year}
                        type="button"
                        {...ariaPressed(active)}
                        onClick={() => {
                          setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1));
                          setCalendarView('months');
                        }}
                        className={`min-h-[40px] rounded-[12px] px-2 text-xs font-black transition ${
                          active
                            ? 'bg-[#102d92] text-white shadow-[0_8px_18px_rgba(16,45,146,0.2)]'
                            : 'text-slate-800 hover:bg-white dark:text-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS_ES.map((day) => (
                    <span
                      key={day}
                      className="py-1.5 text-center text-[0.72rem] font-black text-slate-500 dark:text-slate-300"
                    >
                      {day}
                    </span>
                  ))}
                  {calendarDays.map((day, index) =>
                    day ? (
                      <button
                        key={day.value}
                        type="button"
                        disabled={!isDateValueInRange(day.value, minDate, maxDate)}
                        {...ariaPressed(day.value === draftValue)}
                        onClick={() => setDraftValue(day.value)}
                        className={`h-10 min-w-0 rounded-full text-sm font-black transition disabled:cursor-not-allowed disabled:text-slate-300 dark:disabled:text-slate-600 ${
                          day.value === draftValue
                            ? 'bg-[#b36b16] text-white shadow-[0_10px_20px_rgba(179,107,22,0.26)]'
                            : day.value === todaySelectable
                              ? 'bg-[#eef4ff] text-[#102d92] dark:bg-blue-500/20 dark:text-blue-100'
                              : 'text-slate-800 hover:bg-white dark:text-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {day.day}
                      </button>
                    ) : (
                      <span key={`empty-${index}`} aria-hidden="true" />
                    ),
                  )}
                </div>
              )}
            </div>

            <p className="mt-3 min-h-[24px] truncate rounded-[14px] bg-white/75 px-3 py-2 text-center text-sm font-black text-[#08256d] dark:bg-slate-800 dark:text-slate-100">
              {longDraftLabel || 'Selecciona una fecha'}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#eadcc6] pt-3 dark:border-slate-700">
              <button
                type="button"
                onClick={selectToday}
                className="min-h-[42px] rounded-full px-3 text-sm font-black text-[#102d92] transition hover:bg-white dark:text-blue-100 dark:hover:bg-slate-800"
              >
                Hoy
              </button>
              {clearable ? (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="min-h-[42px] rounded-full px-3 text-sm font-black text-slate-600 transition hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Limpiar
                </button>
              ) : (
                <span aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={applyDraft}
                className="min-h-[42px] rounded-full bg-[#102d92] px-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.22)] transition hover:bg-[#173ea6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/20 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                Aplicar
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
