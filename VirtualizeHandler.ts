import type {
    GridDimensions,
    GridPosition,
    CellComponent,
    HeaderComponent,
    HeaderPosition,
	VisibleComponents,
	RenderArea,
} from './types';

// Callback types for virtualization subscriptions
export type VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> = 
    (handler: VirtualizeHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;
export type RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> = 
    (handler: VirtualizeHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

export default class VirtualizeHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private gridDimensions: GridDimensions;
    private renderArea: RenderArea;
    private visibleArea: RenderArea;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent;
    private tableContainer: HTMLDivElement | null = null;
    private rowHeights: number[] = [];
    private colWidths: number[] = [];

    // Subscription callbacks
    onVisibleComponentsChanged?: VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    onRenderAreaChanged?: RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;

    constructor(
        gridDimensions: GridDimensions,
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent,
        onVisibleComponentsChanged?: VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onRenderAreaChanged?: RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
    ) {
        this.gridDimensions = gridDimensions;
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.onVisibleComponentsChanged = onVisibleComponentsChanged;
        this.onRenderAreaChanged = onRenderAreaChanged;

        // Initialize render area with zero bounds
        this.renderArea = {
            startRow: 0,
            endRow: 0,
            startCol: 0,
            endCol: 0
        };
        this.visibleArea = {
            startRow: 0,
            endRow: 0,
            startCol: 0,
            endCol: 0
        };
    }

    setTableContainer(container: HTMLDivElement) {
        this.tableContainer = container;
    }

    setRowHeights(heights: number[]) {
        this.rowHeights = heights;
    }

    setColWidths(widths: number[]) {
        this.colWidths = widths;
    }

    // Initialize the handler with container dimensions (called on mount)
    initialize(
        tableContainer: HTMLDivElement,
        rowHeights: number[],
        colWidths: number[]
    ) {
        this.setTableContainer(tableContainer);
        this.setRowHeights(rowHeights);
        this.setColWidths(colWidths);
        // Calculate initial render area based on container size
        const [initialRenderArea, initialVisibleArea] = this.calculateRenderArea();

        this.updateRenderArea(initialRenderArea, initialVisibleArea);
    }

    // Helper method to convert position to key
    private positionToKey(position: GridPosition): string {
        return `${position.row}-${position.col}`;
    }

    // Get current render area
    getRenderArea(): RenderArea {
        return { ...this.renderArea };
    }

    getVisibleArea(): RenderArea {
        return { ...this.visibleArea };
    }

    // Update render area and notify subscribers
    updateRenderArea(newRenderArea: Partial<RenderArea>, newVisibleArea: Partial<RenderArea>) {
        const prevRenderArea = { ...this.renderArea };

        // Update render area with bounds checking
        this.renderArea = {
            startRow: Math.max(0, newRenderArea.startRow ?? this.renderArea.startRow),
            endRow: Math.min(this.gridDimensions.maxRow, newRenderArea.endRow ?? this.renderArea.endRow),
            startCol: Math.max(0, newRenderArea.startCol ?? this.renderArea.startCol),
            endCol: Math.min(this.gridDimensions.maxCol, newRenderArea.endCol ?? this.renderArea.endCol),
        };

        this.visibleArea = {
            startRow: Math.max(0, newVisibleArea.startRow ?? this.visibleArea.startRow),
            endRow: Math.min(this.gridDimensions.maxRow, newVisibleArea.endRow ?? this.visibleArea.endRow),
            startCol: Math.max(0, newVisibleArea.startCol ?? this.visibleArea.startCol),
            endCol: Math.min(this.gridDimensions.maxCol, newVisibleArea.endCol ?? this.visibleArea.endCol),
        };

        // Notify subscribers if render area actually changed
        if (this.hasRenderAreaChanged(prevRenderArea, this.renderArea)) {
            if (this.onRenderAreaChanged) {
                this.onRenderAreaChanged(this);
            }
            if (this.onVisibleComponentsChanged) {
                this.onVisibleComponentsChanged(this);
            }
        }
    }

    // Check if render area has actually changed
    private hasRenderAreaChanged(prev: RenderArea, current: RenderArea): boolean {
        return prev.startRow !== current.startRow ||
               prev.endRow !== current.endRow ||
               prev.startCol !== current.startCol ||
               prev.endCol !== current.endCol;
    }

    // Calculate visible components based on current render area
    getVisibleComponents(): VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps> {
        const cells: CellComponent<TExtraProps>[] = [];
        const rowHeaders: HeaderComponent<TRowHeaderProps>[] = [];
        const colHeaders: HeaderComponent<TColHeaderProps>[] = [];

        // Extract visible cells
        for (let row = this.renderArea.startRow; row <= this.renderArea.endRow; row++) {
            for (let col = this.renderArea.startCol; col <= this.renderArea.endCol; col++) {
                const key = this.positionToKey({ row, col });
                const cellComponent = this.cellComponents.get(key);
                if (cellComponent) {
                    cells.push(cellComponent);
                }
            }
        }

        // Extract visible row headers
        for (let row = this.renderArea.startRow; row <= this.renderArea.endRow; row++) {
            const key = `row-${row}`;
            const headerComponent = this.rowHeaderComponents.get(key);
            if (headerComponent) {
                rowHeaders.push(headerComponent);
            }
        }

        // Extract visible column headers
        for (let col = this.renderArea.startCol; col <= this.renderArea.endCol; col++) {
            const key = `col-${col}`;
            const headerComponent = this.colHeaderComponents.get(key);
            if (headerComponent) {
                colHeaders.push(headerComponent);
            }
        }

        return { cells, rowHeaders, colHeaders, cornerHeader: this.cornerHeaderComponent };
    }

    // Calculate render area based on scroll position and container dimensions
    calculateRenderArea(
        overscan: number = 3 // Extra rows/cols to render outside visible area
    ): [RenderArea, RenderArea] {
        // Calculate visible row range
        let accumulatedHeight = 0;
        let startRow = 0;
        let endRow = this.gridDimensions.maxRow;
        let startVisibleRow = 0;
        let endVisibleRow = this.gridDimensions.maxRow;

        const scrollTop = this.tableContainer?.scrollTop || 0;
        const containerHeight = this.tableContainer?.clientHeight || 0;
        const scrollLeft = this.tableContainer?.scrollLeft || 0;
        const containerWidth = this.tableContainer?.clientWidth || 0;

        // Find start row
        for (let row = 0; row <= this.gridDimensions.maxRow; row++) {
            const rowHeight = this.rowHeights[row] || 32; // Default height
            if (accumulatedHeight + rowHeight > scrollTop) {
                startVisibleRow = Math.max(0, row);
                startRow = Math.max(0, row - overscan);
                break;
            }
            accumulatedHeight += rowHeight;
        }

        // Find end row
        accumulatedHeight = 0;
        for (let row = 0; row <= this.gridDimensions.maxRow; row++) {
            const rowHeight = this.rowHeights[row] || 32;
            accumulatedHeight += rowHeight;
            if (accumulatedHeight > scrollTop + containerHeight) {
                endVisibleRow = Math.min(this.gridDimensions.maxRow, row);
                endRow = Math.min(this.gridDimensions.maxRow, row + overscan);
                break;
            }
        }

        // Calculate visible column range
        let accumulatedWidth = 0;
        let startCol = 0;
        let endCol = this.gridDimensions.maxCol;
        let startVisibleCol = 0;
        let endVisibleCol = this.gridDimensions.maxCol;

        // Find start column
        for (let col = 0; col <= this.gridDimensions.maxCol; col++) {
            const colWidth = this.colWidths[col] || 120; // Default width
            if (accumulatedWidth + colWidth > scrollLeft) {
                startVisibleCol = Math.max(0, col);
                startCol = Math.max(0, col - overscan);
                break;
            }
            accumulatedWidth += colWidth;
        }

        // Find end column
        accumulatedWidth = 0;
        for (let col = 0; col <= this.gridDimensions.maxCol; col++) {
            const colWidth = this.colWidths[col] || 120;
            accumulatedWidth += colWidth;
            if (accumulatedWidth > scrollLeft + containerWidth) {
                endVisibleCol = Math.min(this.gridDimensions.maxCol, col);
                endCol = Math.min(this.gridDimensions.maxCol, col + overscan);
                break;
            }
        }

        return [{ startRow, endRow, startCol, endCol }, { startRow: startVisibleRow, endRow: endVisibleRow, startCol: startVisibleCol, endCol: endVisibleCol }];
    }

    // Update render area based on scroll and container information
    handleScroll() {
        if (!this.rowHeights.length || !this.colWidths.length || !this.tableContainer) {
            return;
        }
        const [newRenderArea, newVisibleArea] = this.calculateRenderArea();
        this.updateRenderArea(newRenderArea, newVisibleArea);
    }
}
