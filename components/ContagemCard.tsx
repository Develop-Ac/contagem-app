'use client';

/**
 * @file components/ContagemCard.tsx
 * @description Cartão de uma contagem na tela "Minhas Tarefas".
 */
import type { CSSProperties } from 'react';
import { format } from '@/lib/format';
import type { Contagem } from '@/lib/types';
import { MaterialIcon } from './MaterialIcon';

export interface ContagemCardProps {
    contagem: Contagem;
    /** Posição na lista — define o atraso da animação de entrada. */
    index: number;
    onOpen: (contagem: Contagem) => void;
}

export function ContagemCard({ contagem, index, onOpen }: ContagemCardProps) {
    const responsavel = contagem.usuario;
    const style: CSSProperties = { animationDelay: `${index * 0.1}s` };

    return (
        <article
            className="contagem-card"
            style={style}
            tabIndex={0}
            role="button"
            onClick={() => onOpen(contagem)}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onOpen(contagem);
                }
            }}
        >
            <div className="contagem-card__title">
                <h2 className="contagem-card__title-text">Contagem #{contagem.contagem}</h2>
            </div>
            <div className="contagem-card__body">
                <div className="contagem-info"><strong>Piso:</strong> {contagem.piso || '-'}</div>
                <div className="contagem-info"><strong>Responsável:</strong> {responsavel?.nome || 'N/A'}</div>
                <div className="contagem-info"><strong>Código:</strong> {responsavel?.codigo || 'N/A'}</div>
                <div className="contagem-date">
                    <MaterialIcon name="schedule" />
                    {format.dateTime(contagem.created_at)}
                </div>
            </div>
        </article>
    );
}
