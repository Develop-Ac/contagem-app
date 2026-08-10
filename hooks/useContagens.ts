'use client';

/**
 * @file hooks/useContagens.ts
 * @description
 * Carregamento das contagens atribuídas ao conferente ("Minhas Tarefas").
 *
 * Estratégia (offline-first):
 * 1. com conexão, busca na API e **guarda o resultado no cache local**;
 * 2. sem conexão — ou se a API falhar — exibe o último resultado guardado;
 * 3. sem cache e sem rede, devolve um estado vazio explicando a situação.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { getDatabase } from '@/lib/database';
import { createLogger } from '@/lib/logger';
import type { Contagem } from '@/lib/types';
import { useSession } from './useSession';
import { useToast } from './useToast';

const log = createLogger('ContagensView');

export interface EmptyStateInfo {
    /** Nome do ícone Material. */
    icon: string;
    /** Título. */
    title: string;
    /** Texto de apoio. */
    description: string;
    /** `'neutral'` ou `'alert'`. */
    tone?: 'neutral' | 'alert';
}

export interface ContagensState {
    /** Contagens liberadas para o conferente, prontas para renderização. */
    contagens: Contagem[];
    /** Carregamento em andamento. */
    loading: boolean;
    /** Estado vazio a exibir no lugar da lista, quando houver. */
    emptyState: EmptyStateInfo | null;
    /** Recarrega a lista. */
    reload: () => Promise<void>;
}

/**
 * Chave de cache das contagens de um usuário.
 */
function cacheKey(usuarioId: string | number): string {
    return `contagens_${usuarioId}`;
}

export function useContagens(): ContagensState {
    const { usuario, restored } = useSession();
    const toast = useToast();

    const [contagens, setContagens] = useState<Contagem[]>([]);
    const [loading, setLoading] = useState(true);
    const [emptyState, setEmptyState] = useState<EmptyStateInfo | null>(null);

    // Evita que uma resposta antiga sobrescreva uma recarga mais recente.
    const requisicaoRef = useRef(0);

    /**
     * Aplica a lista recebida, mantendo apenas as contagens já liberadas.
     */
    const aplicar = useCallback((recebidas: Contagem[]) => {
        const liberadas = recebidas.filter((contagem) => contagem.liberado_contagem === true);

        if (liberadas.length === 0) {
            setContagens([]);
            setEmptyState({
                icon: 'inbox',
                title: 'Nenhuma contagem liberada',
                description: 'Não há contagens liberadas para você no momento.',
            });
            return;
        }

        setContagens(liberadas);
        setEmptyState(null);
    }, []);

    const load = useCallback(async () => {
        if (!usuario || !usuario.id) {
            toast.error('Sessão expirada. Faça login novamente.');
            setLoading(false);
            return;
        }

        const requisicao = ++requisicaoRef.current;
        const key = cacheKey(usuario.id);
        const database = getDatabase();

        setLoading(true);
        setContagens([]);
        setEmptyState(null);

        try {
            if (navigator.onLine) {
                try {
                    const recebidas = await api.listarContagens(usuario.id);

                    if (Array.isArray(recebidas)) {
                        await database.saveCache(key, recebidas);
                        if (requisicao === requisicaoRef.current) aplicar(recebidas);
                        return;
                    }

                    log.warn('Resposta inesperada da API de contagens.', recebidas);
                } catch (error) {
                    log.warn('Falha ao consultar a API; usando o cache local.', error);
                    toast.error(`Servidor indisponível: ${(error as Error).message}`);
                }
            }

            const cached = await database.getCache<Contagem[]>(key);

            if (Array.isArray(cached)) {
                toast.show('Exibindo dados salvos no dispositivo.', { timeout: 2000 });
                if (requisicao === requisicaoRef.current) aplicar(cached);
                return;
            }

            if (requisicao !== requisicaoRef.current) return;

            setEmptyState({
                icon: navigator.onLine ? 'error_outline' : 'wifi_off',
                title: navigator.onLine ? 'Não foi possível carregar' : 'Você está sem conexão',
                description: navigator.onLine
                    ? 'Tente novamente em alguns instantes.'
                    : 'Não existem contagens salvas neste dispositivo.',
                tone: 'alert',
            });
        } catch (error) {
            log.error('Erro ao carregar as contagens.', error);
            toast.error(`Erro ao carregar: ${(error as Error).message || 'falha desconhecida'}`);
        } finally {
            if (requisicao === requisicaoRef.current) setLoading(false);
        }
    }, [usuario, toast, aplicar]);

    useEffect(() => {
        if (!restored) return;

        // A busca inicial é o próprio efeito colateral desta tela: `load` é
        // assíncrona e o estado só muda depois da resposta da API ou do cache.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        load();
    }, [restored, load]);

    return { contagens, loading, emptyState, reload: load };
}
