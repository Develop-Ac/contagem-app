'use client';

/**
 * @file hooks/useToast.tsx
 * @description
 * Mensagens curtas de retorno ao usuário (snackbar).
 *
 * O conferente precisa ver o retorno de "item salvo" mesmo quando a rede
 * falhou, então a mensagem é sempre local e nunca depende de rede.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** Duração padrão de exibição (ms). */
const DEFAULT_TIMEOUT = 3000;

/** Duração das mensagens de erro (ficam um pouco mais na tela). */
const ERROR_TIMEOUT = 5000;

export interface ToastOptions {
    /** Duração em ms. */
    timeout?: number;
    /** Rótulo do botão de ação. */
    actionText?: string;
    /** Ação do botão. */
    actionHandler?: () => void;
}

interface ToastState {
    message: string;
    actionText?: string;
    actionHandler?: () => void;
}

interface ToastContextValue {
    /** Exibe uma mensagem. */
    show: (message: string, options?: ToastOptions) => void;
    /** Exibe uma mensagem de erro. */
    error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<ToastState | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dismiss = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setToast(null);
    }, []);

    const show = useCallback((message: string, options: ToastOptions = {}) => {
        if (timerRef.current) clearTimeout(timerRef.current);

        setToast({
            message,
            actionText: options.actionText,
            actionHandler: options.actionHandler,
        });

        timerRef.current = setTimeout(() => setToast(null), options.timeout || DEFAULT_TIMEOUT);
    }, []);

    const error = useCallback((message: string) => {
        show(message, { timeout: ERROR_TIMEOUT });
    }, [show]);

    useEffect(() => () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    const value = useMemo<ToastContextValue>(() => ({ show, error }), [show, error]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className={`snackbar${toast ? ' snackbar--active' : ''}`} aria-live="polite">
                <div className="snackbar__text">{toast?.message ?? ''}</div>
                {toast?.actionText && (
                    <button
                        type="button"
                        className="snackbar__action"
                        onClick={() => {
                            toast.actionHandler?.();
                            dismiss();
                        }}
                    >
                        {toast.actionText}
                    </button>
                )}
            </div>
        </ToastContext.Provider>
    );
}

/** Acessa o emissor de mensagens curtas. */
export function useToast(): ToastContextValue {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
    return context;
}
