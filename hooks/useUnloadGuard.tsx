'use client';

/**
 * @file hooks/useUnloadGuard.tsx
 * @description
 * Protege o conferente de perder trabalho ao recarregar ou fechar a página.
 *
 * O aviso só aparece quando há algo a perder — contagem digitada e ainda não
 * salva. Bloquear sempre treina o usuário a clicar em "sair" sem ler.
 *
 * São dois mecanismos complementares:
 * - `beforeunload`: diálogo nativo do navegador (fechar aba, voltar, navegar);
 * - `F5` / `Ctrl+R`: interceptado para exibir o diálogo próprio do app, que
 *   explica o risco em português claro.
 *
 * O provedor fica no layout (o modal é global) e cada tela registra seu próprio
 * predicado com `useUnloadGuard`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type Predicate = () => boolean;

interface UnloadGuardContextValue {
    /** Registra o predicado da tela ativa. Devolve a função de baixa. */
    register: (predicate: Predicate) => () => void;
}

const UnloadGuardContext = createContext<UnloadGuardContextValue | null>(null);

/**
 * Detecta o atalho de recarregar página.
 */
function isReloadShortcut(event: KeyboardEvent): boolean {
    return event.key === 'F5'
        || ((event.key === 'r' || event.key === 'R') && (event.ctrlKey || event.metaKey));
}

export function UnloadGuardProvider({ children }: { children: ReactNode }) {
    const predicateRef = useRef<Predicate>(() => false);
    const saidaPermitidaRef = useRef(false);
    const [modalVisivel, setModalVisivel] = useState(false);

    const register = useCallback((predicate: Predicate) => {
        predicateRef.current = predicate;
        return () => {
            if (predicateRef.current === predicate) predicateRef.current = () => false;
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (!isReloadShortcut(event)) return;
            if (!predicateRef.current()) return; // Sem risco: deixa recarregar.

            event.preventDefault();
            setModalVisivel(true);
        };

        const onBeforeUnload = (event: BeforeUnloadEvent) => {
            if (saidaPermitidaRef.current || !predicateRef.current()) return;

            // Navegadores modernos ignoram a mensagem e exibem um texto
            // próprio; `returnValue` continua sendo necessário para acionar o
            // diálogo.
            event.preventDefault();
            event.returnValue = 'Há quantidades digitadas que ainda não foram salvas.';
            return event.returnValue;
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('beforeunload', onBeforeUnload);

        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, []);

    const value = useMemo<UnloadGuardContextValue>(() => ({ register }), [register]);

    return (
        <UnloadGuardContext.Provider value={value}>
            {children}

            {modalVisivel && (
                <div
                    className="modal-overlay modal-overlay--visible"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirm-exit-title"
                >
                    <div className="modal-box">
                        <h4 id="confirm-exit-title">Recarregar a página?</h4>
                        <p>Há quantidades digitadas que ainda não foram salvas. Elas serão perdidas.</p>
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="modal-button modal-button--danger"
                                onClick={() => {
                                    saidaPermitidaRef.current = true;
                                    setModalVisivel(false);
                                    window.location.reload();
                                }}
                            >
                                Sim, recarregar
                            </button>
                            <button
                                type="button"
                                className="modal-button modal-button--neutral"
                                onClick={() => setModalVisivel(false)}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UnloadGuardContext.Provider>
    );
}

/**
 * Registra o predicado de "trabalho não salvo" da tela atual.
 *
 * @param predicate Retorna `true` quando há trabalho não salvo. Avaliado a cada
 *   tentativa de saída, então pode ler o DOM ou refs sem virar dependência.
 */
export function useUnloadGuard(predicate: Predicate): void {
    const context = useContext(UnloadGuardContext);
    if (!context) throw new Error('useUnloadGuard precisa estar dentro de <UnloadGuardProvider>.');

    const { register } = context;
    const predicateRef = useRef(predicate);

    // O predicado é recriado a cada render da tela; guardá-lo em uma ref evita
    // registrar de novo no guardião a cada renderização.
    useEffect(() => { predicateRef.current = predicate; }, [predicate]);

    useEffect(() => register(() => predicateRef.current()), [register]);
}
