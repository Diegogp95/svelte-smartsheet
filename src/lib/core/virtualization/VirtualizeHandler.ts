import type {
    GridDimensions,
    GridPosition,
    CellComponent,
    HeaderComponent,
    HeaderPosition,
	VisibleComponents,
	RenderArea,
} from '../types/types.ts';
import type { ViewportPort } from '../ports/ViewportPort.ts';
import { positionToKey } from '../utils/utils.ts';
import { computeRenderArea } from './RenderAreaAlgorithms.ts';
import { ScaleManager } from './ScaleManager.ts';

// Callback types for virtualization subscriptions
export type VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> = 
    (handler: VirtualizeHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;
export type RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> = 
    (handler: VirtualizeHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

export type ScaleChangeCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    (handler: VirtualizeHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

export default class VirtualizeHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private gridDimensions: GridDimensions;
    private renderArea: RenderArea;
    private visibleArea: RenderArea;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent;
    private viewportPort?: ViewportPort;
    private scaleManager: ScaleManager = new ScaleManager();

    // Subscription callbacks
    onVisibleComponentsChanged?: VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    onRenderAreaChanged?: RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    onScaleChanged?: ScaleChangeCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;

    constructor(
        gridDimensions: GridDimensions,
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent,
        onVisibleComponentsChanged?: VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onScaleChanged?: ScaleChangeCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onRenderAreaChanged?: RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
    ) {
        this.gridDimensions = gridDimensions;
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.onVisibleComponentsChanged = onVisibleComponentsChanged;
        this.onScaleChanged = onScaleChanged;
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

    setViewportPort(port: ViewportPort): void {
        this.viewportPort = port;
    }

    setRowHeights(heights: number[]) {
        this.scaleManager.setRowHeights(heights);
    }

    setColWidths(widths: number[]) {
        this.scaleManager.setColWidths(widths);
    }

    // Initialize the handler with container dimensions (called on mount)
    initialize(
        rowHeights: number[],
        colWidths: number[]
    ) {
        this.setRowHeights(rowHeights);
        this.setColWidths(colWidths);
        // Calculate initial render area based on container size
        const [initialRenderArea, initialVisibleArea] = this.calculateRenderArea();

        this.updateRenderArea(initialRenderArea, initialVisibleArea);
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
                const key = positionToKey({ row, col });
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
    calculateRenderArea(overscan: number = 1): [RenderArea, RenderArea] {
        const state = this.viewportPort?.getScrollState();
        return computeRenderArea(
            this.scaleManager.getRowHeights(),
            this.scaleManager.getColWidths(),
            this.gridDimensions,
            state?.scrollTop ?? 0,
            state?.scrollLeft ?? 0,
            state?.viewportHeight ?? 0,
            state?.viewportWidth ?? 0,
            overscan,
        );
    }

    // Update render area based on scroll and container information
    handleScroll() {
        if (!this.scaleManager.getRowHeights().length || !this.scaleManager.getColWidths().length || !this.viewportPort) {
            return;
        }
        const [newRenderArea, newVisibleArea] = this.calculateRenderArea();
        this.updateRenderArea(newRenderArea, newVisibleArea);
    }

    // ==================== SCALING METHODS ====================

    setScaleFactor(factor: number): void {
        this.scaleManager.setScaleFactor(factor);
    }

    /**
     * Main entry point for scaling visualization
     * @param wheelDeltaY Raw wheel deltaY value from wheel event (positive = scroll down, negative = scroll up)
     */
    async scaleVisualization(wheelDeltaY: number): Promise<void> {
        const MIN_SCALE = 0.5;  // Minimum 50% scale
        const MAX_SCALE = 2.0;  // Maximum 200% scale
        const SCALE_STEP = 0.1; // 10% per wheel step

        // Calculate scale delta: positive deltaY = zoom out, negative deltaY = zoom in
        const scaleDelta = wheelDeltaY > 0 ? -SCALE_STEP : SCALE_STEP;

        const currentScale = this.scaleManager.getScaleFactor();
        const newScale = currentScale + scaleDelta;

        // Check bounds
        if (newScale < MIN_SCALE || newScale > MAX_SCALE) {
            console.log(`[VirtualizeHandler] Scale ${newScale.toFixed(2)}x out of bounds [${MIN_SCALE}-${MAX_SCALE}]`);
            return;
        }

        // Update scale factor and shared dimension arrays
        this.scaleManager.setScaleFactor(newScale);
        this.scaleManager.updateSharedDimensionsFromBase();

        // Recalculate render area with new scaled dimensions
        if (this.viewportPort && this.scaleManager.getRowHeights().length && this.scaleManager.getColWidths().length) {
            const [newRenderArea, newVisibleArea] = this.calculateRenderArea();
            this.updateRenderArea(newRenderArea, newVisibleArea);
        }

        // Trigger callbacks, these update the grid dimensions and font size in the parent component
        // then triggers re-rendering
        if (this.onScaleChanged) {
            this.onScaleChanged(this);
        }
        if (this.onVisibleComponentsChanged) {
            this.onVisibleComponentsChanged(this);
        }
    }

    getScaleFactor(): number {
        return this.scaleManager.getScaleFactor();
    }

    getScaledFontSize(baseFontSize: string): string {
        return this.scaleManager.getScaledFontSize(baseFontSize);
    }

    getRowHeights(): number[] {
        return this.scaleManager.getRowHeights();
    }

    getColWidths(): number[] {
        return this.scaleManager.getColWidths();
    }
}
