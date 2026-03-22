import type { GridDimensions, GridPosition, CellComponent } from '../types/types.ts';

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

/**
 * Returns true if the cell at the given position has no meaningful value.
 */
export function isCellEmpty<T>(
    cellComponents: Map<string, CellComponent<T>>,
    position: GridPosition
): boolean {
    const key = `${position.row}-${position.col}`;
    const cell = cellComponents.get(key);
    if (!cell) return true;
    const value = cell.value;
    return value === '' || value === null || value === undefined;
}

/**
 * Excel-style Ctrl+Arrow boundary detection.
 * From an empty cell: finds the first non-empty cell in direction.
 * From a non-empty cell: finds the last contiguous non-empty cell in direction.
 */
export function findDataBoundary<T>(
    cellComponents: Map<string, CellComponent<T>>,
    gridDimensions: GridDimensions,
    currentRow: number,
    currentCol: number,
    direction: 'up' | 'down' | 'left' | 'right'
): GridPosition {
    const { maxRow, maxCol } = gridDimensions;
    const currentEmpty = isCellEmpty(cellComponents, { row: currentRow, col: currentCol });

    const directions = {
        up:    { rowDelta: -1, colDelta:  0, boundary: { row: 0,      col: currentCol } },
        down:  { rowDelta:  1, colDelta:  0, boundary: { row: maxRow, col: currentCol } },
        left:  { rowDelta:  0, colDelta: -1, boundary: { row: currentRow, col: 0      } },
        right: { rowDelta:  0, colDelta:  1, boundary: { row: currentRow, col: maxCol } },
    };

    const { rowDelta, colDelta, boundary } = directions[direction];

    if (currentEmpty) {
        let row = currentRow + rowDelta;
        let col = currentCol + colDelta;
        while (row >= 0 && row <= maxRow && col >= 0 && col <= maxCol) {
            if (!isCellEmpty(cellComponents, { row, col })) return { row, col };
            row += rowDelta;
            col += colDelta;
        }
        return boundary;
    } else {
        let row = currentRow + rowDelta;
        let col = currentCol + colDelta;
        while (row >= 0 && row <= maxRow && col >= 0 && col <= maxCol) {
            if (isCellEmpty(cellComponents, { row, col })) {
                return { row: row - rowDelta, col: col - colDelta };
            }
            row += rowDelta;
            col += colDelta;
        }
        return boundary;
    }
}
