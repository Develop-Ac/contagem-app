/**
 * @file lib/http.ts
 * @description
 * Cliente HTTP único da aplicação. Todo acesso à rede passa por aqui.
 *
 * Responsabilidades:
 * - aplicar o tempo limite de `config.REQUEST_TIMEOUT` (via `AbortController`);
 * - serializar/desserializar JSON;
 * - traduzir falhas em `HttpError`, com mensagem legível para o usuário.
 */
import { config } from './config';
import { createLogger } from './logger';

const log = createLogger('Http');

interface HttpErrorDetails {
    status?: number;
    url?: string;
    isTimeout?: boolean;
    isNetwork?: boolean;
    body?: unknown;
}

/** Erro de requisição HTTP com contexto para a camada de UI. */
export class HttpError extends Error {
    /** Código HTTP (0 quando não houve resposta). */
    status: number;
    /** URL requisitada. */
    url: string;
    /** Indica estouro do tempo limite. */
    isTimeout: boolean;
    /** Indica falha de rede/conexão. */
    isNetwork: boolean;
    /** Corpo da resposta de erro, quando disponível. */
    body: unknown;

    constructor(message: string, details: HttpErrorDetails = {}) {
        super(message);
        this.name = 'HttpError';
        this.status = details.status || 0;
        this.url = details.url || '';
        this.isTimeout = details.isTimeout === true;
        this.isNetwork = details.isNetwork === true;
        this.body = details.body;
    }
}

export interface RequestOptions {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
}

/**
 * Extrai a melhor mensagem de erro possível do corpo da resposta.
 */
async function readErrorPayload(response: Response): Promise<{ message: string; body: unknown }> {
    let body: unknown = null;

    try {
        body = await response.json();
    } catch {
        body = null;
    }

    const detail = body as { message?: string; error?: string; detail?: string } | null;
    const message = (detail && (detail.message || detail.error || detail.detail))
        || `Erro HTTP ${response.status}`;

    return { message, body };
}

/**
 * Executa uma requisição HTTP com JSON, tempo limite e erros normalizados.
 *
 * @throws {HttpError} Em timeout, falha de rede ou status >= 400.
 */
export async function request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T | null> {
    const timeout = options.timeout || config.REQUEST_TIMEOUT;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const init: RequestInit = {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...options.headers },
        signal: controller.signal,
    };

    if (options.body !== undefined && options.body !== null) {
        init.body = typeof options.body === 'string'
            ? options.body
            : JSON.stringify(options.body);
    }

    log.debug(`${init.method} ${url}`);

    let response: Response;
    try {
        response = await fetch(url, init);
    } catch (error) {
        const isTimeout = (error as Error).name === 'AbortError';
        throw new HttpError(
            isTimeout ? 'Tempo limite excedido. Verifique a conexão.' : 'Falha de conexão com o servidor.',
            { url, isTimeout, isNetwork: !isTimeout },
        );
    } finally {
        clearTimeout(timer);
    }

    if (!response.ok) {
        const payload = await readErrorPayload(response);
        throw new HttpError(payload.message, {
            status: response.status,
            url,
            body: payload.body,
        });
    }

    if (response.status === 204) return null;

    try {
        return (await response.json()) as T;
    } catch {
        // Resposta vazia ou não-JSON em um status de sucesso: tratamos como OK.
        log.debug('Resposta sem corpo JSON', url);
        return null;
    }
}

export const http = {
    request,

    /** Atalho para `GET`. */
    get<T = unknown>(url: string, options?: RequestOptions) {
        return request<T>(url, { ...options, method: 'GET' });
    },

    /** Atalho para `POST`. */
    post<T = unknown>(url: string, body: unknown, options?: RequestOptions) {
        return request<T>(url, { ...options, method: 'POST', body });
    },

    /** Atalho para `PUT`. */
    put<T = unknown>(url: string, body: unknown, options?: RequestOptions) {
        return request<T>(url, { ...options, method: 'PUT', body });
    },
};
