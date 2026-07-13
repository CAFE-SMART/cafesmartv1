import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { CafeSmartModal } from '../components/common/CafeSmartModal';
import { primaryButtonClass, secondaryButtonClass } from '../styles/uiClasses';

type UnsavedEntry = {
  active: boolean;
  title?: string;
  message?: string;
};

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean;
  registerUnsavedChanges: (id: string, entry: UnsavedEntry | null) => void;
  confirmIfNeeded: (onConfirm: () => void) => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
);

const DEFAULT_TITLE = 'Tienes cambios sin guardar';
const DEFAULT_MESSAGE =
  'Si sales ahora, perderás la información que no has guardado.';

function isModifiedActivation(event: MouseEvent) {
  return (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
}

function isSameDocumentUrl(url: string) {
  const next = new URL(url, window.location.href);
  return (
    next.pathname === window.location.pathname &&
    next.search === window.location.search &&
    next.hash === window.location.hash
  );
}

export function UnsavedChangesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const entriesRef = useRef(new Map<string, UnsavedEntry>());
  const allowNavigationRef = useRef(false);
  const currentUrlRef = useRef('');
  const pendingActionRef = useRef<(() => void) | null>(null);
  const [dirtyVersion, setDirtyVersion] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const hasUnsavedChanges = useMemo(
    () => Array.from(entriesRef.current.values()).some((entry) => entry.active),
    [dirtyVersion],
  );

  const activeEntry = useMemo(
    () => Array.from(entriesRef.current.values()).find((entry) => entry.active),
    [dirtyVersion],
  );

  const registerUnsavedChanges = useCallback(
    (id: string, entry: UnsavedEntry | null) => {
      if (!entry || !entry.active) {
        entriesRef.current.delete(id);
      } else {
        entriesRef.current.set(id, entry);
      }
      setDirtyVersion((value) => value + 1);
    },
    [],
  );

  const requestConfirmation = useCallback(
    (action: () => void) => {
      if (!hasUnsavedChanges || allowNavigationRef.current) {
        action();
        return true;
      }

      pendingActionRef.current = action;
      setDialogOpen(true);
      return false;
    },
    [hasUnsavedChanges],
  );

  useEffect(() => {
    currentUrlRef.current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  });

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!hasUnsavedChanges || isModifiedActivation(event)) return;
      const target =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.target && target.target !== '_self') return;
      if (target.hasAttribute('download')) return;
      const nextUrl = new URL(target.href, window.location.href);
      if (
        nextUrl.origin !== window.location.origin ||
        isSameDocumentUrl(nextUrl.href)
      )
        return;

      event.preventDefault();
      requestConfirmation(() =>
        navigate(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`),
      );
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [hasUnsavedChanges, navigate, requestConfirmation]);

  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(
      window.history,
    );

    const wrap = (
      method: 'pushState' | 'replaceState',
      original: typeof window.history.pushState,
    ) => {
      return (data: unknown, unused: string, url?: string | URL | null) => {
        if (
          !hasUnsavedChanges ||
          allowNavigationRef.current ||
          !url ||
          isSameDocumentUrl(String(url))
        ) {
          return original(data, unused, url);
        }

        requestConfirmation(() => {
          allowNavigationRef.current = true;
          try {
            original(data, unused, url);
            window.dispatchEvent(
              new PopStateEvent('popstate', { state: data }),
            );
          } finally {
            allowNavigationRef.current = false;
          }
        });
        return undefined;
      };
    };

    window.history.pushState = wrap(
      'pushState',
      originalPushState,
    ) as typeof window.history.pushState;
    window.history.replaceState = wrap(
      'replaceState',
      originalReplaceState,
    ) as typeof window.history.replaceState;

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [hasUnsavedChanges, requestConfirmation]);

  useEffect(() => {
    const handleNativeBack = (event: Event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      requestConfirmation(() => window.history.back());
    };

    window.addEventListener('cafesmart:native-back', handleNativeBack, true);
    return () =>
      window.removeEventListener(
        'cafesmart:native-back',
        handleNativeBack,
        true,
      );
  }, [hasUnsavedChanges, requestConfirmation]);

  const continueEditing = () => {
    pendingActionRef.current = null;
    setDialogOpen(false);
  };

  const leaveWithoutSaving = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    entriesRef.current.clear();
    setDirtyVersion((value) => value + 1);
    setDialogOpen(false);
    if (!action) return;

    allowNavigationRef.current = true;
    try {
      action();
    } finally {
      window.setTimeout(() => {
        allowNavigationRef.current = false;
      }, 0);
    }
  };

  const value = useMemo<UnsavedChangesContextValue>(
    () => ({
      hasUnsavedChanges,
      registerUnsavedChanges,
      confirmIfNeeded: requestConfirmation,
    }),
    [hasUnsavedChanges, registerUnsavedChanges, requestConfirmation],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <CafeSmartModal
        open={dialogOpen}
        onClose={continueEditing}
        labelledById="unsaved-changes-dialog-title"
        title={activeEntry?.title ?? DEFAULT_TITLE}
        description={activeEntry?.message ?? DEFAULT_MESSAGE}
      >
        <div className="space-y-4">
          <p className="text-sm font-semibold leading-6 text-slate-600 dark:text-slate-200">
            {activeEntry?.message ?? DEFAULT_MESSAGE}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={continueEditing}
              className={`${primaryButtonClass} min-h-[44px] rounded-[14px] text-sm`}
            >
              Seguir editando
            </button>
            <button
              type="button"
              onClick={leaveWithoutSaving}
              className={`${secondaryButtonClass} min-h-[44px] rounded-[14px] text-sm`}
            >
              Salir sin guardar
            </button>
          </div>
        </div>
      </CafeSmartModal>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges(
  id: string,
  active: boolean,
  options?: Omit<UnsavedEntry, 'active'>,
) {
  const context = useContext(UnsavedChangesContext);

  useEffect(() => {
    if (!context) return undefined;
    context.registerUnsavedChanges(id, active ? { active, ...options } : null);
    return () => context.registerUnsavedChanges(id, null);
  }, [active, context, id, options?.message, options?.title]);

  return context;
}
