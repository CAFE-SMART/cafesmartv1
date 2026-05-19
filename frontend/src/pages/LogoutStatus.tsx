import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { CafeSmartProcessingScreen } from '../components/CafeSmartProcessingScreen';
import { useUser } from '../context/UserContext';

const MIN_LOGOUT_DURATION_MS = 2200;
const LOGIN_FADE_DELAY_MS = 280;

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function LogoutStatus() {
  const navigate = useNavigate();
  const { logout } = useUser();
  const [status, setStatus] = useState<'loading' | 'error' | 'leaving'>(
    'loading',
  );
  const startedRef = useRef(false);

  const closeSession = useCallback(async () => {
    const startedAt = Date.now();
    setStatus('loading');

    try {
      await logout();
      await wait(
        Math.max(0, MIN_LOGOUT_DURATION_MS - (Date.now() - startedAt)),
      );
      setStatus('leaving');
      await wait(LOGIN_FADE_DELAY_MS);
      navigate('/login', { replace: true });
    } catch {
      await wait(
        Math.max(0, MIN_LOGOUT_DURATION_MS - (Date.now() - startedAt)),
      );
      setStatus('error');
    }
  }, [logout, navigate]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void closeSession();
  }, [closeSession]);

  if (status === 'error') {
    return (
      <CafeSmartErrorState
        fullScreen
        title="No pudimos cerrar sesión"
        message="Ocurrió un problema al cerrar tu sesión. Intenta nuevamente en unos segundos."
        info="Tus datos siguen protegidos. Revisaremos el cierre cuando lo intentes de nuevo."
        primaryLabel="Intentar nuevamente"
        secondaryLabel="Ir al inicio"
        onPrimary={() => void closeSession()}
        onSecondary={() => navigate('/inicio')}
      />
    );
  }

  return (
    <div
      className={
        status === 'leaving'
          ? 'animate-[cafesmartFadeOut_280ms_ease-in_both]'
          : undefined
      }
    >
      <style>
        {`
          @keyframes cafesmartFadeOut {
            0% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-6px); }
          }
        `}
      </style>
      <CafeSmartProcessingScreen
        title="Cerrando sesión..."
        subtitle="Por favor espera un momento mientras cerramos tu sesión de forma segura."
        helperText="Protegiendo tu información..."
        trustTitle="Tu seguridad es importante"
        trustText="CaféSmart está cerrando el acceso local de forma segura."
      />
    </div>
  );
}
