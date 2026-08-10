'use client';

/**
 * @file components/AppProviders.tsx
 * @description
 * Inicialização da aplicação e montagem dos provedores globais.
 *
 * Equivale ao `main.js` do aplicativo original. Ordem de inicialização (a
 * dependência é real, não estética):
 * 1. banco local — as telas leem dados dele já na primeira renderização;
 * 2. sincronizador — dispara os eventos que o selo de status precisa ouvir;
 * 3. Service Worker — cache do app shell.
 */
import { useEffect, type ReactNode } from 'react';
import { ToastProvider, useToast } from '@/hooks/useToast';
import { UnloadGuardProvider } from '@/hooks/useUnloadGuard';
import { config } from '@/lib/config';
import { getDatabase } from '@/lib/database';
import { createLogger } from '@/lib/logger';
import { sync } from '@/lib/sync';
import { AppHeader } from './AppHeader';
import { SyncStatus } from './SyncStatus';

const log = createLogger('Main');

/**
 * Registra o Service Worker responsável pelo cache do app shell.
 *
 * Só é registrado sob `http`/`https`: em `file://` o navegador recusa, e o erro
 * só polui o console.
 */
function registrarServiceWorker() {
    if (!config.SERVICE_WORKER_ENABLED) return;
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    navigator.serviceWorker.register('/service-worker.js')
        .then(() => log.info('Service Worker registrado.'))
        .catch((error) => log.warn('Falha ao registrar o Service Worker.', error));
}

/** Executa o bootstrap uma única vez, já com o toast disponível. */
function AppBootstrap({ children }: { children: ReactNode }) {
    const toast = useToast();

    useEffect(() => {
        let ativo = true;

        const bootstrap = async () => {
            log.info(`Contagem App v${config.VERSION} (${config.ENVIRONMENT})`);
            log.info(`API: ${config.API_BASE_URL}`);

            const bancoDisponivel = await getDatabase().openDatabase();
            if (ativo && !bancoDisponivel) {
                toast.error('Armazenamento local indisponível. As contagens não serão salvas offline.');
            }

            sync.start();
            registrarServiceWorker();
        };

        bootstrap().catch((error) => {
            log.error('Falha na inicialização da aplicação.', error);
            toast.error('Erro ao iniciar o aplicativo. Recarregue a página.');
        });

        return () => { ativo = false; };
    }, [toast]);

    return <>{children}</>;
}

export function AppProviders({ children }: { children: ReactNode }) {
    return (
        <ToastProvider>
            <UnloadGuardProvider>
                <AppBootstrap>
                    <AppHeader />
                    <main className="app-content">{children}</main>
                    <SyncStatus />
                </AppBootstrap>
            </UnloadGuardProvider>
        </ToastProvider>
    );
}
