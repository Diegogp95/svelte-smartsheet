import type { GridDimensions, GridPosition } from '../types/types.ts';

/**
 * Pure movement step: advance a cell position by one unit in the given direction.
 * Clamps at grid boundaries.
 */
export function singleCellStep(
    position: GridPosition,
    direction: 'up' | 'down' | 'left' | 'right',
    gridDimensions: GridDimensions
): GridPosition {
    const { row, col } = position;
    const { maxRow, maxCol } = gridDimensions;
    const newPosition = { row, col };
    switch (direction) {
        case 'up':
            if (row > 0) newPosition.row = row - 1;
            break;
        case 'down':
            if (row < maxRow) newPosition.row = row + 1;
            break;
        case 'left':
            if (col > 0) newPosition.col = col - 1;
            break;
        case 'right':
            if (col < maxCol) newPosition.col = col + 1;
            break;
    }
    return newPosition;
}

/**
 * Pure movement step: advance a header index by one unit in the given direction.
 * Clamps at grid boundaries.
 */
export function singleHeaderStep(
    index: number,
    direction: 'up' | 'down' | 'left' | 'right',
    headerType: 'row' | 'col',
    gridDimensions: GridDimensions
): number {
    const { maxRow, maxCol } = gridDimensions;
    switch (headerType) {
        case 'row':
            if ((direction === 'up' || direction === 'left') && index > 0) return index - 1;
            if ((direction === 'down' || direction === 'right') && index < maxRow) return index + 1;
            break;
        case 'col':
            if ((direction === 'up' || direction === 'left') && index > 0) return index - 1;
            if ((direction === 'down' || direction === 'right') && index < maxCol) return index + 1;
            break;
    }
    return index;
}

/**
 * Pure boundary jump: move a header index to the first or last position in the given direction.
 */
export function boundaryHeaderJump(
    index: number,
    direction: 'up' | 'down' | 'left' | 'right',
    headerType: 'row' | 'col',
    gridDimensions: GridDimensions
): number {
    const { maxRow, maxCol } = gridDimensions;
    switch (headerType) {
        case 'row':
            if (direction === 'up' || direction === 'left') return 0;
            if (direction === 'down' || direction === 'right') return maxRow;
            break;
        case 'col':
            if (direction === 'up' || direction === 'left') return 0;
            if (direction === 'down' || direction === 'right') return maxCol;
            break;
    }
    return index;
}
