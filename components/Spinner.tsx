/**
 * @file components/Spinner.tsx
 * @description Indicador circular de carregamento.
 */
export interface SpinnerProps {
    /** Envolve o indicador em um bloco centralizado com respiro. */
    centered?: boolean;
    /** Classe adicional. */
    className?: string;
}

export function Spinner({ centered = false, className }: SpinnerProps) {
    const spinner = (
        <div className={`spinner${className ? ` ${className}` : ''}`} role="status" aria-label="Carregando" />
    );

    if (!centered) return spinner;

    return <div className="loading-center">{spinner}</div>;
}
