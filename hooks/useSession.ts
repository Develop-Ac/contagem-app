'use client';

/**
 * @file hooks/useSession.ts
 * @description
 * Ponte entre o store de sessão (`lib/session.ts`) e os componentes React.
 *
 * As ações são funções de módulo — referências estáveis, seguras de usar em
 * listas de dependências de efeitos.
 */
import { useSyncExternalStore } from 'react';
import { sessionStore, type SessionState } from '@/lib/session';

export interface SessionValue extends SessionState {
    /** Indica se há um usuário autenticado com identificador válido. */
    isAutenticado: boolean;
    /** Define o usuário autenticado e persiste a sessão. */
    setUsuario: typeof sessionStore.setUsuario;
    /** Define a contagem aberta e persiste para sobreviver a um recarregamento. */
    setContagem: typeof sessionStore.setContagem;
    /** Fecha a contagem aberta (volta para a lista de tarefas). */
    clearContagem: typeof sessionStore.clearContagem;
    /** Encerra a sessão: limpa usuário e contagem, em memória e no disco. */
    clear: typeof sessionStore.clear;
}

/** Acessa a sessão do conferente. */
export function useSession(): SessionValue {
    const state = useSyncExternalStore(
        sessionStore.subscribe,
        sessionStore.getSnapshot,
        sessionStore.getServerSnapshot,
    );

    return {
        ...state,
        isAutenticado: Boolean(state.usuario && state.usuario.id),
        setUsuario: sessionStore.setUsuario,
        setContagem: sessionStore.setContagem,
        clearContagem: sessionStore.clearContagem,
        clear: sessionStore.clear,
    };
}
