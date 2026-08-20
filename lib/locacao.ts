/**
 * @file lib/locacao.ts
 * @description
 * Regras de leitura da locação física do estoque — as mesmas do estoque-service
 * e da tela de contagem da intranet. Alimentam o filtro de piso/prateleira da
 * conferência de contagens avulsas.
 *
 * Anatomia da locação: Piso (1-2 letras) + Rua/Prateleira (1-2 dígitos) +
 * Prédio/Coluna (2 dígitos) + Andar (letra) + Apartamento (1-2 dígitos).
 * Prateleira de 1 a 9 NÃO leva zero à esquerda: A903B02 é prateleira 9 /
 * prédio 03, e A1403A03 é prateleira 14 / prédio 03.
 */

/** Opções de piso/locação oferecidas no filtro. */
export const OPCOES_PISO = [
    { label: 'PISO A', value: 'PISO_A' },
    { label: 'PISO B', value: 'PISO_B' },
    { label: 'PISO C', value: 'PISO_C' },
    { label: 'VITRINE', value: 'VITRINE' },
    { label: 'Vitrine Móvel', value: 'VM' },
    { label: 'BOX', value: 'BOX' },
    { label: 'A-BOQUETA', value: 'A-BOQUETA' },
    { label: 'A-CX ESCADA', value: 'A-CX ESCADA' },
    { label: 'VENDA CASADA', value: 'VENDA CASADA' },
] as const;

/** Classifica uma locação num piso (valores do `OPCOES_PISO`). */
export function pertenceAoPiso(locacaoRaw: string | null | undefined, piso: string): boolean {
    const loc = (locacaoRaw ?? '').toUpperCase().trim();
    switch (piso) {
        case 'PISO_A':
            return loc.startsWith('A') || loc.startsWith('BOX');
        case 'PISO_B':
            return loc.startsWith('B') && !loc.startsWith('BOX');
        case 'PISO_C':
            return loc.startsWith('C');
        case 'BOX':
            return loc.startsWith('BOX');
        case 'A-BOQUETA':
            return loc.startsWith('A-BOQUETA');
        case 'A-CX ESCADA':
            return loc.startsWith('A-CX ESCADA');
        case 'VITRINE':
            // Inclui Vitrine Móvel (VM): é o mesmo colaborador que conta.
            return loc === 'VITRINE' || /^V\d/.test(loc) || loc.startsWith('VM');
        case 'VM':
            return loc.startsWith('VM');
        case 'VENDA CASADA':
            return loc === 'VENDA CASADA';
        default:
            return true;
    }
}

/**
 * Extrai o número da prateleira de uma locação.
 *
 * O corte é "o bloco de dígitos menos os 2 últimos (o prédio)" — nunca os 2
 * primeiros dígitos, porque prateleira 1-9 é escrita com um dígito só.
 */
export function extrairPrateleira(locacaoRaw: string | null | undefined): number | null {
    const m = (locacaoRaw ?? '').toUpperCase().trim().match(/^[A-Z]{1,2}(\d{2,4})[A-Z]\d/);
    if (!m) return null;
    const bloco = m[1];
    // Bloco de 2 dígitos é a forma curta sem prédio (ex.: C16D1 -> prateleira 16).
    const prateleira = bloco.length <= 2 ? bloco : bloco.slice(0, bloco.length - 2);
    const n = parseInt(prateleira, 10);
    return Number.isFinite(n) ? n : null;
}
