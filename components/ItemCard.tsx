'use client';

/**
 * @file components/ItemCard.tsx
 * @description
 * Cartão de um item na tela de conferência: descrição, localização, campo de
 * quantidade e o botão que alterna entre "Salvar" e "Editar".
 *
 * A cor do campo é definida pela classe de feedback vinda de
 * `useItensConferencia` (ver a tabela de estados naquele arquivo).
 */
import type { CSSProperties } from 'react';
import type { EstadoItem } from '@/hooks/useItensConferencia';
import type { ItemContagem } from '@/lib/types';
import { MaterialIcon } from './MaterialIcon';

export interface ItemCardProps {
    item: ItemContagem;
    estado: EstadoItem;
    /** Posição na lista — define o atraso da animação de entrada. */
    index: number;
    onChangeQuantidade: (valor: string) => void;
    onToggle: () => void;
    registrarInput: (element: HTMLInputElement | null) => void;
}

export function ItemCard({
    item,
    estado,
    index,
    onChangeQuantidade,
    onToggle,
    registrarInput,
}: ItemCardProps) {
    const style: CSSProperties = { animationDelay: `${index * 0.05}s` };
    const modoEditar = estado.bloqueado;

    return (
        <div className={`item-card${modoEditar ? ' item-card--saved' : ''}`} style={style}>
            <div className="item-card__info">
                <div className="item-card__title">
                    <span className="item-code">#{item.cod_produto}</span>
                    <span className="item-desc">{item.desc_produto || '-'}</span>
                </div>
                <div className="item-card__meta">
                    <span>Localização: <strong>{item.localizacao || '-'}</strong></span>
                    {estado.salvo && (
                        <span className="item-card__badge">
                            {estado.remoto ? 'Contado em outro dispositivo' : 'Salvo no dispositivo'}
                        </span>
                    )}
                </div>
            </div>

            <div className="item-card__actions">
                <div className="quantity-wrapper">
                    <label htmlFor={`qtd-${item.id}`}>Qtd</label>
                    <input
                        ref={registrarInput}
                        id={`qtd-${item.id}`}
                        type="number"
                        inputMode="numeric"
                        className={`quantidade-input${estado.feedback ? ` ${estado.feedback}` : ''}`}
                        value={estado.valor}
                        placeholder="0"
                        min={0}
                        step={1}
                        disabled={estado.bloqueado}
                        onChange={(event) => onChangeQuantidade(event.target.value)}
                        onKeyDown={(event) => {
                            // Coletores de código de barras enviam Enter ao final da leitura.
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            if (!estado.bloqueado) onToggle();
                        }}
                    />
                </div>

                <button
                    type="button"
                    className="item-save-btn"
                    disabled={estado.salvando}
                    onClick={onToggle}
                >
                    {estado.salvando ? (
                        <span>Salvando...</span>
                    ) : (
                        <>
                            <MaterialIcon name={modoEditar ? 'edit' : 'save'} />
                            <span>{modoEditar ? 'Editar' : 'Salvar'}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
