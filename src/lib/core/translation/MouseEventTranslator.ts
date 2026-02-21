import type {
    GridPosition,
    HeaderPosition,
    CellMouseEvent,
    HeaderMouseEvent,
    GridMouseInteractionType,
    GridDimensions,
} from '../types/types.ts';

export default class MouseEventTranslator {
    private gridDimensions: GridDimensions;
    private rowHeights: number[] = [];
    private colWidths: number[] = [];
    private tableContainer: HTMLDivElement | null = null;
    private mainGridContainer: HTMLDivElement | null = null;
    private rowHeadersContainer: HTMLDivElement | null = null;
    private colHeadersContainer: HTMLDivElement | null = null;
    
    // Position tracking for intelligent mousemove
    private lastKnownMainPosition: GridPosition | null = null;
    private lastKnownRowHeaderPosition: HeaderPosition | null = null;
    private lastKnownColHeaderPosition: HeaderPosition | null = null;

    constructor(gridDimensions: GridDimensions) {
        this.gridDimensions = gridDimensions;
    }

    // Set up containers and dimensions
    setTableContainer(container: HTMLDivElement) {
        this.tableContainer = container;
    }

    setMainGridContainer(container: HTMLDivElement) {
        this.mainGridContainer = container;
    }

    setRowHeadersContainer(container: HTMLDivElement) {
        this.rowHeadersContainer = container;
    }

    setColHeadersContainer(container: HTMLDivElement) {
        this.colHeadersContainer = container;
    }

    setRowHeights(heights: number[]) {
        this.rowHeights = heights;
    }

    setColWidths(widths: number[]) {
        this.colWidths = widths;
    }

    updateGridDimensions(dimensions: GridDimensions) {
        this.gridDimensions = dimensions;
    }

    /**
     * Translate mouse event coordinates to grid position
     * @param event - The mouse event
     * @param containerType - Which container the event occurred in
     * @returns GridPosition for cells, HeaderPosition for headers, or null if invalid
     */
    translateMouseToGridPosition(
        event: MouseEvent,
        containerType: 'main' | 'rowHeaders' | 'colHeaders' | 'corner'
    ): GridPosition | HeaderPosition | null {
        if (!this.tableContainer) return null;

        const containerRect = this.tableContainer.getBoundingClientRect();
        const scrollTop = this.tableContainer.scrollTop;
        const scrollLeft = this.tableContainer.scrollLeft;

        // Calculate relative position within the table container
        const relativeX = event.clientX - containerRect.left + scrollLeft;
        const relativeY = event.clientY - containerRect.top + scrollTop;

        switch (containerType) {
            case 'main':
                return this.translateToMainGridPosition(relativeX, relativeY);
            case 'rowHeaders':
                return this.translateToRowHeaderPosition(relativeY);
            case 'colHeaders':
                return this.translateToColHeaderPosition(relativeX);
            case 'corner':
                return { index: 0, headerType: 'corner' as const };
            default:
                return null;
        }
    }

    /**
     * Translate coordinates to main grid cell position
     */
    private translateToMainGridPosition(relativeX: number, relativeY: number): GridPosition | null {
        // Account for row header width (first column)
        const rowHeaderWidth = this.colWidths[0] || 0;
        const cellX = relativeX - rowHeaderWidth;

        // Account for column header height (first row)
        const colHeaderHeight = this.rowHeights[0] || 0;
        const cellY = relativeY - colHeaderHeight;

        if (cellX < 0 || cellY < 0) return null;

        // Find column (skip row header column - index 0)
        let accumulatedWidth = 0;
        let col = -1;
        for (let c = 1; c < this.colWidths.length; c++) {
            const colWidth = this.colWidths[c];
            if (cellX >= accumulatedWidth && cellX < accumulatedWidth + colWidth) {
                col = c - 1; // Adjust for 0-based grid indexing
                break;
            }
            accumulatedWidth += colWidth;
        }

        // Find row (skip column header row - index 0)
        let accumulatedHeight = 0;
        let row = -1;
        for (let r = 1; r < this.rowHeights.length; r++) {
            const rowHeight = this.rowHeights[r];
            if (cellY >= accumulatedHeight && cellY < accumulatedHeight + rowHeight) {
                row = r - 1; // Adjust for 0-based grid indexing
                break;
            }
            accumulatedHeight += rowHeight;
        }

        if (row >= 0 && col >= 0 && 
            row <= this.gridDimensions.maxRow && 
            col <= this.gridDimensions.maxCol) {
            return { row, col };
        }

        return null;
    }

    /**
     * Translate coordinates to row header position
     */
    private translateToRowHeaderPosition(relativeY: number): HeaderPosition | null {
        // Account for column header height (first row)
        const colHeaderHeight = this.rowHeights[0] || 0;
        const headerY = relativeY - colHeaderHeight;

        if (headerY < 0) return null;

        // Find row (skip column header row - index 0)
        let accumulatedHeight = 0;
        let row = -1;
        for (let r = 1; r < this.rowHeights.length; r++) {
            const rowHeight = this.rowHeights[r];
            if (headerY >= accumulatedHeight && headerY < accumulatedHeight + rowHeight) {
                row = r - 1; // Adjust for 0-based grid indexing
                break;
            }
            accumulatedHeight += rowHeight;
        }

        if (row >= 0 && row <= this.gridDimensions.maxRow) {
            return { index: row, headerType: 'row' as const };
        }

        return null;
    }

    /**
     * Translate coordinates to column header position
     */
    private translateToColHeaderPosition(relativeX: number): HeaderPosition | null {
        // Account for row header width (first column)
        const rowHeaderWidth = this.colWidths[0] || 0;
        const headerX = relativeX - rowHeaderWidth;

        if (headerX < 0) return null;

        // Find column (skip row header column - index 0)
        let accumulatedWidth = 0;
        let col = -1;
        for (let c = 1; c < this.colWidths.length; c++) {
            const colWidth = this.colWidths[c];
            if (headerX >= accumulatedWidth && headerX < accumulatedWidth + colWidth) {
                col = c - 1; // Adjust for 0-based grid indexing
                break;
            }
            accumulatedWidth += colWidth;
        }

        if (col >= 0 && col <= this.gridDimensions.maxCol) {
            return { index: col, headerType: 'col' as const };
        }

        return null;
    }

    /**
     * Generate CellMouseEvent from raw mouse event and position
     */
    generateCellMouseEvent(
        event: MouseEvent,
        position: GridPosition,
        type: GridMouseInteractionType
    ): CellMouseEvent {
        return {
            type,
            position,
            mouseEvent: event,
        };
    }

    /**
     * Generate HeaderMouseEvent from raw mouse event and position
     */
    generateHeaderMouseEvent(
        event: MouseEvent,
        position: HeaderPosition,
        type: GridMouseInteractionType
    ): HeaderMouseEvent {
        return {
            type,
            position,
            mouseEvent: event,
        };
    }

    /**
     * Handle intelligent mousemove - generates pseudo mouseenter events only when position changes
     * @param event - The mousemove event
     * @param containerType - Which container the mousemove occurred in
     * @returns CellMouseEvent or HeaderMouseEvent with type='mouseenter' if position changed, null otherwise
     */
    handleIntelligentMouseMove(
        event: MouseEvent,
        containerType: 'main' | 'rowHeaders' | 'colHeaders'
    ): CellMouseEvent | HeaderMouseEvent | null {
        const currentPosition = this.translateMouseToGridPosition(event, containerType);

        if (!currentPosition) return null;

        switch (containerType) {
            case 'main':
                if ('row' in currentPosition && 'col' in currentPosition) {
                    // Check if position changed
                    if (!this.lastKnownMainPosition ||
                        this.lastKnownMainPosition.row !== currentPosition.row ||
                        this.lastKnownMainPosition.col !== currentPosition.col) {

                        this.lastKnownMainPosition = currentPosition;
                        return this.generateCellMouseEvent(event, currentPosition, 'mouseenter');
                    }
                }
                break;

            case 'rowHeaders':
                if ('headerType' in currentPosition && currentPosition.headerType === 'row') {
                    // Check if position changed
                    if (!this.lastKnownRowHeaderPosition ||
                        this.lastKnownRowHeaderPosition.index !== currentPosition.index) {

                        this.lastKnownRowHeaderPosition = currentPosition;
                        return this.generateHeaderMouseEvent(event, currentPosition, 'mouseenter');
                    }
                }
                break;

            case 'colHeaders':
                if ('headerType' in currentPosition && currentPosition.headerType === 'col') {
                    // Check if position changed
                    if (!this.lastKnownColHeaderPosition ||
                        this.lastKnownColHeaderPosition.index !== currentPosition.index) {

                        this.lastKnownColHeaderPosition = currentPosition;
                        return this.generateHeaderMouseEvent(event, currentPosition, 'mouseenter');
                    }
                }
                break;
        }

        return null;
    }

    /**
     * Reset position tracking (useful when mouse leaves containers)
     */
    resetPositionTracking(containerType?: 'main' | 'rowHeaders' | 'colHeaders') {
        if (!containerType) {
            // Reset all
            this.lastKnownMainPosition = null;
            this.lastKnownRowHeaderPosition = null;
            this.lastKnownColHeaderPosition = null;
        } else {
            switch (containerType) {
                case 'main':
                    this.lastKnownMainPosition = null;
                    break;
                case 'rowHeaders':
                    this.lastKnownRowHeaderPosition = null;
                    break;
                case 'colHeaders':
                    this.lastKnownColHeaderPosition = null;
                    break;
            }
        }
    }
}
