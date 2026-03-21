import type {
    GridPosition,
    HeaderPosition,
} from '../types/types.ts';

export function positionToKey(position: GridPosition): string {
    return `${position.row}-${position.col}`;
}

export function keyToPosition(key: string): GridPosition {
    const [row, col] = key.split('-').map(Number);
    return { row, col };
}

export function comparePositions(pos1: GridPosition, pos2: GridPosition): boolean {
    return pos1.row === pos2.row && pos1.col === pos2.col;
}

export function generateColumnLabel(index: number): string {
    let result = '';
    let num = index;

    do {
        result = String.fromCharCode(65 + (num % 26)) + result;
        num = Math.floor(num / 26) - 1;
    } while (num >= 0);

    return result;
}
