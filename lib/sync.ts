/**
 * @file lib/sync.ts
 * @description
 * Sincronização da fila offline com a API.
 *
 * O aplicativo é *offline-first*: toda contagem é gravada primeiro no banco
 * local e só depois enviada. Este módulo é quem drena essa fila — ao voltar a
 * conexão, na abertura do app e a cada item salvo.
 *
 * Notifica a interface por eventos disparados em `window` (ver `SYNC_EVENTS`);
 * nenhum componente é manipulado diretamente daqui.
 */
import { config } from './config';
import { getDatabase } from './database';
import { api } from './api';
import { createLogger } from './logger';
import type { ContagemLog, SyncSummary } from './types';

const log = createLogger('Sync');

/** Eventos emitidos em `window`. */
export const SYNC_EVENTS = {
    /** Conexão mudou. `detail: { online: boolean }` */
    NETWORK: 'sync:network',
    /** Uma rodada de sincronização começou. Sem `detail`. */
    START: 'sync:start',
    /** Rodada encerrada. `detail: { sent, failed, pending }` */
    END: 'sync:end',
} as const;

/** Gerencia o estado de rede e o envio da fila de logs. */
class SyncManager {
    /** Indica se uma rodada está em andamento. */
    isSyncing = false;
    /** Indica se o dispositivo está conectado. */
    isOnline = true;
    /** Momento da última sincronização bem-sucedida. */
    lastSyncAt: number | null = null;
    /** Impede o registro duplicado dos listeners de rede. */
    private started = false;

    /** Ativa os listeners de rede e agenda a primeira sincronização. */
    start(): void {
        if (this.started || typeof window === 'undefined') return;
        this.started = true;

        this.isOnline = navigator.onLine;

        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));

        this.emit(SYNC_EVENTS.NETWORK, { online: this.isOnline });

        if (this.isOnline) {
            setTimeout(() => this.triggerSync('inicialização'), config.SYNC.STARTUP_DELAY_MS);
        }
    }

    /**
     * Executa uma rodada de sincronização, se houver condições.
     *
     * Chamadas concorrentes são ignoradas: a rodada em andamento já vai enviar
     * tudo o que estiver pendente no momento em que ler a fila.
     *
     * @param reason Origem da chamada (para diagnóstico).
     */
    async triggerSync(reason = 'manual'): Promise<SyncSummary> {
        const summary: SyncSummary = { sent: 0, failed: 0, pending: 0 };

        if (this.isSyncing || !this.isOnline) return summary;

        this.isSyncing = true;
        this.emit(SYNC_EVENTS.START);

        try {
            const pendingLogs = await getDatabase().getPendingLogs();

            if (pendingLogs.length === 0) {
                log.debug('Nada a sincronizar.');
                return summary;
            }

            log.info(`Sincronizando ${pendingLogs.length} registro(s) [${reason}].`);

            let consecutiveFailures = 0;

            for (const entry of pendingLogs) {
                const sent = await this.sendLog(entry);

                if (sent) {
                    summary.sent++;
                    consecutiveFailures = 0;
                    continue;
                }

                summary.failed++;
                consecutiveFailures++;

                // Falhas seguidas indicam servidor fora do ar ou conexão
                // instável: paramos a rodada para não esgotar a bateria
                // repetindo requisições que vão falhar do mesmo jeito.
                if (consecutiveFailures >= config.SYNC.MAX_CONSECUTIVE_FAILURES) {
                    log.warn('Muitas falhas seguidas; rodada interrompida.');
                    break;
                }
            }

            if (summary.sent > 0) this.lastSyncAt = Date.now();
            log.info(`Rodada concluída. Enviados: ${summary.sent}, falhas: ${summary.failed}.`);

            return summary;
        } catch (error) {
            log.error('Erro inesperado durante a sincronização.', error);
            return summary;
        } finally {
            this.isSyncing = false;
            summary.pending = await this.countPending();
            this.emit(SYNC_EVENTS.END, summary);
        }
    }

    /** Conta os registros que ainda não foram enviados. */
    async countPending(): Promise<number> {
        try {
            return await getDatabase().countPendingLogs();
        } catch (error) {
            log.warn('Não foi possível contar os registros pendentes.', error);
            return 0;
        }
    }

    /**
     * Envia um único log e atualiza seu estado no banco.
     *
     * @returns `true` se a API confirmou o recebimento.
     */
    private async sendLog(entry: ContagemLog): Promise<boolean> {
        try {
            await api.enviarLog({
                contagem_id: entry.contagem_id,
                usuario_id: entry.usuario_id,
                item_id: entry.item_id,
                identificador_item: entry.identificador_item,
                estoque: entry.estoque,
                contado: entry.contado,
            });

            await getDatabase().markLogSynced(entry.id!);
            return true;
        } catch (error) {
            log.warn(`Falha ao enviar o log #${entry.id}.`, error);

            await getDatabase().registerLogFailure(
                entry.id!,
                (entry.attempts || 0) + 1,
                (error as Error).message || 'Erro desconhecido',
            );

            return false;
        }
    }

    /** Reage à mudança de conectividade do dispositivo. */
    private handleNetworkChange(online: boolean): void {
        this.isOnline = online;
        log.info(online ? 'Conexão restabelecida.' : 'Sem conexão.');

        this.emit(SYNC_EVENTS.NETWORK, { online });

        if (online) this.triggerSync('reconexão');
    }

    /** Dispara um evento da aplicação em `window`. */
    private emit(name: string, detail: unknown = {}): void {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(name, { detail }));
    }
}

/** Instância única usada por toda a aplicação. */
export const sync = new SyncManager();
