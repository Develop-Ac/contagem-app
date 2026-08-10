/**
 * @file lib/config.ts
 * @description
 * Ponto único de verdade para configuração da aplicação: endereços de API,
 * tempos limite, chaves de armazenamento e versões de schema.
 *
 * Nenhum outro módulo deve conter valores fixos de ambiente. Se você precisa
 * de uma constante que muda entre desenvolvimento e produção, ela mora aqui.
 */

/**
 * URL da API definida no `.env` (`NEXT_PUBLIC_API_BASE_URL`).
 *
 * É a fonte preferencial: quando preenchida, vale para qualquer ambiente. Sem
 * ela, o endereço é deduzido do hostname (ver `ENVIRONMENTS` abaixo), o que
 * mantém o app funcionando mesmo em um deploy sem variáveis configuradas.
 *
 * A leitura é literal de propósito: o Next só substitui `process.env.NOME` no
 * bundle do navegador quando o nome aparece escrito por extenso.
 */
const API_BASE_URL_FROM_ENV = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || null;

/** Hostnames considerados ambiente de desenvolvimento. */
const DEV_HOSTNAMES = ['localhost', '127.0.0.1', ''];

/** Remove a barra final: todas as rotas de `lib/api.ts` já começam com `/`. */
function semBarraFinal(url: string): string {
    return url.replace(/\/+$/, '');
}

export type Environment = 'development' | 'production';

/** Configuração por ambiente. */
const ENVIRONMENTS: Record<Environment, { API_BASE_URL: string }> = {
    development: {
        API_BASE_URL: 'http://localhost:8000',
    },
    production: {
        API_BASE_URL: 'http://estoque-service.acacessorios.local',
    },
};

/**
 * Detecta o ambiente pelo hostname.
 *
 * Durante a renderização no servidor não existe `window`; assumimos produção,
 * porque nenhuma chamada de rede acontece nessa fase.
 */
function detectEnvironment(): Environment {
    if (typeof window === 'undefined') return 'production';
    return DEV_HOSTNAMES.indexOf(window.location.hostname) !== -1
        ? 'development'
        : 'production';
}

/**
 * Configuração efetiva da aplicação.
 *
 * `ENVIRONMENT`, `API_BASE_URL` e `DEBUG` são getters porque dependem do
 * hostname, que só existe no navegador.
 */
export const config = {
    /** Versão da aplicação. Usada no cache do Service Worker. */
    VERSION: '2.0.0',

    /** Ambiente detectado: `'development'` ou `'production'`. */
    get ENVIRONMENT(): Environment {
        return detectEnvironment();
    },

    /** URL base da API de estoque, sem barra final. */
    get API_BASE_URL(): string {
        return semBarraFinal(
            API_BASE_URL_FROM_ENV || ENVIRONMENTS[detectEnvironment()].API_BASE_URL,
        );
    },

    /** Quando `true`, logs de nível `debug`/`info` aparecem no console. */
    get DEBUG(): boolean {
        return detectEnvironment() === 'development';
    },

    /** Tempo limite (ms) para qualquer requisição HTTP. */
    REQUEST_TIMEOUT: 30000,

    /** Código da empresa usado nas consultas de estoque. */
    EMPRESA_ID: 3,

    /** Banco local (IndexedDB via Dexie). */
    DATABASE: {
        NAME: 'ContagemAppDB',
        /** Incremente ao alterar o schema em `lib/database.ts`. */
        VERSION: 5,
    },

    /**
     * Chaves do `localStorage`.
     * Mantidas sem prefixo por compatibilidade com versões já instaladas.
     */
    STORAGE_KEYS: {
        USER: 'currentUser',
        CONTAGEM: 'currentContagem',
    },

    /** Comportamento do sincronizador offline. */
    SYNC: {
        /** Espera antes da primeira tentativa de sincronização (ms). */
        STARTUP_DELAY_MS: 2000,
        /** Falhas seguidas que interrompem a rodada atual de sincronização. */
        MAX_CONSECUTIVE_FAILURES: 3,
    },

    /** Habilita o registro do Service Worker (cache do app shell). */
    SERVICE_WORKER_ENABLED: true,
} as const;
