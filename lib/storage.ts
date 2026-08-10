/**
 * @file lib/storage.ts
 * @description
 * Camada fina sobre `localStorage` com serialização JSON e tolerância a falhas.
 *
 * O `localStorage` pode lançar exceções (modo privativo, cota cheia, conteúdo
 * corrompido de uma versão anterior). Nenhuma dessas situações deve derrubar a
 * aplicação: aqui elas viram um aviso no console e um valor padrão.
 */
import { createLogger } from './logger';

const log = createLogger('Storage');

export const storage = {
    /**
     * Lê e desserializa um valor.
     *
     * @param key Chave (use `config.STORAGE_KEYS`).
     * @param fallback Valor devolvido se ausente ou inválido.
     */
    get<T>(key: string, fallback: T | null = null): T | null {
        if (typeof window === 'undefined') return fallback;

        try {
            const raw = localStorage.getItem(key);
            if (raw === null) return fallback;
            return JSON.parse(raw) as T;
        } catch (error) {
            log.warn(`Valor inválido em "${key}", descartando.`, error);
            this.remove(key);
            return fallback;
        }
    },

    /**
     * Serializa e grava um valor.
     *
     * @returns `true` se a gravação foi concluída.
     */
    set(key: string, value: unknown): boolean {
        if (typeof window === 'undefined') return false;

        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            log.error(`Não foi possível gravar "${key}".`, error);
            return false;
        }
    },

    /** Remove uma chave. */
    remove(key: string): void {
        if (typeof window === 'undefined') return;

        try {
            localStorage.removeItem(key);
        } catch (error) {
            log.warn(`Não foi possível remover "${key}".`, error);
        }
    },
};
