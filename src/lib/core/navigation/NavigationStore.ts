import type {
    GridPosition,
    HeaderPosition,
    GridDimensions,
    NavigationState,
    NavigationAnchorsAndPointers,
    DraggingActionContext,
} from '../types/types.ts';

export class NavigationStore {
    private state: NavigationState = {
        pointerPosition: { row: 0, col: 0 },
        anchorPosition: { row: 0, col: 0 },
        navigationMode: false,
        headerAnchorRow: 0,
        headerPointerRow: 0,
        headerAnchorCol: 0,
        headerPointerCol: 0,
        isDragging: false,
        draggingContext: {
            isOutsideDragging: false,
        },
    };

    // ===================== MUTATIONS =====================

    setPointerPosition(position: GridPosition): void {
        this.state.pointerPosition = { ...position };
    }

    setAnchorPosition(position: GridPosition): void {
        this.state.anchorPosition = { ...position };
    }

    setMousePosition(position: GridPosition | HeaderPosition): void {
        this.state.mousePosition = { ...position };
    }

    clearMousePosition(): void {
        this.state.mousePosition = undefined;
    }

    setNavigationMode(active: boolean): void {
        this.state.navigationMode = active;
    }

    setDragging(isDragging: boolean): void {
        this.state.isDragging = isDragging;
    }

    setHeaderAnchorRow(row: number): void {
        this.state.headerAnchorRow = row;
    }

    setHeaderPointerRow(row: number): void {
        this.state.headerPointerRow = row;
    }

    setHeaderAnchorCol(col: number): void {
        this.state.headerAnchorCol = col;
    }

    setHeaderPointerCol(col: number): void {
        this.state.headerPointerCol = col;
    }

    setDraggingActionContext(context: DraggingActionContext): void {
        this.state.draggingContext = { ...context };
    }

    updateDraggingActionContext(updates: Partial<DraggingActionContext>): void {
        this.state.draggingContext = { ...this.state.draggingContext, ...updates };
    }

    // ===================== QUERIES =====================

    getPointerPosition(): GridPosition {
        return { ...this.state.pointerPosition };
    }

    getAnchorPosition(): GridPosition {
        return { ...this.state.anchorPosition };
    }

    getMousePosition(): GridPosition | HeaderPosition | undefined {
        return this.state.mousePosition ? { ...this.state.mousePosition } : undefined;
    }

    isNavigationMode(): boolean {
        return this.state.navigationMode;
    }

    isDragging(): boolean {
        return this.state.isDragging;
    }

    getHeaderAnchorRow(): number {
        return this.state.headerAnchorRow;
    }

    getHeaderPointerRow(): number {
        return this.state.headerPointerRow;
    }

    getHeaderAnchorCol(): number {
        return this.state.headerAnchorCol;
    }

    getHeaderPointerCol(): number {
        return this.state.headerPointerCol;
    }

    getDraggingActionContext(): DraggingActionContext {
        return { ...this.state.draggingContext };
    }

    getNavigationState(): NavigationState {
        return { ...this.state };
    }

    getNavigationAnchorsAndPointers(): NavigationAnchorsAndPointers {
        return {
            cellPointer: { ...this.state.pointerPosition },
            cellAnchor: { ...this.state.anchorPosition },
            headerAnchorRow: this.state.headerAnchorRow,
            headerPointerRow: this.state.headerPointerRow,
            headerAnchorCol: this.state.headerAnchorCol,
            headerPointerCol: this.state.headerPointerCol,
        };
    }

    getHeaderNavigationState(): {
        rowAnchor?: number;
        rowPointer?: number;
        colAnchor?: number;
        colPointer?: number;
    } {
        return {
            rowAnchor: this.state.headerAnchorRow,
            rowPointer: this.state.headerPointerRow,
            colAnchor: this.state.headerAnchorCol,
            colPointer: this.state.headerPointerCol,
        };
    }
}
