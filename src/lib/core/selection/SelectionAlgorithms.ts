import type { GridPosition, GridDimensions } from '../types/types.ts';
import type { HeaderSelection } from './HeaderSelection.ts';

/**
 * Analyzes a flat list of positions and groups them into the largest possible
 * non-overlapping rectangles, leaving isolated positions as individuals.
 */
export function analyzeRectangularSelections(
    positions: GridPosition[],
    gridDimensions: GridDimensions
): {
    rectangles: Array<{ topLeft: GridPosition, bottomRight: GridPosition }>,
    individuals: GridPosition[]
} {
    if (positions.length === 0) {
        return { rectangles: [], individuals: [] };
    }

    const positionSet = new Set(positions.map(pos => `${pos.row}-${pos.col}`));
    const processed = new Set<string>();
    const rectangles: Array<{ topLeft: GridPosition, bottomRight: GridPosition }> = [];
    const individuals: GridPosition[] = [];

    for (const position of positions) {
        const key = `${position.row}-${position.col}`;

        if (processed.has(key)) continue;

        const rectangle = findLargestRectangle(position, positionSet, processed, gridDimensions);

        if (rectangle.area > 1) {
            rectangles.push({
                topLeft: rectangle.topLeft,
                bottomRight: rectangle.bottomRight
            });

            for (let row = rectangle.topLeft.row; row <= rectangle.bottomRight.row; row++) {
                for (let col = rectangle.topLeft.col; col <= rectangle.bottomRight.col; col++) {
                    processed.add(`${row}-${col}`);
                }
            }
        } else {
            individuals.push(position);
            processed.add(key);
        }
    }

    return { rectangles, individuals };
}

/**
 * Finds consecutive ranges in a list of header indices, separating ranges of
 * 2+ elements from isolated single indices.
 */
export function findConsecutiveHeaderRanges(indices: number[]): {
    ranges: Array<{ start: number, end: number }>,
    individuals: number[]
} {
    if (indices.length === 0) {
        return { ranges: [], individuals: [] };
    }

    const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);
    const ranges: Array<{ start: number, end: number }> = [];
    const individuals: number[] = [];

    let currentRangeStart = uniqueIndices[0];
    let currentRangeEnd = uniqueIndices[0];

    for (let i = 1; i < uniqueIndices.length; i++) {
        const currentIndex = uniqueIndices[i];

        if (currentIndex === currentRangeEnd + 1) {
            currentRangeEnd = currentIndex;
        } else {
            if (currentRangeStart === currentRangeEnd) {
                individuals.push(currentRangeStart);
            } else {
                ranges.push({ start: currentRangeStart, end: currentRangeEnd });
            }
            currentRangeStart = currentIndex;
            currentRangeEnd = currentIndex;
        }
    }

    if (currentRangeStart === currentRangeEnd) {
        individuals.push(currentRangeStart);
    } else {
        ranges.push({ start: currentRangeStart, end: currentRangeEnd });
    }

    return { ranges, individuals };
}

function findLargestRectangle(
    startPos: GridPosition,
    positionSet: Set<string>,
    processed: Set<string>,
    gridDimensions: GridDimensions
): { topLeft: GridPosition, bottomRight: GridPosition, area: number } {
    const key = `${startPos.row}-${startPos.col}`;

    if (processed.has(key) || !positionSet.has(key)) {
        return { topLeft: startPos, bottomRight: startPos, area: 0 };
    }

    let maxArea = 1;
    let bestRect = { topLeft: startPos, bottomRight: startPos };

    for (let endRow = startPos.row; endRow <= gridDimensions.maxRow; endRow++) {
        for (let endCol = startPos.col; endCol <= gridDimensions.maxCol; endCol++) {
            if (isValidRectangle(startPos, { row: endRow, col: endCol }, positionSet, processed)) {
                const area = (endRow - startPos.row + 1) * (endCol - startPos.col + 1);
                if (area > maxArea) {
                    maxArea = area;
                    bestRect = {
                        topLeft: startPos,
                        bottomRight: { row: endRow, col: endCol }
                    };
                }
            } else {
                break;
            }
        }
    }

    return { ...bestRect, area: maxArea };
}

function isValidRectangle(
    topLeft: GridPosition,
    bottomRight: GridPosition,
    positionSet: Set<string>,
    processed: Set<string>
): boolean {
    for (let row = topLeft.row; row <= bottomRight.row; row++) {
        for (let col = topLeft.col; col <= bottomRight.col; col++) {
            const key = `${row}-${col}`;
            if (!positionSet.has(key) || processed.has(key)) {
                return false;
            }
        }
    }
    return true;
}

/**
 * Calculates the intersection of cells covered by row header selections
 * and column header selections.
 */
export function calculateRowColIntersection(
    rowSelections: HeaderSelection[],
    colSelections: HeaderSelection[]
): Set<string> {
    const rowCells = new Set<string>();
    rowSelections.forEach(hs => hs.getCells().forEach(cell => rowCells.add(cell)));

    const colCells = new Set<string>();
    colSelections.forEach(hs => hs.getCells().forEach(cell => colCells.add(cell)));

    const intersection = new Set<string>();
    rowCells.forEach(cell => { if (colCells.has(cell)) intersection.add(cell); });
    return intersection;
}
