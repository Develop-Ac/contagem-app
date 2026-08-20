/**
 * @file lib/types.ts
 * @description
 * Tipos do domínio compartilhados entre a API, o banco local e as telas.
 *
 * Campos que vêm da API mantêm exatamente o nome entregue por ela
 * (`snake_case`); nada é traduzido em trânsito.
 */

/** Usuário autenticado (formato interno da aplicação). */
export interface Usuario {
    /** Identificador do usuário. */
    id: string | number;
    /** Nome de exibição. */
    nome: string;
    /** Código de acesso. */
    codigo: string;
}

/** Resposta de `POST /login`. */
export interface LoginResponse {
    success: boolean;
    usuario_id: string | number;
    usuario: string;
    codigo: string;
    message?: string | null;
}

/** Item de uma contagem, como entregue pela API. */
export interface ItemContagem {
    /** Identificador do item. */
    id: string | number;
    /** Identificador do item na API (usado no `PUT` de conferência). */
    identificador_item: string;
    /** Código do produto — agrupa localizações do mesmo produto. */
    cod_produto: string | number;
    /** Descrição do produto. */
    desc_produto: string;
    /** Endereço no estoque. */
    localizacao: string;
    /** `true` enquanto o item aguarda conferência. */
    conferir: boolean;
    /** Item com aplicação exige segunda contagem. */
    tem_aplicacao?: boolean;
}

/** Contagem atribuída a um conferente. */
export interface Contagem {
    /** Identificador da contagem. */
    id: string | number;
    /** Identificador único usado na liberação. */
    contagem_cuid: string;
    /** Número da contagem. */
    contagem: number;
    /** Piso/setor do estoque. */
    piso: string;
    /** Tipo da contagem: `1` = Diária/Rotativa, `2` = Avulsa. */
    tipo?: number;
    /** `true` quando disponível ao conferente. */
    liberado_contagem: boolean;
    /** Data de criação (ISO). */
    created_at: string;
    /** Responsável pela contagem. */
    usuario?: Usuario;
    /** Itens que compõem a contagem. */
    itens?: ItemContagem[];
}

/** Log de contagem como registrado no servidor (`GET /logs/:contagem_id`). */
export interface LogContagemServidor {
    id: string;
    contagem_id: string;
    usuario_id: string;
    /** Item conferido (id do `est_contagem_itens`). */
    item_id: string;
    estoque: number;
    contado: number;
    created_at: string;
}

/** Registro da fila offline gravado no IndexedDB. */
export interface ContagemLog {
    /** Chave primária autoincremental (gerada pelo Dexie). */
    id?: number;
    /** Identificador da contagem na API. */
    contagem_id: string | number;
    /** Número da contagem (estável entre sessões). */
    contagem_num: string | number;
    /** Usuário que realizou a contagem. */
    usuario_id: string | number;
    /** Item conferido. */
    item_id: string | number;
    /** Identificador do item na API. */
    identificador_item: string;
    /** Estoque do sistema no momento da conferência. */
    estoque: number;
    /** Quantidade contada pelo conferente. */
    contado: number;
    /** `0` = pendente de envio, `1` = já enviado. */
    synced: 0 | 1;
    /** Tentativas de envio já realizadas. */
    attempts: number;
    /** Mensagem da última falha de envio. */
    lastError: string | null;
    /** Momento da gravação (epoch em ms). */
    creationTime: number;
}

/** Referência de uma contagem para consultas no banco local. */
export interface ContagemReference {
    contagemNum?: string | number;
    contagemId?: string | number;
}

/** Resultado de uma rodada de sincronização. */
export interface SyncSummary {
    sent: number;
    failed: number;
    pending: number;
}
