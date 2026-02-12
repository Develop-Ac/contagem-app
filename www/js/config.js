/**
 * Configuração Global da Aplicação
 * Centraliza variáveis de ambiente para facilitar a gestão entre dev/prod.
 */
window.APP_CONFIG = {
    // URL do Backend (API Estoque Service)
    // Dev: 'http://127.0.0.1:8000'
    // Prod: 'http://estoque-service.acacessorios.local'
    API_BASE_URL: 'http://127.0.0.1:8000',

    // Timeout padrão para requisições (ms)
    REQUEST_TIMEOUT: 30000
};