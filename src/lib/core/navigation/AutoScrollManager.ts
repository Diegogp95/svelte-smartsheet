import type {
    GridPosition,
    GridDimensions,
    DraggingActionContext,
    OutsideScrollAnalysis,
} from '../types/types.ts';
import type { ExternalEventPort } from '../ports/ExternalEventPort.ts';
import type { NavigationStore } from './NavigationStore.ts';
import type { DocumentMouseMoveCallback, AutoScrollSelectionCallback } from './NavigationHandler.ts';

/**
 * Manages outside-dragging detection, auto-scroll timers, and pointer movement
 * during drag operations that extend beyond the table boundaries.
 *
 * Owns its own state: isOutsideDragging, outsideDraggingState, rowTimerId, colTimerId.
 * Reads navigation state (dragType, pointers) from NavigationStore.
 * Triggers pointer movement via provided callbacks (no direct coupling to handler).
 */
export class AutoScrollManager {
    private externalEventPort?: ExternalEventPort;
    private documentMouseMoveCallback?: DocumentMouseMoveCallback;
    private autoScrollSelectionCallback?: AutoScrollSelectionCallback;

    // Own operational state
    private outsideDragging: boolean = false;
    private outsideDraggingState?: OutsideScrollAnalysis;
    private rowTimerId?: number;
    private colTimerId?: number;

    constructor(
        private store: NavigationStore,
        private getGridDimensions: () => GridDimensions,
        private onMovePointer: (position: GridPosition) => void,
        private onSetHeaderPointerRow: (row: number) => void,
        private onSetHeaderPointerCol: (col: number) => void,
        documentMouseMoveCallback?: DocumentMouseMoveCallback,
        autoScrollSelectionCallback?: AutoScrollSelectionCallback
    ) {
        this.documentMouseMoveCallback = documentMouseMoveCallback;
        this.autoScrollSelectionCallback = autoScrollSelectionCallback;
    }

    setExternalEventPort(port: ExternalEventPort): void {
        this.externalEventPort = port;
    }

    // ===================== QUERIES =====================

    isOutsideDragging(): boolean {
        return this.outsideDragging;
    }

    getOutsideDraggingState(): OutsideScrollAnalysis | undefined {
        return this.outsideDraggingState;
    }

    // ===================== LIFECYCLE =====================

    /** Call when drag starts (start-cell/row/col-drag or update-drag). */
    setupListeners(): void {
        if (!this.externalEventPort) {
            console.warn('[AutoScrollManager] No ExternalEventPort set — cannot register table listeners');
            return;
        }
        this.externalEventPort.registerTableListeners(
            this.handleTableMouseEnter,
            this.handleTableMouseLeave,
        );
    }

    /** Call when drag ends. Clears timers, removes all listeners, resets own state. */
    cleanup(): void {
        this.clearTimers();
        this.externalEventPort?.unregisterTableListeners();
        this.externalEventPort?.unregisterDocumentMouseMove();
        this.outsideDragging = false;
        this.outsideDraggingState = undefined;
    }

    /** Call during continue-drag when isOutsideDragging and outsideScrollAnalysis is present. */
    processOutsideScrollAnalysis(analysis: OutsideScrollAnalysis): void {
        this.outsideDraggingState = { ...analysis };
        this.ensureTimersRunning();
    }

    // ===================== EVENT HANDLERS =====================

    private handleTableMouseEnter = (_event: MouseEvent): void => {
        this.clearTimers();
        this.outsideDragging = false;
        this.externalEventPort?.unregisterDocumentMouseMove();
    }

    private handleTableMouseLeave = (_event: MouseEvent): void => {
        this.outsideDragging = true;
        this.setupDocumentMouseMoveListener();
    }

    // ===================== LISTENERS =====================

    private setupDocumentMouseMoveListener(): void {
        if (!this.documentMouseMoveCallback) {
            console.warn('[AutoScrollManager] No document mouse move callback available');
            return;
        }
        this.externalEventPort?.registerDocumentMouseMove(this.documentMouseMoveCallback);
    }

    // ===================== TIMER MANAGEMENT =====================

    private ensureTimersRunning(): void {
        const analysis = this.outsideDraggingState;
        if (!analysis) return;

        if (analysis.direction.row !== 0 && analysis.intervals.row && !this.rowTimerId) {
            this.startRecursiveRowTimer();
        }
        if (analysis.direction.col !== 0 && analysis.intervals.col && !this.colTimerId) {
            this.startRecursiveColTimer();
        }
        if (analysis.direction.row === 0 && this.rowTimerId) {
            clearTimeout(this.rowTimerId);
            this.rowTimerId = undefined;
        }
        if (analysis.direction.col === 0 && this.colTimerId) {
            clearTimeout(this.colTimerId);
            this.colTimerId = undefined;
        }
    }

    private clearTimers(): void {
        if (this.rowTimerId) {
            clearTimeout(this.rowTimerId);
            this.rowTimerId = undefined;
        }
        if (this.colTimerId) {
            clearTimeout(this.colTimerId);
            this.colTimerId = undefined;
        }
    }

    private startRecursiveRowTimer(): void {
        const execute = () => {
            const analysis = this.outsideDraggingState;
            if (!analysis || analysis.direction.row === 0) {
                this.rowTimerId = undefined;
                return;
            }
            this.executeAutoScroll('row', analysis.direction.row);
            this.rowTimerId = window.setTimeout(execute, analysis.intervals.row || 100);
        };
        execute();
    }

    private startRecursiveColTimer(): void {
        const execute = () => {
            const analysis = this.outsideDraggingState;
            if (!analysis || analysis.direction.col === 0) {
                this.colTimerId = undefined;
                return;
            }
            this.executeAutoScroll('col', analysis.direction.col);
            this.colTimerId = window.setTimeout(execute, analysis.intervals.col || 100);
        };
        execute();
    }

    // ===================== HELPERS =====================

    /** Assemble the full DraggingActionContext with current outside-dragging fields. */
    private buildContext(): DraggingActionContext {
        return {
            ...this.store.getDraggingActionContext(),
            isOutsideDragging: true,
            outsideDraggingState: this.outsideDraggingState,
        };
    }

    // ===================== AUTO-SCROLL EXECUTION =====================

    private executeAutoScroll(dimension: 'row' | 'col', direction: number): void {
        const dragType = this.store.getDraggingActionContext().dragType;
        switch (dragType) {
            case 'row':
                this.executeAutoScrollForRow(dimension, direction);
                break;
            case 'col':
                this.executeAutoScrollForCol(dimension, direction);
                break;
            default:
                this.executeAutoScrollForCell(dimension, direction);
                break;
        }
    }

    private executeAutoScrollForCell(dimension: 'row' | 'col', direction: number): void {
        const currentPos = this.store.getPointerPosition();
        const { maxRow, maxCol } = this.getGridDimensions();
        let newPosition: GridPosition;

        if (dimension === 'row') {
            const newRow = Math.max(0, Math.min(maxRow, currentPos.row + direction));
            newPosition = { row: newRow, col: currentPos.col };
        } else {
            const newCol = Math.max(0, Math.min(maxCol, currentPos.col + direction));
            newPosition = { row: currentPos.row, col: newCol };
        }

        if (newPosition.row !== currentPos.row || newPosition.col !== currentPos.col) {
            this.onMovePointer(newPosition);
            if (this.autoScrollSelectionCallback && this.store.isDragging()) {
                this.autoScrollSelectionCallback(newPosition, this.buildContext());
            }
        }
    }

    private executeAutoScrollForRow(dimension: 'row' | 'col', direction: number): void {
        if (dimension !== 'row') return;
        const currentRowPointer = this.store.getHeaderPointerRow();
        const currentCellPos = this.store.getPointerPosition();
        const { maxRow } = this.getGridDimensions();
        const newRowPointer = Math.max(0, Math.min(maxRow, currentRowPointer + direction));

        if (newRowPointer !== currentRowPointer) {
            this.onSetHeaderPointerRow(newRowPointer);
            const newCellPosition = { row: newRowPointer, col: currentCellPos.col };
            this.onMovePointer(newCellPosition);
            if (this.autoScrollSelectionCallback && this.store.isDragging()) {
                this.autoScrollSelectionCallback(newCellPosition, this.buildContext());
            }
        }
    }

    private executeAutoScrollForCol(dimension: 'row' | 'col', direction: number): void {
        if (dimension !== 'col') return;
        const currentColPointer = this.store.getHeaderPointerCol();
        const currentCellPos = this.store.getPointerPosition();
        const { maxCol } = this.getGridDimensions();
        const newColPointer = Math.max(0, Math.min(maxCol, currentColPointer + direction));

        if (newColPointer !== currentColPointer) {
            this.onSetHeaderPointerCol(newColPointer);
            const newCellPosition = { row: currentCellPos.row, col: newColPointer };
            this.onMovePointer(newCellPosition);
            if (this.autoScrollSelectionCallback && this.store.isDragging()) {
                this.autoScrollSelectionCallback(newCellPosition, this.buildContext());
            }
        }
    }
}
