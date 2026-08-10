/**
 * @file public/service-worker.js
 * @description
 * Cache do *app shell*, para que o aplicativo abra mesmo sem conexão.
 *
 * Os dados da contagem NÃO passam por aqui — eles vivem no IndexedDB
 * (`lib/database.ts`) e são sincronizados por `lib/sync.ts`. Este arquivo cuida
 * apenas dos arquivos estáticos: HTML, CSS, JavaScript e ícones.
 *
 * ## Estratégias
 *
 * | Tipo de requisição            | Estratégia                                    |
 * |-------------------------------|-----------------------------------------------|
 * | Chamadas à API                | Somente rede (nunca cacheadas)                |
 * | Navegação e bundles do Next   | Rede primeiro, cache como reserva             |
 * | Ícones e imagens              | Cache primeiro                                |
 * | Fontes e ícones do Google     | Cache com revalidação em segundo plano        |
 *
 * ## Diferença em relação à versão sem build
 *
 * O Next.js gera os nomes dos bundles a cada build, então não existe uma lista
 * fixa de arquivos para pré-cachear: o app shell é preenchido conforme as
 * páginas são visitadas. Ao publicar uma nova versão, incremente
 * `CACHE_VERSION` (e `VERSION` em `lib/config.ts`) — caches antigos são
 * apagados automaticamente na ativação.
 */

/** Precisa ser incrementado a cada publicação. */
const CACHE_VERSION = 'v2.0.0';
const CACHE_NAME = `contagem-app-${CACHE_VERSION}`;

/** Rotas mínimas para abrir o aplicativo sem rede. */
const APP_SHELL = ['/', '/login', '/contagens', '/itens', '/manifest.json'];

/** Prefixos de caminho que pertencem à API e nunca devem ser cacheados. */
const API_PATH_PREFIXES = ['/estoque', '/login/'];

/** Domínios de terceiros servidos com revalidação em segundo plano. */
const THIRD_PARTY_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            // `addAll` falha por inteiro se um recurso não responder; aqui cada
            // rota é independente, então uma falha isolada não impede a
            // instalação.
            .then((cache) => Promise.all(APP_SHELL.map((path) => cache.add(path).catch(() => null))))
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
            ))
            .then(() => self.clients.claim()),
    );
});

/**
 * Indica se a requisição é para a API de estoque.
 */
function isApiRequest(url) {
    return API_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

/**
 * Rede primeiro, com o cache como reserva.
 */
async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;

        // Navegação sem rede e sem a página em cache: devolve a raiz do app.
        if (request.mode === 'navigate') {
            const shell = await cache.match('/');
            if (shell) return shell;
        }

        throw error;
    }
}

/**
 * Cache primeiro, buscando na rede apenas o que ainda não está guardado.
 */
async function cacheFirst(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
}

/**
 * Devolve o cache imediatamente e atualiza em segundo plano.
 */
async function staleWhileRevalidate(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const atualizacao = fetch(request)
        .then((response) => {
            if (response && response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);

    return cached || atualizacao;
}

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    if (THIRD_PARTY_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }

    if (url.origin !== self.location.origin) return;

    // A contagem é a informação mais sensível do app: nunca serve dado velho.
    if (isApiRequest(url)) return;

    if (request.destination === 'image' || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/assets/')) {
        event.respondWith(cacheFirst(request));
        return;
    }

    event.respondWith(networkFirst(request));
});
