/**
 * @file lib/format.ts
 * @description Conversões e formatações compartilhadas (datas, números, ids).
 */

/** Opções de exibição de data/hora no padrão brasileiro. */
const DATE_TIME_OPTIONS: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
};

/**
 * Formata uma data ISO como `dd/mm/aaaa hh:mm`.
 *
 * @param value Data de origem.
 * @param fallback Retorno quando a data é inválida.
 */
export function dateTime(value: string | number | Date | null | undefined, fallback = '-'): string {
    if (!value) return fallback;

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return fallback;

    return date.toLocaleDateString('pt-BR', DATE_TIME_OPTIONS);
}

/**
 * Converte um valor para inteiro não negativo.
 *
 * @param value Valor de origem (normalmente `input.value`).
 * @returns O inteiro, ou `null` se inválido/negativo.
 */
export function toQuantity(value: unknown): number | null {
    if (value === null || value === undefined || String(value).trim() === '') {
        return null;
    }

    const parsed = parseInt(String(value), 10);
    if (isNaN(parsed) || parsed < 0) return null;

    return parsed;
}

/**
 * Compara identificadores que podem chegar como número ou texto.
 *
 * A API mistura os dois tipos (ids numéricos e cuids), e o DOM sempre devolve
 * `string`. Comparar com `===` direto produz falsos negativos silenciosos.
 */
export function sameId(a: unknown, b: unknown): boolean {
    if (a === null || a === undefined || b === null || b === undefined) {
        return false;
    }
    return String(a) === String(b);
}

export const format = { dateTime, toQuantity, sameId };
