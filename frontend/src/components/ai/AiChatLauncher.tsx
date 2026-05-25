import { useState } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const { pathname } = useLocation();
  const { user } = useUser();

  if (!user || isPublicRoute(pathname)) return null;

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Cerrar asistente inteligente"
          className="fixed inset-0 z-[100] cursor-default bg-slate-950/10 backdrop-blur-[1px]"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      {isOpen ? <AiChatPanel onClose={() => setIsOpen(false)} /> : null}

      <button
        type="button"
        role="button"
        aria-label="Abrir asistente inteligente"
        onClick={() => setIsOpen((current) => !current)}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[105] inline-flex h-16 w-16 items-center justify-center rounded-full border border-blue-100 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.18)] transition duration-200 hover:scale-105 hover:border-blue-200 hover:bg-blue-50 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 sm:right-6 sm:bottom-[calc(env(safe-area-inset-bottom)+28px)]"
      >
        <img
          src={granitoInteligente}
          alt=""
          draggable={false}
          className="h-12 w-12 object-contain"
        />
      </button>
    </>
  );
}
