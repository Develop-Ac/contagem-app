'use client';

/**
 * @file hooks/useSync.ts
 * @description
 * Ponte entre o sincronizador (`lib/sync.ts`) e os componentes React.
 *
 * O `SyncManager` continua sendo a única autoridade sobre a fila; este hook
 * apenas escuta os eventos que ele dispara em `window` e devolve o estado
 * pronto para renderização.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { SYNC_EVENTS, sync } from '@/lib/sync';
import type { SyncSummary } from '@/lib/types';

export interface SyncState {
    /** Dispositivo conectado. */
    isOnline: boolean;
    /** Uma rodada de envio está em andamento. */
    isSyncing: boolean;
    /** Registros aguardando envio. */
    pending: number;
    /** Executa uma rodada de sincronização. */
    triggerSync: (reason?: string) => Promise<SyncSummary>;
}

/**
 * Observa os eventos do sincronizador.
 *
 * Função de módulo (referência estável) porque `useSyncExternalStore` reinscreve
 * sempre que a função de inscrição muda de identidade.
 */
function subscribeSyncEvents(listener: () => void): () => void {
    window.addEventListener(SYNC_EVENTS.NETWORK, listener);
    window.addEventListener(SYNC_EVENTS.START, listener);
    window.addEventListener(SYNC_EVENTS.END, listener);

    return () => {
        window.removeEventListener(SYNC_EVENTS.NETWORK, listener);
        window.removeEventListener(SYNC_EVENTS.START, listener);
        window.removeEventListener(SYNC_EVENTS.END, listener);
    };
}

const getIsOnline = () => sync.isOnline;
const getIsSyncing = () => sync.isSyncing;

/** Assume conexão na renderização do servidor: é o estado mais comum. */
const getIsOnlineServer = () => true;
const getIsSyncingServer = () => false;

/**
 * Observa o estado da fila de sincronização.
 *
 * Pode ser usado em qualquer componente: os eventos são globais e o hook não
 * mantém estado compartilhado.
 */
export function useSync(): SyncState {
    const isOnline = useSyncExternalStore(subscribeSyncEvents, getIsOnline, getIsOnlineServer);
    const isSyncing = useSyncExternalStore(subscribeSyncEvents, getIsSyncing, getIsSyncingServer);

    // A contagem de pendentes exige uma consulta ao IndexedDB, então não cabe
    // em um instantâneo síncrono: é recalculada a cada evento.
    const [pending, setPending] = useState(0);

    useEffect(() => {
        let ativo = true;

        const atualizar = () => {
            sync.countPending().then((total) => {
                if (ativo) setPending(total);
            });
        };

        atualizar();
        const unsubscribe = subscribeSyncEvents(atualizar);

        return () => {
            ativo = false;
            unsubscribe();
        };
    }, []);

    const triggerSync = useCallback((reason?: string) => sync.triggerSync(reason), []);

    return { isOnline, isSyncing, pending, triggerSync };
}
