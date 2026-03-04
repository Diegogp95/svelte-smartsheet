import type {
    GridPosition,
    HeaderPosition,
} from '../types/types.ts';

export function generateColumnLabel(index: number): string {
    let result = '';
    let num = index;

    do {
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26) - 1;
    } while (num >= 0);

    return result;
}
