import React, { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Coffee,
  DollarSign,
  Monitor,
  Moon,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Sun,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import { useTheme, type ThemePreference } from '../theme/themeProvider';

const featureCards = [
  {
    icon: PackageCheck,
    title: 'Inventario por estado',
    description:
      'Controla café pergamino, verde, en secado y almacenado con movimientos trazables.',
  },
  {
    icon: Activity,
    title: 'Secado sin confusiones',
    description:
      'Haz seguimiento a sublotes, humedad, mermas y avance del proceso en una vista clara.',
  },
  {
    icon: DollarSign,
    title: 'Compras, ventas y gastos',
    description:
      'Registra operaciones económicas y entiende mejor el flujo diario del negocio cafetero.',
  },
  {
    icon: BarChart3,
    title: 'Reportes accionables',
    description:
      'Consulta rendimiento, utilidad, compras y ventas con datos organizados para decidir mejor.',
  },
];

const workflowSteps = [
  'Registra entradas, ventas, gastos y procesos desde el celular o computador.',
  'Consulta inventario y secados activos sin revisar cuadernos ni hojas sueltas.',
  'Usa reportes y alertas para tomar decisiones con más contexto operativo.',
];

const metrics = [
  { label: 'Inventario total', value: '4.850 kg', tone: 'text-emerald-700' },
  { label: 'Secados activos', value: '2 lotes', tone: 'text-amber-700' },
  { label: 'Ventas del mes', value: '$18.6M', tone: 'text-blue-700' },
];

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

function LandingThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeOption = themeOptions.find((option) => option.value === theme) ?? themeOptions[2];
  const ActiveIcon = activeOption.icon;

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const activeIndex = Math.max(
      0,
      themeOptions.findIndex((option) => option.value === theme),
    );
    window.setTimeout(() => itemRefs.current[activeIndex]?.focus(), 0);
  }, [open, theme]);

  const selectTheme = (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    setOpen(false);
  };

  const focusOption = (index: number) => {
    const nextIndex = (index + themeOptions.length) % themeOptions.length;
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#143f35] focus:outline-none focus:ring-4 focus:ring-emerald-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-emerald-500/40 dark:hover:bg-slate-800 dark:hover:text-emerald-100 dark:focus:ring-emerald-500/25 sm:px-4"
      >
        <ActiveIcon size={17} aria-hidden="true" />
        <span>Tema</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Seleccionar tema visual"
          className="absolute right-0 z-50 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 text-sm font-bold text-slate-700 shadow-2xl shadow-slate-950/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {themeOptions.map((option, index) => {
            const Icon = option.icon;
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => selectTheme(option.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    focusOption(index + 1);
                  }
                  if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    focusOption(index - 1);
                  }
                  if (event.key === 'Home') {
                    event.preventDefault();
                    focusOption(0);
                  }
                  if (event.key === 'End') {
                    event.preventDefault();
                    focusOption(themeOptions.length - 1);
                  }
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-500/40 ${
                  selected
                    ? 'bg-emerald-50 text-[#143f35] dark:bg-emerald-500/15 dark:text-emerald-100'
                    : 'hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="flex-1">{option.label}</span>
                {selected ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
function PhonePreview() {
  return (
    <div className="relative mx-auto w-[min(72vw,248px)] rounded-[2.15rem] border-[8px] border-slate-950 bg-slate-950 p-2 shadow-2xl shadow-slate-950/25 sm:w-[260px] lg:w-[252px] xl:w-[276px]">
      <div className="absolute left-1/2 top-4 z-20 h-4 w-24 -translate-x-1/2 rounded-full bg-slate-950" />
      <div className="relative aspect-[9/18.6] overflow-hidden rounded-[1.55rem] bg-[#f7faf9]">
        <div className="flex h-full flex-col">
          <div className="bg-white px-3 pb-3 pt-7 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#176b55] text-white">
                  <Coffee size={15} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[10px] font-black leading-none text-slate-950 dark:text-white">
                    Cafe Smart
                  </p>
                  <p className="mt-1 text-[8px] font-bold text-slate-400">
                    Hoy, 8:30 a.m.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-[#176b55] dark:text-emerald-300">
                Activo
              </span>
            </div>
          </div>

          <div className="flex-1 space-y-2.5 overflow-hidden px-3 py-3">
            <div className="rounded-2xl bg-[#176b55] p-3 text-white shadow-lg shadow-emerald-900/15">
              <div className="flex items-center gap-2">
                <Sparkles size={13} aria-hidden="true" />
                <p className="text-[9px] font-black uppercase tracking-wide text-emerald-50">
                  Asistente cafetero
                </p>
              </div>
              <p className="mt-2 text-[11px] font-bold leading-4">
                Dos sublotes están cerca del punto ideal de humedad.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-2.5">
                <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                  Inventario
                </p>
                <p className="mt-1 text-base font-black text-slate-950 dark:text-white">
                  4.850 kg
                </p>
                <p className="text-[9px] font-bold text-emerald-600">
                  +12% semana
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-2.5">
                <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                  Ventas
                </p>
                <p className="mt-1 text-base font-black text-slate-950 dark:text-white">
                  $4.9M
                </p>
                <p className="text-[9px] font-bold text-blue-600">
                  3 registros
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Activity
                    size={13}
                    className="text-amber-600"
                    aria-hidden="true"
                  />
                  <p className="text-[10px] font-black text-slate-800">
                    Secado 3B
                  </p>
                </div>
                <p className="rounded-full bg-amber-50 px-2 py-1 text-[8px] font-black text-amber-700">
                  12.4%
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-4/5 rounded-full bg-amber-500" />
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[8px] font-black uppercase tracking-wide text-slate-400">
                Operaciones recientes
              </p>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-bold text-slate-700">
                  Compra pergamino
                </p>
                <p className="text-[10px] font-black text-emerald-700">
                  +180 kg
                </p>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[10px] font-bold text-slate-700">
                  Venta café verde
                </p>
                <p className="text-[10px] font-black text-blue-700">$4.960k</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 border-t border-slate-200 bg-white px-2 pb-3 pt-2 text-slate-400">
            <div className="flex flex-col items-center gap-1 text-[#176b55] dark:text-emerald-300">
              <Coffee size={13} aria-hidden="true" />
              <span className="text-[7px] font-black">Inicio</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ClipboardList size={13} aria-hidden="true" />
              <span className="text-[7px] font-black">Compras</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <TrendingUp size={13} aria-hidden="true" />
              <span className="text-[7px] font-black">Ventas</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ShieldCheck size={13} aria-hidden="true" />
              <span className="text-[7px] font-black">Datos</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopPreview() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-emerald-200/40 blur-3xl" />
      <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 p-4 dark:border-slate-700 dark:bg-slate-900/90 shadow-2xl shadow-slate-950/10 backdrop-blur lg:p-5 xl:p-6">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#176b55] dark:text-emerald-300">
              Panel operativo
            </p>
            <p className="mt-1 text-sm font-bold text-slate-500 dark:text-slate-300">
              Vista resumida del negocio cafetero
            </p>
          </div>
          <span className="hidden rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-[#176b55] dark:text-emerald-300 sm:inline-flex">
            En línea
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="order-2 grid content-start gap-4 lg:order-1">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                    {metric.label}
                  </p>
                  <p className={`mt-2 text-2xl font-black ${metric.tone}`}>
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950 dark:text-white">
                    Secado activo: Sublote 3B
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Humedad estimada 12.4%, avance alto
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700 dark:bg-amber-500/15 dark:text-amber-100">
                  Prioridad
                </span>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full w-4/5 rounded-full bg-amber-500" />
              </div>
            </div>

            <div className="rounded-2xl bg-[#143f35] p-4 text-white shadow-lg shadow-emerald-950/15">
              <div className="flex items-start gap-3">
                <Sparkles
                  className="mt-0.5 shrink-0"
                  size={18}
                  aria-hidden="true"
                />
                <div>
                  <p className="text-sm font-black">Asistente Cafe Smart</p>
                  <p className="mt-1 text-sm leading-6 text-emerald-50">
                    Recomienda revisar el secado 3B antes de registrar nuevas
                    entradas al inventario.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <PhonePreview />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6faf8] text-slate-950 selection:bg-emerald-100 selection:text-emerald-950 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-50">
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/88">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-3 rounded-full text-left focus:outline-none focus:ring-4 focus:ring-emerald-200"
            aria-label="Cafe Smart inicio"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#143f35] text-white shadow-lg shadow-emerald-950/10">
              <Coffee size={22} aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-lg font-black tracking-tight sm:text-xl">
                Cafe Smart
              </span>
              <span className="hidden text-xs font-semibold text-slate-500 dark:text-slate-300 sm:block">
                Gestión cafetera simple
              </span>
            </span>
          </Link>

          <nav
            className="flex min-w-0 items-center gap-2 sm:gap-3"
            aria-label="Principal"
          >
            <a
              href="#que-puedes-hacer"
              className="hidden min-h-11 items-center rounded-full px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:focus:ring-slate-700 md:inline-flex"
            >
              Cómo funciona
            </a>
            <LandingThemeSelector />
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#143f35] px-4 text-sm font-black text-white shadow-lg shadow-emerald-950/10 transition hover:bg-[#0f3028] focus:outline-none focus:ring-4 focus:ring-emerald-200 dark:focus:ring-emerald-500/30 sm:px-6"
            >
              Iniciar sesión
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-50 via-white to-transparent dark:from-emerald-950/30 dark:via-slate-950 dark:to-transparent" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] lg:gap-16 lg:px-8 lg:py-24 xl:py-28">
            <div className="max-w-3xl text-center lg:text-left">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#176b55] shadow-sm dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-200 lg:mx-0">
                <Sparkles size={14} aria-hidden="true" />
                Control operativo para café
              </div>

              <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                Controla tu negocio cafetero{' '}
                <span className="text-[#176b55] dark:text-emerald-300">desde el celular</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg lg:mx-0 xl:text-xl xl:leading-9">
                Cafe Smart reúne inventario, compras, ventas, gastos, secado y
                reportes en una experiencia clara para administrar mejor cada
                movimiento del negocio cafetero.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  to="/register"
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#176b55] px-7 text-sm font-black text-white shadow-xl shadow-emerald-900/15 transition hover:bg-[#125642] focus:outline-none focus:ring-4 focus:ring-emerald-200 sm:w-auto"
                >
                  Comenzar gratis
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a
                  href="#que-puedes-hacer"
                  className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-7 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:ring-slate-700 sm:w-auto"
                >
                  Ver cómo funciona
                </a>
              </div>

              <div className="mt-8 grid gap-3 text-left sm:grid-cols-3 lg:max-w-2xl">
                {workflowSteps.map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white/85 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/85"
                  >
                    <CheckCircle2
                      size={18}
                      className="mt-0.5 shrink-0 text-[#176b55] dark:text-emerald-300"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <DesktopPreview />
          </div>
        </section>

        <section
          id="que-puedes-hacer"
          className="border-y border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900 sm:py-16 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#176b55] dark:text-emerald-300">
                Cómo funciona
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
                Un panel amplio para administrar lo importante
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
                La experiencia está pensada para trabajar bien en computador,
                tablet y celular, con módulos claros para cada operación del
                negocio cafetero.
              </p>
            </div>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featureCards.map(({ icon: Icon, title, description }) => (
                <article
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-[#fbfcfb] p-6 shadow-sm dark:border-slate-700 dark:bg-slate-950 transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/5"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-[#176b55] dark:bg-emerald-500/15 dark:text-emerald-200">
                    <Icon size={23} aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-slate-950 dark:text-white">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f6faf8] py-14 dark:bg-slate-950 sm:py-16 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-[#176b55] dark:text-emerald-300">
                Decisiones con datos
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 dark:text-white sm:text-4xl lg:text-5xl">
                Menos desorden, más control y mejores decisiones
              </h2>
              <p className="mt-4 text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
                Cafe Smart está pensado para negocios cafeteros que necesitan
                registrar rápido, consultar fácil y mantener la información
                lista para actuar.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <UsersRound
                  size={24}
                  className="text-[#176b55] dark:text-emerald-300"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
                  Equipo alineado
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  Datos compartidos para dueños, administradores y operación.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <Activity
                  size={24}
                  className="text-[#176b55] dark:text-emerald-300"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
                  Flujo diario
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  Registros rápidos para compras, ventas, gastos y secado.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <ShieldCheck
                  size={24}
                  className="text-[#176b55] dark:text-emerald-300"
                  aria-hidden="true"
                />
                <h3 className="mt-4 text-2xl font-black text-slate-950 dark:text-white">
                  Datos seguros
                </h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                  Información organizada y disponible cuando se necesita.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 pb-14 sm:px-6 sm:pb-16 lg:px-8">
          <div className="mx-auto grid max-w-7xl items-center gap-8 overflow-hidden rounded-[2rem] bg-[#143f35] px-6 py-10 text-white shadow-2xl shadow-emerald-950/20 sm:px-10 sm:py-12 lg:grid-cols-[1fr_auto] lg:text-left">
            <div className="text-center lg:text-left">
              <h2 className="mx-auto max-w-3xl text-3xl font-black tracking-tight sm:text-4xl lg:mx-0">
                Empieza a organizar tu negocio cafetero hoy
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-emerald-50 lg:mx-0">
                Crea tu cuenta y empieza a centralizar inventario, operaciones y
                reportes desde una interfaz hecha para trabajar en cualquier
                pantalla.
              </p>
            </div>
            <div className="flex justify-center">
              <Link
                to="/register"
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-7 text-sm font-black text-[#143f35] shadow-lg transition hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-white/30 sm:w-auto"
              >
                Comenzar gratis
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} Cafe Smart. Todos los derechos
            reservados.
          </p>
          <div className="flex items-center gap-4 text-sm font-bold text-slate-600 dark:text-slate-300">
            <Link
              to="/login"
              className="hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-slate-200 dark:hover:text-white dark:focus:ring-slate-700"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/register"
              className="hover:text-slate-950 focus:outline-none focus:ring-4 focus:ring-slate-200 dark:hover:text-white dark:focus:ring-slate-700"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
