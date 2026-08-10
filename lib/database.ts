/**
 * @file lib/database.ts
 * @description
 * Banco local (IndexedDB via Dexie). É a fonte da verdade offline do app.
 *
 * ## Tabelas
 *
 * | Tabela      | Conteúdo                                                        |
 * |-------------|-----------------------------------------------------------------|
 * | `logs`      | Fila de contagens registradas no dispositivo (offline-first).    |
 * | `app_cache` | Respostas da API guardadas para uso sem conexão.                 |
 *
 * ## Ciclo de vida de um log
 *
 * 1. O conferente salva um item → `addLog()` grava com `synced = 0`.
 * 2. O sincronizador envia à API → `markLogSynced()` marca `synced = 1`.
 * 3. A contagem é concluída → `deleteLogsByContagem()` limpa o histórico local.
 *
 * Registros já sincronizados são mantidos até o passo 3 de propósito: é o que
 * permite reabrir a contagem e continuar vendo as quantidades digitadas.
 */
import Dexie, { type Table } from 'dexie';
import { config } from './config';
import { createLogger } from './logger';
import type { ContagemLog, ContagemReference } from './types';

const log = createLogger('Database');

interface CacheEntry {
    key: string;
    data: unknown;
    timestamp: number;
}

/** Acesso ao banco local. */
class LocalDatabase extends Dexie {
    logs!: Table<ContagemLog, number>;
    app_cache!: Table<CacheEntry, string>;

    constructor() {
        super(config.DATABASE.NAME);

        // Versão 4: schema herdado das versões 1.x do aplicativo.
        this.version(4).stores({
            logs: '++id, contagem_id, contagem_num, item_id, synced, creationTime',
            app_cache: 'key',
        });

        // Versão 5: índice em `identificador_item` (necessário para atualizar
        // o estoque real após a conferência online) e contador de tentativas.
        this.version(5).stores({
            logs: '++id, contagem_id, contagem_num, item_id, identificador_item, synced, creationTime',
            app_cache: 'key',
        }).upgrade((transaction) => transaction.table('logs').toCollection().modify((entry) => {
            if (entry.attempts === undefined) entry.attempts = 0;
            if (entry.lastError === undefined) entry.lastError = null;
        }));
    }

    /**
     * Abre a conexão com o banco.
     *
     * @returns `true` se o banco está utilizável.
     */
    async openDatabase(): Promise<boolean> {
        try {
            await this.open();
            log.info('Banco local aberto.');
            return true;
        } catch (error) {
            log.error('Falha ao abrir o banco local.', error);
            return false;
        }
    }

    // ----------------------------------------------------------------------
    // Logs de contagem
    // ----------------------------------------------------------------------

    /**
     * Grava um novo log de contagem como pendente de sincronização.
     *
     * @returns Id gerado para o log.
     */
    async addLog(data: Omit<ContagemLog, 'id' | 'synced' | 'attempts' | 'lastError' | 'creationTime'>): Promise<number> {
        const entry: ContagemLog = {
            ...data,
            synced: 0,
            attempts: 0,
            lastError: null,
            creationTime: Date.now(),
        };

        return this.logs.add(entry);
    }

    /** Lista os logs ainda não enviados à API, do mais antigo ao mais novo. */
    async getPendingLogs(): Promise<ContagemLog[]> {
        const pending = await this.logs.where('synced').equals(0).toArray();
        return pending.sort((a, b) => (a.creationTime || 0) - (b.creationTime || 0));
    }

    /** Conta quantos logs aguardam sincronização. */
    async countPendingLogs(): Promise<number> {
        return this.logs.where('synced').equals(0).count();
    }

    /**
     * Busca todos os logs de uma contagem — sincronizados ou não.
     *
     * A busca é feita por número da contagem e, adicionalmente, pelo id da
     * API. Logs gravados por versões anteriores do app podem ter sido indexados
     * apenas por um dos dois, e o tipo do id varia entre número e texto
     * conforme o endpoint.
     *
     * @returns Logs ordenados por data de criação.
     */
    async getLogsByContagem(reference: ContagemReference = {}): Promise<ContagemLog[]> {
        const collected = new Map<number, ContagemLog>();

        const absorb = (rows: ContagemLog[]) => {
            rows.forEach((row) => {
                if (row.id !== undefined) collected.set(row.id, row);
            });
        };

        for (const value of identityVariants(reference.contagemNum)) {
            absorb(await this.logs.where('contagem_num').equals(value).toArray());
        }

        for (const value of identityVariants(reference.contagemId)) {
            absorb(await this.logs.where('contagem_id').equals(value).toArray());
        }

        return Array.from(collected.values())
            .sort((a, b) => (a.creationTime || 0) - (b.creationTime || 0));
    }

    /**
     * Marca um log como sincronizado com sucesso.
     *
     * @returns Quantidade de registros alterados.
     */
    async markLogSynced(id: number): Promise<number> {
        return this.logs.update(id, { synced: 1, lastError: null });
    }

    /**
     * Registra uma falha de envio para diagnóstico.
     *
     * @returns Quantidade de registros alterados.
     */
    async registerLogFailure(id: number, attempts: number, message: string): Promise<number> {
        return this.logs.update(id, { attempts, lastError: message });
    }

    /**
     * Remove os logs de uma contagem encerrada.
     *
     * Chamado após a conclusão da contagem, para que uma contagem futura com o
     * mesmo número não reapareça preenchida com dados antigos.
     *
     * @returns Quantidade de logs removidos.
     */
    async deleteLogsByContagem(reference: ContagemReference): Promise<number> {
        const logs = await this.getLogsByContagem(reference);
        const ids = logs.map((entry) => entry.id).filter((id): id is number => id !== undefined);

        if (ids.length === 0) return 0;

        await this.logs.bulkDelete(ids);
        log.info(`${ids.length} log(s) local(is) removido(s).`);
        return ids.length;
    }

    /**
     * Atualiza o estoque gravado nos logs de um item.
     *
     * Usado quando a conferência online devolve o estoque real: o valor
     * substitui o provisório gravado no momento em que o item foi salvo.
     *
     * @returns Quantidade de logs atualizados.
     */
    async updateEstoqueByItem(identificadorItem: string, estoque: number): Promise<number> {
        if (!identificadorItem) return 0;

        return this.logs
            .where('identificador_item').equals(identificadorItem)
            .modify({ estoque });
    }

    // ----------------------------------------------------------------------
    // Cache de respostas da API
    // ----------------------------------------------------------------------

    /** Guarda uma resposta da API para uso offline. */
    async saveCache(key: string, data: unknown): Promise<string> {
        return this.app_cache.put({ key, data, timestamp: Date.now() });
    }

    /** Lê uma resposta previamente guardada. */
    async getCache<T>(key: string): Promise<T | null> {
        const record = await this.app_cache.get(key);
        return record ? (record.data as T) : null;
    }

    /** Remove uma entrada do cache. */
    async removeCache(key: string): Promise<void> {
        return this.app_cache.delete(key);
    }
}

/**
 * Gera as variações de tipo de um identificador para consulta indexada.
 *
 * O Dexie compara por tipo: o número `42` e o texto `'42'` são chaves
 * distintas. Como o app já gravou logs nos dois formatos, consultamos ambos.
 */
function identityVariants(value: string | number | null | undefined): Array<string | number> {
    if (value === null || value === undefined || value === '') return [];

    const variants: Array<string | number> = [value];
    const asNumber = Number(value);

    if (typeof value !== 'number' && !isNaN(asNumber) && String(value).trim() !== '') {
        variants.push(asNumber);
    }
    if (typeof value === 'number') {
        variants.push(String(value));
    }

    return variants;
}

/**
 * Instância única usada por toda a aplicação.
 *
 * Criada de forma preguiçosa: o Dexie toca `indexedDB` no construtor, que não
 * existe durante a renderização no servidor.
 */
let instance: LocalDatabase | null = null;

export function getDatabase(): LocalDatabase {
    if (!instance) instance = new LocalDatabase();
    return instance;
}
