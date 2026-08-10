'use client';

/**
 * @file hooks/useItensConferencia.ts
 * @description
 * Conferência dos itens de uma contagem — o coração do aplicativo.
 *
 * ## Fluxo de um item
 *
 * 1. O conferente digita a quantidade e aciona **Salvar**.
 * 2. A quantidade é gravada **primeiro no dispositivo** (`lib/database.ts`),
 *    para que nada se perca se a rede cair no meio da operação.
 * 3. Com conexão, o app consulta o estoque do sistema, compara e informa o
 *    resultado ao servidor. Sem conexão, o item fica na fila de sincronização.
 * 4. **Concluir Contagem** libera a contagem na API, sinalizando se houve
 *    divergência e quais itens precisam ser revalidados.
 *
 * ## Regra da soma por produto
 *
 * Um mesmo produto pode aparecer em mais de uma localização (locação e
 * sublocação). O estoque do sistema é único por produto, então a comparação usa
 * a **soma de todas as localizações** daquele produto. O log gravado, porém,
 * guarda a quantidade daquela localização específica.
 *
 * ## Estados visuais do campo de quantidade
 *
 * | Classe                   | Significado                                           |
 * |--------------------------|-------------------------------------------------------|
 * | `conferencia-pendente`   | Salvo no dispositivo, ainda não conferido no servidor  |
 * | `conferencia-ok`         | Conferido: a soma bate com o estoque do sistema        |
 * | `conferencia-divergente` | Conferido: a soma **não** bate com o sistema           |
 * | `conferencia-erro`       | Falha ao gravar no dispositivo (dado em risco)         |
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getDatabase } from '@/lib/database';
import { format } from '@/lib/format';
import { createLogger } from '@/lib/logger';
import { sync } from '@/lib/sync';
import type { Contagem, ContagemLog, ItemContagem } from '@/lib/types';
import { useSession } from './useSession';
import { useToast } from './useToast';

const log = createLogger('ItensView');

/** Classes de feedback aplicadas ao campo de quantidade. */
export const FEEDBACK = {
    OK: 'conferencia-ok',
    DIVERGENTE: 'conferencia-divergente',
    ERRO: 'conferencia-erro',
    PENDENTE: 'conferencia-pendente',
} as const;

export type FeedbackClass = (typeof FEEDBACK)[keyof typeof FEEDBACK];

/**
 * Estoque gravado no log antes da conferência online.
 * É substituído pelo valor real assim que a API responde.
 */
const ESTOQUE_PROVISORIO = 0;

export interface EstadoItem {
    /** Quantidade digitada (texto, como no campo). */
    valor: string;
    /** Quantidade já registrada no dispositivo. */
    salvo: boolean;
    /** Conferência online apontou divergência. */
    divergente: boolean;
    /** A conferência chegou a ser feita. */
    conferidoOnline: boolean;
    /** Classe de feedback aplicada ao campo. */
    feedback: FeedbackClass | null;
    /** Campo travado (item salvo, aguardando "Editar"). */
    bloqueado: boolean;
    /** Gravação em andamento. */
    salvando: boolean;
}

export interface ItensConferenciaState {
    /** Itens pendentes de conferência, na ordem física da prateleira. */
    itens: ItemContagem[];
    /** Estado da conferência por item. */
    estados: Record<string, EstadoItem>;
    /** Carregamento dos dados locais em andamento. */
    loading: boolean;
    /** Conclusão da contagem em andamento. */
    concluindo: boolean;
    /** Ao menos um item foi salvo — habilita "Concluir Contagem". */
    podeConcluir: boolean;
    /** Total de itens da contagem (inclusive os já conferidos). */
    totalItens: number;
    /** Quantidade de itens que aguardam conferência. */
    totalPendentes: number;
    /** Registra o campo de quantidade de um item (para mover o foco). */
    registrarInput: (itemId: string | number, element: HTMLInputElement | null) => void;
    /** Reage à digitação no campo de quantidade. */
    alterarQuantidade: (itemId: string | number, valor: string) => void;
    /** Alterna o cartão entre os modos "Salvar" e "Editar". */
    alternarModo: (itemId: string | number) => Promise<void>;
    /** Conclui a contagem: libera na API e limpa os dados locais. */
    concluirContagem: () => Promise<void>;
    /** Indica se há quantidade digitada e ainda não salva na tela. */
    temEdicaoPendente: () => boolean;
}

/**
 * Ordena os itens pela localização.
 *
 * A ordem de localização é a ordem física da prateleira: é assim que o
 * conferente caminha pelo estoque.
 */
function ordenarPorLocalizacao(itens: ItemContagem[]): ItemContagem[] {
    return itens.slice().sort((a, b) => String(a.localizacao || '')
        .localeCompare(String(b.localizacao || ''), 'pt-BR', { numeric: true, sensitivity: 'base' }));
}

/**
 * Conduz a conferência de uma contagem.
 *
 * @param contagem Contagem aberta.
 * @param aoConcluir Executado após a liberação bem-sucedida (volta à lista).
 */
export function useItensConferencia(
    contagem: Contagem | null,
    aoConcluir: () => void,
): ItensConferenciaState {
    const { usuario } = useSession();
    const toast = useToast();

    const [estados, setEstadosState] = useState<Record<string, EstadoItem>>({});
    const [loading, setLoading] = useState(true);
    const [concluindo, setConcluindo] = useState(false);

    /** Espelho síncrono de `estados`, para leitura dentro de rotinas async. */
    const estadosRef = useRef<Record<string, EstadoItem>>({});

    /**
     * Itens salvos sem conferência online (offline ou erro de API).
     * Enviados na conclusão para que o servidor os revalide.
     */
    const paraRevalidarRef = useRef<Set<string>>(new Set());

    /** Campos de quantidade renderizados, por id do item. */
    const inputsRef = useRef<Map<string, HTMLInputElement>>(new Map());

    const todosItens = useMemo<ItemContagem[]>(
        () => (Array.isArray(contagem?.itens) ? contagem!.itens : []),
        [contagem],
    );

    const itens = useMemo(
        () => ordenarPorLocalizacao(todosItens.filter((item) => item.conferir === true)),
        [todosItens],
    );

    // ----------------------------------------------------------------------
    // Estado dos itens
    // ----------------------------------------------------------------------

    const escreverEstados = useCallback((proximos: Record<string, EstadoItem>) => {
        estadosRef.current = proximos;
        setEstadosState(proximos);
    }, []);

    /** Aplica uma alteração parcial ao estado de um item. */
    const alterarEstado = useCallback((itemId: string | number, patch: Partial<EstadoItem>) => {
        const key = String(itemId);
        const atual = estadosRef.current[key];
        if (!atual) return;

        escreverEstados({ ...estadosRef.current, [key]: { ...atual, ...patch } });
    }, [escreverEstados]);

    /**
     * Aplica uma classe de feedback a todos os campos do mesmo produto.
     *
     * @param codProduto Código do produto (ou `null` para um item só).
     * @param feedback Classe de `FEEDBACK`, ou `null` para limpar.
     * @param somenteItemId Restringe a aplicação a um único item.
     */
    const aplicarFeedback = useCallback((
        codProduto: string | number | null,
        feedback: FeedbackClass | null,
        somenteItemId?: string | number,
    ) => {
        const proximos = { ...estadosRef.current };

        itens.forEach((item) => {
            const key = String(item.id);
            if (!proximos[key]) return;

            const alvo = somenteItemId !== undefined
                ? format.sameId(item.id, somenteItemId)
                : String(item.cod_produto) === String(codProduto);

            if (alvo) proximos[key] = { ...proximos[key], feedback };
        });

        escreverEstados(proximos);
    }, [itens, escreverEstados]);

    // ----------------------------------------------------------------------
    // Carregamento
    // ----------------------------------------------------------------------

    /**
     * Carrega os dados locais da contagem, reidratando o que já foi digitado.
     */
    useEffect(() => {
        if (!contagem) return;

        let ativo = true;

        const montarEstados = (logsPorItem: Record<string, ContagemLog>) => {
            const proximos: Record<string, EstadoItem> = {};

            itens.forEach((item) => {
                const logLocal = logsPorItem[String(item.id)] || null;
                const salvo = Boolean(logLocal);

                proximos[String(item.id)] = {
                    valor: salvo ? String(logLocal!.contado) : '',
                    salvo,
                    divergente: false,
                    conferidoOnline: false,
                    feedback: salvo ? FEEDBACK.PENDENTE : null,
                    bloqueado: salvo,
                    salvando: false,
                };
            });

            escreverEstados(proximos);
        };

        const carregar = async () => {
            setLoading(true);
            paraRevalidarRef.current.clear();

            try {
                const logs = await getDatabase().getLogsByContagem({
                    contagemNum: contagem.contagem,
                    contagemId: contagem.id,
                });

                if (!ativo) return;

                // Os logs já vêm ordenados por data: o último de cada item vence.
                const logsPorItem: Record<string, ContagemLog> = {};
                logs.forEach((entry) => { logsPorItem[String(entry.item_id)] = entry; });

                log.debug(`${logs.length} log(s) local(is) recuperado(s).`);
                montarEstados(logsPorItem);
            } catch (error) {
                log.error('Falha ao recuperar os dados locais da contagem.', error);
                if (ativo) montarEstados({});
            } finally {
                if (ativo) setLoading(false);
            }
        };

        carregar();

        return () => { ativo = false; };
    }, [contagem, itens, escreverEstados]);

    // ----------------------------------------------------------------------
    // Conferência de um item
    // ----------------------------------------------------------------------

    /**
     * Soma as quantidades digitadas para um produto em todas as localizações.
     */
    const somarQuantidades = useCallback((codProduto: string | number): number => {
        return itens.reduce((total, item) => {
            if (String(item.cod_produto) !== String(codProduto)) return total;

            const estado = estadosRef.current[String(item.id)];
            const quantidade = format.toQuantity(estado?.valor);
            return total + (quantidade || 0);
        }, 0);
    }, [itens]);

    /**
     * Grava o log de contagem no dispositivo.
     *
     * @returns Id do log gravado.
     */
    const gravarLogLocal = useCallback(async (item: ItemContagem, quantidade: number) => {
        if (!contagem || !usuario) throw new Error('Sessão ou contagem indisponível.');

        return getDatabase().addLog({
            // `contagem_id` é o que a API espera; `contagem_num` é estável entre
            // sessões e é por ele que a tela reidrata os valores digitados.
            contagem_id: contagem.id,
            contagem_num: contagem.contagem,
            usuario_id: usuario.id,
            item_id: item.id,
            identificador_item: item.identificador_item,
            estoque: ESTOQUE_PROVISORIO,
            contado: quantidade,
        });
    }, [contagem, usuario]);

    /**
     * Confere a quantidade contra o estoque do sistema e atualiza a API.
     */
    const conferirOnline = useCallback(async (item: ItemContagem, totalProduto: number) => {
        const resposta = await api.consultarEstoque(item.cod_produto);
        const estoqueReal = Number(resposta && resposta.ESTOQUE);

        const identificadorItem = item.identificador_item;

        if (!identificadorItem) {
            throw new Error(`Item ${item.id} está sem identificador na contagem.`);
        }

        // Substitui o estoque provisório pelo valor real nos logs locais.
        await getDatabase().updateEstoqueByItem(identificadorItem, estoqueReal).catch((error) => {
            log.warn('Não foi possível atualizar o estoque nos logs locais.', error);
        });

        // Itens com aplicação sempre passam por uma segunda contagem, então
        // nunca são marcados como divergência nesta etapa.
        const temAplicacao = item.tem_aplicacao === true;
        const divergente = temAplicacao ? false : totalProduto !== estoqueReal;

        await api.atualizarItem(identificadorItem, { conferir: divergente, itemId: item.id });

        log.debug(
            `Produto ${item.cod_produto}: contado ${totalProduto}, sistema ${estoqueReal}, divergente ${divergente}.`,
        );

        return { divergente, estoqueReal, temAplicacao };
    }, []);

    /**
     * Salva a quantidade de um item: grava no dispositivo e confere no servidor.
     *
     * @returns `true` se o item pode ser travado como salvo.
     */
    const salvarItem = useCallback(async (item: ItemContagem): Promise<boolean> => {
        const key = String(item.id);
        const estadoAtual = estadosRef.current[key];
        const quantidade = format.toQuantity(estadoAtual?.valor);

        if (quantidade === null) {
            toast.show('Informe uma quantidade válida antes de salvar.');
            inputsRef.current.get(key)?.focus();
            return false;
        }

        const totalProduto = somarQuantidades(item.cod_produto);

        aplicarFeedback(item.cod_produto, FEEDBACK.PENDENTE);

        // 1. Offline-first: o dispositivo é a fonte da verdade.
        try {
            await gravarLogLocal(item, quantidade);
        } catch (error) {
            log.error('Falha ao gravar a contagem no dispositivo.', error);
            aplicarFeedback(null, FEEDBACK.ERRO, item.id);
            toast.error('Não foi possível salvar no dispositivo. Tente novamente.');
            return false;
        }

        alterarEstado(item.id, { salvo: true });

        // 2. Sem conexão: fica na fila e será revalidado na conclusão.
        if (!navigator.onLine) {
            alterarEstado(item.id, { conferidoOnline: false });
            paraRevalidarRef.current.add(key);
            toast.show('Salvo no dispositivo. Será enviado quando houver conexão.');
            return true;
        }

        // 3. Com conexão: confere contra o estoque do sistema.
        try {
            const resultado = await conferirOnline(item, totalProduto);

            alterarEstado(item.id, {
                conferidoOnline: true,
                divergente: resultado.divergente,
            });
            paraRevalidarRef.current.delete(key);

            if (resultado.divergente) {
                aplicarFeedback(item.cod_produto, FEEDBACK.DIVERGENTE);
            } else if (resultado.temAplicacao && totalProduto !== resultado.estoqueReal) {
                // Diferença registrada, mas aguardando a segunda contagem.
                aplicarFeedback(item.cod_produto, FEEDBACK.PENDENTE);
            } else {
                aplicarFeedback(item.cod_produto, FEEDBACK.OK);
            }
        } catch (error) {
            log.warn('Não foi possível conferir o item no servidor.', error);

            alterarEstado(item.id, { conferidoOnline: false });
            paraRevalidarRef.current.add(key);
            aplicarFeedback(item.cod_produto, FEEDBACK.PENDENTE);
            toast.error('Item salvo, mas o servidor não respondeu. Ele será revalidado.');
        } finally {
            // A fila é drenada depois da conferência, para que o log já saia com
            // o estoque real quando ele for conhecido.
            sync.triggerSync('item salvo');
        }

        return true;
    }, [toast, somarQuantidades, aplicarFeedback, gravarLogLocal, conferirOnline, alterarEstado]);

    // ----------------------------------------------------------------------
    // Interação
    // ----------------------------------------------------------------------

    const registrarInput = useCallback((itemId: string | number, element: HTMLInputElement | null) => {
        const key = String(itemId);
        if (element) inputsRef.current.set(key, element);
        else inputsRef.current.delete(key);
    }, []);

    const alterarQuantidade = useCallback((itemId: string | number, valor: string) => {
        alterarEstado(itemId, { valor });
    }, [alterarEstado]);

    /**
     * Move o foco para o próximo campo de quantidade habilitado.
     */
    const focarProximoInput = useCallback((itemId: string | number) => {
        const posicao = itens.findIndex((item) => format.sameId(item.id, itemId));
        if (posicao === -1) return;

        const proximo = itens.slice(posicao + 1)
            .find((item) => !estadosRef.current[String(item.id)]?.bloqueado);
        if (!proximo) return;

        const element = inputsRef.current.get(String(proximo.id));
        if (!element) return;

        element.focus();
        element.select();
    }, [itens]);

    const alternarModo = useCallback(async (itemId: string | number) => {
        const item = itens.find((candidato) => format.sameId(candidato.id, itemId));
        if (!item) return;

        const key = String(item.id);
        const estado = estadosRef.current[key];
        if (!estado || estado.salvando) return;

        // Modo "Editar": destrava o campo para uma nova digitação.
        if (estado.bloqueado) {
            alterarEstado(item.id, { bloqueado: false });

            // O campo só aceita foco depois que o React remove o `disabled`.
            requestAnimationFrame(() => {
                const element = inputsRef.current.get(key);
                element?.focus();
                element?.select();
            });
            return;
        }

        // Modo "Salvar".
        alterarEstado(item.id, { salvando: true });

        try {
            const salvo = await salvarItem(item);

            if (!salvo) return;

            alterarEstado(item.id, { bloqueado: true, salvando: false });
            focarProximoInput(item.id);
        } catch (error) {
            log.error('Erro inesperado ao salvar o item.', error);
            toast.error('Erro ao salvar o item. Tente novamente.');
        } finally {
            alterarEstado(item.id, { salvando: false });
        }
    }, [itens, alterarEstado, salvarItem, focarProximoInput, toast]);

    /**
     * Conclui a contagem: libera na API e limpa os dados locais.
     *
     * Exige conexão — a liberação é uma operação do servidor e não pode ficar
     * pendente sem que o conferente saiba.
     */
    const concluirContagem = useCallback(async () => {
        if (!contagem) return;

        if (!navigator.onLine) {
            toast.error('Sem conexão. Conecte-se à rede para concluir a contagem.');
            return;
        }

        const divergencia = Object.values(estadosRef.current).some((estado) => estado.divergente);

        setConcluindo(true);

        try {
            // Garante que tudo o que foi contado chegue antes da liberação.
            await sync.triggerSync('conclusão da contagem');

            await api.liberarContagem({
                contagem_cuid: contagem.contagem_cuid,
                contagem: contagem.contagem,
                divergencia,
                itensParaRevalidar: Array.from(paraRevalidarRef.current),
            });

            toast.show(divergencia
                ? 'Contagem liberada com divergência.'
                : 'Contagem finalizada com sucesso!');

            // A contagem foi encerrada: os logs locais não podem reaparecer em
            // uma contagem futura que reutilize o mesmo número.
            await getDatabase().deleteLogsByContagem({
                contagemNum: contagem.contagem,
                contagemId: contagem.id,
            });

            escreverEstados({});
            paraRevalidarRef.current.clear();

            aoConcluir();
        } catch (error) {
            log.error('Falha ao concluir a contagem.', error);
            toast.error(`Não foi possível concluir: ${(error as Error).message || 'erro desconhecido'}`);
            setConcluindo(false);
        }
    }, [contagem, toast, escreverEstados, aoConcluir]);

    const temEdicaoPendente = useCallback(() => {
        return Object.values(estadosRef.current)
            .some((estado) => !estado.bloqueado && estado.valor.trim() !== '');
    }, []);

    const podeConcluir = useMemo(
        () => Object.values(estados).some((estado) => estado.salvo),
        [estados],
    );

    return {
        itens,
        estados,
        loading,
        concluindo,
        podeConcluir,
        totalItens: todosItens.length,
        totalPendentes: itens.length,
        registrarInput,
        alterarQuantidade,
        alternarModo,
        concluirContagem,
        temEdicaoPendente,
    };
}
