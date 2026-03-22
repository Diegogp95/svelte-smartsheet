import type { RenderArea, GridDimensions } from '../types/types.ts';

/**
 * Calculate render and visible areas for a virtualized grid.
 * Pure function — no side effects, all state passed as parameters.
 *
 * @param rowHeights      Scaled row height array (already includes scale factor)
 * @param colWidths       Scaled column width array (already includes scale factor)
 * @param gridDimensions  Grid bounds (maxRow, maxCol)
 * @param scrollTop       Current vertical scroll position
 * @param scrollLeft      Current horizontal scroll position
 * @param containerHeight Visible container height
 * @param containerWidth  Visible container width
 * @param overscan        Extra rows/cols to render beyond the visible area (default 1)
 * @returns [renderArea, visibleArea]
 */
export function computeRenderArea(
    rowHeights: number[],
    colWidths: number[],
    gridDimensions: GridDimensions,
    scrollTop: number,
    scrollLeft: number,
    containerHeight: number,
    containerWidth: number,
    overscan: number = 1,
): [RenderArea, RenderArea] {
    let accumulatedHeight = 0;
    let startRow = 0;
    let endRow = gridDimensions.maxRow;
    let startVisibleRow = 0;
    let endVisibleRow = gridDimensions.maxRow;

    // Find start row
    for (let row = 0; row <= gridDimensions.maxRow; row++) {
        const rowHeight = rowHeights[row] || 32;
        if (accumulatedHeight + rowHeight > scrollTop) {
            startVisibleRow = Math.max(0, row);
            startRow = Math.max(0, row - overscan);
            break;
        }
        accumulatedHeight += rowHeight;
    }

    // Find end row
    accumulatedHeight = 0;
    for (let row = 0; row <= gridDimensions.maxRow; row++) {
        const rowHeight = rowHeights[row] || 32;
        accumulatedHeight += rowHeight;
        if (accumulatedHeight > scrollTop + containerHeight) {
            endVisibleRow = Math.min(gridDimensions.maxRow, row);
            endRow = Math.min(gridDimensions.maxRow, row + overscan);
            break;
        }
    }

    let accumulatedWidth = 0;
    let startCol = 0;
    let endCol = gridDimensions.maxCol;
    let startVisibleCol = 0;
    let endVisibleCol = gridDimensions.maxCol;

    // Find start column
    for (let col = 0; col <= gridDimensions.maxCol; col++) {
        const colWidth = colWidths[col] || 120;
        if (accumulatedWidth + colWidth > scrollLeft) {
            startVisibleCol = Math.max(0, col);
            startCol = Math.max(0, col - overscan);
            break;
        }
        accumulatedWidth += colWidth;
    }

    // Find end column
    accumulatedWidth = 0;
    for (let col = 0; col <= gridDimensions.maxCol; col++) {
        const colWidth = colWidths[col] || 120;
        accumulatedWidth += colWidth;
        if (accumulatedWidth > scrollLeft + containerWidth) {
            endVisibleCol = Math.min(gridDimensions.maxCol, col);
            endCol = Math.min(gridDimensions.maxCol, col + overscan);
            break;
        }
    }

    return [
        { startRow, endRow, startCol, endCol },
        { startRow: startVisibleRow, endRow: endVisibleRow, startCol: startVisibleCol, endCol: endVisibleCol },
    ];
}
