import type { GridPosition, GridDimensions } from '../types/types.ts';
import type { ViewportPort } from '../ports/ViewportPort.ts';

/**
 * Encapsulates all viewport scroll calculations: scroll-to-position,
 * vertical page navigation, and horizontal page navigation.
 *
 * Reads grid spacing (rowHeights, colWidths) and viewport state via ViewportPort.
 * Has no domain state — pure calculation + command to viewport.
 */
export class ViewportScrollCalculator {
    private rowHeights: number[] = [];
    private colWidths: number[] = [];
    private viewportPort?: ViewportPort;

    constructor() {}

    // ===================== CONFIGURATION =====================

    setRowHeights(heights: number[]): void {
        this.rowHeights = heights;
    }

    setColWidths(widths: number[]): void {
        this.colWidths = widths;
    }

    setViewportPort(port: ViewportPort): void {
        this.viewportPort = port;
    }

    // ===================== SCROLL TO POSITION =====================

    /**
     * Scrolls viewport to keep the given cell position visible.
     * mode 'minimal' — scroll only if not visible
     * mode 'initial' — position at top-left
     * mode 'final'   — position at bottom-right
     */
    scrollToPosition(
        position: GridPosition,
        behavior: 'smooth' | 'instant' = 'instant',
        mode: 'minimal' | 'initial' | 'final' = 'minimal',
    ): void {
        const port = this.viewportPort;
        const state = port?.getScrollState();
        if (!state) return;

        const scrollTop = state.scrollTop;
        const scrollLeft = state.scrollLeft;
        const effectiveContainerHeight = state.viewportHeight - (this.rowHeights[0] || 0);
        const effectiveContainerWidth = state.viewportWidth - (this.colWidths[0] || 0);

        // Cell bounds — rowHeights/colWidths[0] is the header; grid cells start at index 1
        const cellTop = this.rowHeights.slice(1, position.row + 1).reduce((sum, h) => sum + h, 0);
        const cellLeft = this.colWidths.slice(1, position.col + 1).reduce((sum, w) => sum + w, 0);
        const cellBottom = cellTop + (this.rowHeights[position.row + 1] || 0);
        const cellRight = cellLeft + (this.colWidths[position.col + 1] || 0);

        let newScrollTop = scrollTop;
        let newScrollLeft = scrollLeft;

        if (mode === 'minimal') {
            if (cellTop < scrollTop) {
                newScrollTop = cellTop;
            } else if (cellBottom > scrollTop + effectiveContainerHeight) {
                newScrollTop = cellBottom - effectiveContainerHeight;
            }
            if (cellLeft < scrollLeft) {
                newScrollLeft = cellLeft;
            } else if (cellRight > scrollLeft + effectiveContainerWidth) {
                newScrollLeft = cellRight - effectiveContainerWidth;
            }
        } else if (mode === 'initial') {
            const isRowVisible = cellTop >= scrollTop && cellBottom <= scrollTop + effectiveContainerHeight;
            const isColVisible = cellLeft >= scrollLeft && cellRight <= scrollLeft + effectiveContainerWidth;
            if (!isRowVisible) newScrollTop = cellTop;
            if (!isColVisible) newScrollLeft = cellLeft;
        } else if (mode === 'final') {
            const isRowVisible = cellTop >= scrollTop && cellBottom <= scrollTop + effectiveContainerHeight;
            const isColVisible = cellLeft >= scrollLeft && cellRight <= scrollLeft + effectiveContainerWidth;
            if (!isRowVisible) newScrollTop = cellBottom - effectiveContainerHeight;
            if (!isColVisible) newScrollLeft = cellRight - effectiveContainerWidth;
        }

        if (newScrollTop !== scrollTop || newScrollLeft !== scrollLeft) {
            port!.scrollTo({ top: newScrollTop, left: newScrollLeft, behavior });
        }
    }

    // ===================== PAGE NAVIGATION =====================

    /**
     * Returns the new row index after advancing one page up or down.
     */
    calculateVerticalPage(currentRow: number, direction: 'up' | 'down', dimensions: GridDimensions): number {
        const { maxRow } = dimensions;
        const state = this.viewportPort?.getScrollState();
        if (!state) return currentRow;

        const effectiveContainerHeight = state.viewportHeight - (this.rowHeights[0] || 0);
        const currentScrollTop = state.scrollTop;

        let newScrollTop: number;
        if (direction === 'up') {
            newScrollTop = Math.max(0, currentScrollTop - effectiveContainerHeight);
        } else {
            const maxScrollTop = Math.max(0, state.contentHeight - effectiveContainerHeight);
            newScrollTop = Math.min(maxScrollTop, currentScrollTop + effectiveContainerHeight);
        }

        if (direction === 'up') {
            let accumulatedHeight = 0;
            for (let row = 0; row <= maxRow; row++) {
                const rowHeight = this.rowHeights[row + 1] || 32;
                if (accumulatedHeight + rowHeight > newScrollTop) {
                    return Math.max(0, Math.min(maxRow, row));
                }
                accumulatedHeight += rowHeight;
            }
            return maxRow;
        } else {
            let accumulatedHeight = 0;
            let lastCompleteRow = 0;
            for (let row = 0; row <= maxRow; row++) {
                const rowHeight = this.rowHeights[row + 1] || 32;
                if (accumulatedHeight + rowHeight <= newScrollTop + effectiveContainerHeight) {
                    lastCompleteRow = row;
                }
                accumulatedHeight += rowHeight;
                if (accumulatedHeight > newScrollTop + effectiveContainerHeight) break;
            }
            return Math.max(0, Math.min(maxRow, lastCompleteRow));
        }
    }

    /**
     * Returns the new column index after advancing one page left or right.
     */
    calculateHorizontalPage(currentCol: number, direction: 'left' | 'right', dimensions: GridDimensions): number {
        const { maxCol } = dimensions;
        const state = this.viewportPort?.getScrollState();
        if (!state) return currentCol;

        const effectiveContainerWidth = state.viewportWidth - (this.colWidths[0] || 0);
        const currentScrollLeft = state.scrollLeft;

        let newScrollLeft: number;
        if (direction === 'left') {
            newScrollLeft = Math.max(0, currentScrollLeft - effectiveContainerWidth);
        } else {
            const maxScrollLeft = Math.max(0, state.contentWidth - effectiveContainerWidth);
            newScrollLeft = Math.min(maxScrollLeft, currentScrollLeft + effectiveContainerWidth);
        }

        if (direction === 'left') {
            let accumulatedWidth = 0;
            for (let col = 0; col <= maxCol; col++) {
                const colWidth = this.colWidths[col + 1] || 120;
                if (accumulatedWidth + colWidth > newScrollLeft) {
                    return Math.max(0, Math.min(maxCol, col));
                }
                accumulatedWidth += colWidth;
            }
            return maxCol;
        } else {
            let accumulatedWidth = 0;
            let lastCompleteCol = 0;
            for (let col = 0; col <= maxCol; col++) {
                const colWidth = this.colWidths[col + 1] || 120;
                if (accumulatedWidth + colWidth <= newScrollLeft + effectiveContainerWidth) {
                    lastCompleteCol = col;
                }
                accumulatedWidth += colWidth;
                if (accumulatedWidth > newScrollLeft + effectiveContainerWidth) break;
            }
            return Math.max(0, Math.min(maxCol, lastCompleteCol));
        }
    }
}
