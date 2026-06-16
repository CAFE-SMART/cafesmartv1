import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import granitoInteligente from '../../assets/granito-inteligente.png';
import { useUser } from '../../context/UserContext';
import { AiChatPanel } from './AiChatPanel';

const isPublicRoute = (path: string) =>
  path === '/' ||
  path.startsWith('/login') ||
  path.startsWith('/recuperar') ||
  path.startsWith('/recuperar-password') ||
  path.startsWith('/restablecer') ||
  path.startsWith('/register') ||
  path.startsWith('/crear-empresa');

export function AiChatLauncher() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasBlockingSurface, setHasBlockingSurface] = useState(false);
  const pointerStartXRef = useRef<number | null>(null);
  const { pathname } = useLocation();
  const { user } = useUser();

  useEffect(() => {
    setIsExpanded(false);
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isExpanded || isOpen) return;
    const timerId = window.setTimeout(() => setIsExpanded(false), 7000);
    return () => window.clearTimeout(timerId);
  }, [isExpanded, isOpen]);

  useEffect(() => {
    const collapseForInput = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]')
      ) {
        setIsExpanded(false);
      }
    };

    const inspectBlockingSurface = () => {
      const blocking = Array.from(
        document.querySelectorAll('[role="dialog"], [aria-modal="true"]'),
      ).some((element) => !element.closest('[data-ai-launcher="true"]'));
      setHasBlockingSurface(blocking);
      if (blocking) setIsExpanded(false);
    };

    inspectBlockingSurface();
    const intervalId = window.setInterval(inspectBlockingSurface, 800);
    window.addEventListener('focusin', collapseForInput);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focusin', collapseForInput);
    };
  }, []);

  if (!user || isPublicRoute(pathname) || pathname.startsWith('/asistente')) return null;

  const openFullAssistant = () => {
    setIsExpanded(false);
    setIsOpen(true);
  };

  const suggestions = [
    'Resumen del dia',
    'Espacio en bodega',
    'Sugerencias',
    'Ayuda con ventas',
    'Ayuda con compras',
  ];

  return (
    <div data-ai-launcher="true">
      {isOpen ? (
        <button
          type="button"
          aria-label="Cerrar asistente inteligente"
          className="fixed inset-0 z-[100] cursor-default bg-white/20 backdrop-blur-[1px] dark:bg-slate-950/35"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {isOpen ? <AiChatPanel onClose={() => setIsOpen(false)} /> : null}

      {isExpanded ? (
        <button
          type="button"
          aria-label="Contraer asistente inteligente"
          className="fixed inset-0 z-[96] cursor-default bg-transparent"
          onClick={() => setIsExpanded(false)}
        />
      ) : null}

      <div
        className="fixed right-0 top-1/2 z-[105] flex -translate-y-1/2 items-center transition-transform duration-200"
      >
        {isExpanded && !hasBlockingSurface ? (
          <section className="mr-3 w-[min(19rem,calc(100vw-4.5rem))] rounded-l-[20px] rounded-r-[16px] border border-[#d5def0] bg-white p-3 shadow-[0_18px_42px_rgba(15,23,42,0.2)] dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={openFullAssistant}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-[#f8fbff] shadow-sm dark:border-slate-700 dark:bg-slate-800"
                aria-label="Abrir IA completa"
              >
                <img
                  src={granitoInteligente}
                  alt=""
                  draggable={false}
                  className="h-9 w-9 object-contain"
                />
              </button>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={openFullAssistant}
                  className="block w-full text-left"
                >
                  <p className="truncate text-sm font-black text-[#08256d] dark:text-white">
                    Asistente Cafe Smart
                  </p>
                  <p className="mt-0.5 text-xs font-semibold leading-4 text-slate-500 dark:text-slate-300">
                    En que puedo ayudarte?
                  </p>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                aria-label="Cerrar acceso de IA"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                x
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={openFullAssistant}
                  className="rounded-full border border-[#dbe4f3] bg-[#f8fbff] px-2.5 py-1.5 text-[0.68rem] font-black text-[#102d92] transition hover:border-amber-300 hover:bg-amber-50 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={openFullAssistant}
              className="mt-3 flex min-h-[40px] w-full items-center rounded-full border border-[#dbe4f3] bg-[#f8fbff] px-3 text-left text-xs font-semibold text-slate-500 transition hover:border-blue-200 hover:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Escribe tu pregunta...
            </button>
          </section>
        ) : null}

        <button
          type="button"
          role="button"
          aria-label={
            isExpanded
              ? 'Abrir asistente inteligente'
              : 'Expandir asistente inteligente'
          }
          onPointerDown={(event) => {
            pointerStartXRef.current = event.clientX;
          }}
          onPointerUp={(event) => {
            const startX = pointerStartXRef.current;
            pointerStartXRef.current = null;
            if (startX !== null && startX - event.clientX > 18) {
              setIsExpanded(true);
            }
          }}
          onClick={() => {
            if (hasBlockingSurface) {
              setIsExpanded(false);
              return;
            }
            if (isExpanded) {
              openFullAssistant();
            } else {
              setIsExpanded(true);
            }
          }}
          className={`group inline-flex h-[74px] w-[48px] items-center justify-start rounded-l-[24px] border border-r-0 border-blue-200 bg-[#102d92] pl-2 shadow-[0_14px_34px_rgba(16,45,146,0.26)] transition duration-200 hover:translate-x-0 focus-visible:translate-x-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 dark:border-blue-400/40 dark:bg-slate-900 ${
            hasBlockingSurface
              ? 'translate-x-[34px] opacity-80'
              : isExpanded
                ? 'translate-x-0'
                : 'translate-x-[15px]'
          }`}
        >
          <img
            src={granitoInteligente}
            alt=""
            draggable={false}
            className="h-9 w-9 object-contain drop-shadow-sm"
          />
        </button>
      </div>
    </div>
  );
}
