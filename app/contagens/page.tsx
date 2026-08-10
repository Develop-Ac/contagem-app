'use client';

/**
 * @file app/contagens/page.tsx
 * @description
 * Lista das contagens atribuídas ao conferente ("Minhas Tarefas").
 *
 * Abrir esta tela sempre fecha a contagem em andamento: é daqui que o
 * conferente escolhe em qual tarefa vai trabalhar.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ContagemCard } from '@/components/ContagemCard';
import { EmptyState } from '@/components/EmptyState';
import { MaterialIcon } from '@/components/MaterialIcon';
import { Spinner } from '@/components/Spinner';
import { useContagens } from '@/hooks/useContagens';
import { useSession } from '@/hooks/useSession';
import type { Contagem } from '@/lib/types';

export default function ContagensPage() {
    const router = useRouter();
    const { usuario, restored, isAutenticado, clearContagem, setContagem } = useSession();
    const { contagens, loading, emptyState } = useContagens();

    // Sem sessão não há tarefas a exibir.
    useEffect(() => {
        if (restored && !isAutenticado) router.replace('/login');
    }, [restored, isAutenticado, router]);

    // Voltar para a lista encerra a contagem aberta.
    useEffect(() => {
        clearContagem();
    }, [clearContagem]);

    const abrir = (contagem: Contagem) => {
        setContagem(contagem);
        router.push('/itens');
    };

    return (
        <section className="screen" aria-label="Minhas tarefas">
            <div className="content-container">
                <p className="user-greeting">
                    <span>{usuario ? `Olá, ${usuario.nome}` : ''}</span>
                </p>

                <div className="page-header">
                    <h3 className="page-title">
                        <MaterialIcon name="assignment" />
                        Minhas Tarefas
                    </h3>
                </div>

                {loading && <Spinner centered />}

                <div className="contagens-grid">
                    {!loading && emptyState && (
                        <EmptyState
                            icon={emptyState.icon}
                            title={emptyState.title}
                            description={emptyState.description}
                            tone={emptyState.tone}
                        />
                    )}

                    {!loading && !emptyState && contagens.map((contagem, index) => (
                        <ContagemCard
                            key={String(contagem.id)}
                            contagem={contagem}
                            index={index}
                            onOpen={abrir}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
