'use client';

/**
 * @file components/SyncStatus.tsx
 * @description
 * Selo fixo no canto da tela mostrando conexão e fila de sincronização.
 *
 * É a única resposta visual que o conferente tem para "meu trabalho já subiu?".
 * Reage aos eventos de `lib/sync.ts`; não consulta o banco por conta própria.
 */
import { useEffect, useState } from 'react';
import { useSync } from '@/hooks/useSync';
import { MaterialIcon } from './MaterialIcon';

/** Tempo que o estado "sincronizado" fica visível antes de sumir (ms). */
const SUCCESS_VISIBLE_MS = 2500;

/** Aparências possíveis do selo. */
const STATES = {
    OFFLINE: { modifier: 'offline', icon: 'cloud_off', label: 'Sem conexão' },
    SYNCING: { modifier: 'syncing', icon: 'sync', label: 'Sincronizando...' },
    PENDING: { modifier: 'pending', icon: 'cloud_queue', label: 'pendente(s)' },
    SYNCED: { modifier: 'online', icon: 'cloud_done', label: 'Tudo sincronizado' },
} as const;

interface Aparencia {
    modifier: string;
    icon: string;
    label: string;
    autoHide: boolean;
}

/**
 * Escolhe o estado a exibir a partir da conexão e da fila pendente.
 */
function resolver(isOnline: boolean, isSyncing: boolean, pending: number): Aparencia {
    if (isSyncing) {
        return { ...STATES.SYNCING, autoHide: false };
    }

    if (!isOnline) {
        return {
            ...STATES.OFFLINE,
            label: pending > 0 ? `Sem conexão · ${pending} pendente(s)` : STATES.OFFLINE.label,
            autoHide: false,
        };
    }

    if (pending > 0) {
        return { ...STATES.PENDING, label: `${pending} ${STATES.PENDING.label}`, autoHide: false };
    }

    return { ...STATES.SYNCED, autoHide: true };
}

export function SyncStatus() {
    const { isOnline, isSyncing, pending } = useSync();

    const aparencia = resolver(isOnline, isSyncing, pending);

    // Identifica o estado exibido no momento. Guardar a chave — em vez de um
    // booleano — faz o selo reaparecer sozinho quando o estado muda, sem
    // precisar de um `setState` no corpo do efeito.
    const chave = `${aparencia.modifier}|${aparencia.label}`;
    const [chaveOculta, setChaveOculta] = useState<string | null>(null);

    useEffect(() => {
        if (!aparencia.autoHide) return;

        const timer = setTimeout(() => setChaveOculta(chave), SUCCESS_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [aparencia.autoHide, chave]);

    if (aparencia.autoHide && chaveOculta === chave) return null;

    return (
        <div className={`sync-status sync-status--${aparencia.modifier}`} role="status" aria-live="polite">
            <MaterialIcon name={aparencia.icon} />
            <span className="sync-status__text">{aparencia.label}</span>
        </div>
    );
}
