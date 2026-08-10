/**
 * @file components/MaterialIcon.tsx
 * @description
 * Ícone da fonte Material Icons.
 *
 * Ícones decorativos recebem `aria-hidden` por padrão: quem lê a tela com
 * leitor de telas já tem o rótulo do elemento que os contém.
 */
export interface MaterialIconProps {
    /** Nome do ícone (ex.: `'assignment'`). */
    name: string;
    /** Classe adicional. */
    className?: string;
    /** `false` quando o ícone carrega significado próprio. */
    decorative?: boolean;
}

export function MaterialIcon({ name, className, decorative = true }: MaterialIconProps) {
    return (
        <i
            className={`material-icons${className ? ` ${className}` : ''}`}
            aria-hidden={decorative ? 'true' : undefined}
        >
            {name}
        </i>
    );
}
