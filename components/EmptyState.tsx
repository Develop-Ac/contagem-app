/**
 * @file components/EmptyState.tsx
 * @description
 * Bloco exibido no lugar de uma lista vazia, explicando o motivo ao conferente.
 */
import { MaterialIcon } from './MaterialIcon';

export interface EmptyStateProps {
    /** Nome do ícone Material. */
    icon: string;
    /** Título — opcional nos estados mais simples. */
    title?: string;
    /** Texto de apoio. */
    description: string;
    /** Cor do ícone: neutro, sucesso ou alerta. */
    tone?: 'neutral' | 'success' | 'alert';
}

export function EmptyState({ icon, title, description, tone = 'neutral' }: EmptyStateProps) {
    return (
        <div className={`empty-state empty-state--${tone}`}>
            <MaterialIcon name={icon} />
            {title && <h4>{title}</h4>}
            <p>{description}</p>
        </div>
    );
}
