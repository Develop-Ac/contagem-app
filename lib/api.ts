/**
 * @file lib/api.ts
 * @description
 * Contrato com o backend (API Estoque Service).
 *
 * Este é o único módulo que conhece rotas, formatos de payload e nomes de
 * campos da API. Telas e hooks chamam funções nomeadas daqui — nunca `fetch`
 * diretamente. Quando um endpoint muda, muda só este arquivo.
 *
 * Todas as funções lançam `HttpError` em caso de falha.
 */
import { config } from './config';
import { http } from './http';
import type { Contagem, LoginResponse } from './types';

/**
 * Monta uma URL absoluta a partir de um caminho relativo da API.
 *
 * @param path Caminho iniciado por `/`.
 */
function url(path: string): string {
    return `${config.API_BASE_URL}${path}`;
}

export interface AtualizarItemPayload {
    /** `true` mantém o item na lista de conferência. */
    conferir: boolean;
    /** Identificador do item. */
    itemId: string | number;
}

export interface LiberarContagemPayload {
    /** Identificador único da contagem. */
    contagem_cuid: string;
    /** Número da contagem. */
    contagem: number;
    /** `true` se algum item divergiu do sistema. */
    divergencia: boolean;
    /** Itens que não puderam ser conferidos online. */
    itensParaRevalidar: Array<string | number>;
}

export interface EnviarLogPayload {
    contagem_id: string | number;
    usuario_id: string | number;
    item_id: string | number;
    identificador_item: string;
    estoque: number;
    contado: number;
}

export const api = {
    /** Autentica um conferente. */
    login(codigo: string, senha: string) {
        return http.post<LoginResponse>(url('/login'), { codigo, senha });
    },

    /** Lista as contagens atribuídas a um usuário. */
    listarContagens(usuarioId: string | number) {
        return http.get<Contagem[]>(url(`/estoque/contagem/${usuarioId}`));
    },

    /** Consulta o estoque atual de um produto no sistema. */
    consultarEstoque(codProduto: string | number) {
        return http.get<{ ESTOQUE: number }>(
            url(`/estoque/contagem/conferir/${codProduto}?empresa=${config.EMPRESA_ID}`),
        );
    },

    /** Marca um item como conferido ou pendente de nova conferência. */
    atualizarItem(identificadorItem: string, payload: AtualizarItemPayload) {
        return http.put(url(`/estoque/contagem/item/${identificadorItem}`), payload);
    },

    /** Conclui (libera) uma contagem. */
    liberarContagem(payload: LiberarContagemPayload) {
        return http.put(url('/estoque/contagem/liberar'), payload);
    },

    /** Envia um log de contagem registrado no dispositivo. */
    enviarLog(payload: EnviarLogPayload) {
        return http.post(url('/estoque/contagem/log'), payload);
    },
};
