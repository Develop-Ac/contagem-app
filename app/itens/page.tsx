'use client';

/**
 * @file app/itens/page.tsx
 * @description
 * Conferência dos itens de uma contagem.
 *
 * Toda a regra de negócio vive em `useItensConferencia`; esta tela só desenha o
 * resultado e encaminha as interações.
 */
import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { EmptyState } from '@/components/EmptyState';
import { ItemCard } from '@/components/ItemCard';
import { MaterialIcon } from '@/components/MaterialIcon';
import { Spinner } from '@/components/Spinner';
import { useItensConferencia } from '@/hooks/useItensConferencia';
import { useSession } from '@/hooks/useSession';
import { useUnloadGuard } from '@/hooks/useUnloadGuard';

export default function ItensPage() {
    const router = useRouter();
    const { restored, isAutenticado, contagem } = useSession();

    const voltarParaTarefas = useCallback(() => router.push('/contagens'), [router]);

    const {
        itens,
        estados,
        loading,
        concluindo,
        podeConcluir,
        totalItens,
        totalPendentes,
        registrarInput,
        alterarQuantidade,
        alternarModo,
        concluirContagem,
        temEdicaoPendente,
    } = useItensConferencia(contagem, voltarParaTarefas);

    useUnloadGuard(temEdicaoPendente);

    // Sem sessão vai para o login; sem contagem aberta volta para a lista.
    useEffect(() => {
        if (!restored) return;

        if (!isAutenticado) {
            router.replace('/login');
            return;
        }

        if (!contagem) router.replace('/contagens');
    }, [restored, isAutenticado, contagem, router]);

    // ESC volta da conferência para a lista de tarefas.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') voltarParaTarefas();
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [voltarParaTarefas]);

    if (!contagem) {
        return (
            <section className="screen" aria-label="Itens para conferência">
                <Spinner centered />
            </section>
        );
    }

    const semItens = totalItens === 0;
    const tudoConferido = !semItens && totalPendentes === 0;

    return (
        <section className="screen" aria-label="Itens para conferência">
            <div className="content-container">
                <div className="page-header">
                    <button
                        className="icon-button"
                        type="button"
                        title="Voltar"
                        aria-label="Voltar para as tarefas"
                        onClick={voltarParaTarefas}
                    >
                        <MaterialIcon name="arrow_back" />
                    </button>
                    <h3 className="page-title">
                        <MaterialIcon name="assignment_late" />
                        Itens para Conferência
                    </h3>
                </div>

                <p className="contagem-heading">
                    <span>
                        Contagem #{contagem.contagem} | {totalPendentes} de {totalItens} itens para conferir
                    </span>
                </p>

                {loading && <Spinner centered />}

                <div className="itens-card-list">
                    {!loading && semItens && (
                        <EmptyState icon="inventory_2" description="Nenhum item encontrado nesta contagem." />
                    )}

                    {!loading && tudoConferido && (
                        <EmptyState
                            icon="check_circle"
                            title="Todos os itens conferidos!"
                            description="Não há divergências nesta contagem."
                            tone="success"
                        />
                    )}

                    {!loading && itens.map((item, index) => {
                        const estado = estados[String(item.id)];
                        if (!estado) return null;

                        return (
                            <ItemCard
                                key={String(item.id)}
                                item={item}
                                estado={estado}
                                index={index}
                                registrarInput={(element) => registrarInput(item.id, element)}
                                onChangeQuantidade={(valor) => alterarQuantidade(item.id, valor)}
                                onToggle={() => alternarModo(item.id)}
                            />
                        );
                    })}
                </div>

                <div className="save-actions">
                    <button
                        className="primary-save-btn"
                        type="button"
                        disabled={!podeConcluir || concluindo}
                        onClick={concluirContagem}
                    >
                        {concluindo ? (
                            <span>Concluindo...</span>
                        ) : (
                            <>
                                <MaterialIcon name="save" />
                                <span>Concluir Contagem</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </section>
    );
}
