/**
 * @file lib/logger.ts
 * @description
 * Registro de mensagens no console com escopo por módulo.
 *
 * Em produção (`config.DEBUG === false`) apenas `warn` e `error` são emitidos,
 * mantendo o console limpo no dispositivo do usuário sem exigir que o código de
 * origem seja alterado.
 *
 * @example
 * const log = createLogger('SyncManager');
 * log.info('Sincronizando %d registros', total);
 */
import { config } from './config';

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}

const noop = () => { };

/**
 * Vincula um método do console a um prefixo de escopo.
 *
 * @param level Nível da mensagem.
 * @param scope Nome do módulo de origem.
 */
function bind(level: Level, scope: string) {
    const method = console[level] || console.log;
    if (!method) return noop;
    return method.bind(console, `[${scope}]`);
}

/**
 * Cria um logger com escopo.
 *
 * @param scope Nome do módulo de origem (ex.: `'ItensView'`).
 */
export function createLogger(scope: string): Logger {
    // Avaliado a cada chamada porque `DEBUG` depende do hostname, conhecido
    // apenas no navegador.
    return {
        debug: (...args) => (config.DEBUG ? bind('debug', scope)(...args) : undefined),
        info: (...args) => (config.DEBUG ? bind('info', scope)(...args) : undefined),
        warn: (...args) => bind('warn', scope)(...args),
        error: (...args) => bind('error', scope)(...args),
    };
}

/** Logger padrão da aplicação. */
export const logger = createLogger('App');
