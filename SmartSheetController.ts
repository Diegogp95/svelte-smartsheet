import type {
    GridPosition,
    GridDimensions,
    CellComponent,
    RawKeyboardAnalysis,
    CellMouseEvent,
    CellValue,
} from './types';
import InputAnalyzer from './InputAnalyzer';
import NavigationHandler from './NavigationHandler';
import SelectionHandler from './SelectionHandler';
import DataHandler from './DataHandler';
import type { SelectionChangedCallback } from './SelectionHandler';
import type { PointerPositionCallback } from './NavigationHandler';

// Main Controller - Mediates between navigation and selection
export default class SmartSheetController {
    private gridDimensions: GridDimensions;
    private cellComponents: Map<string, CellComponent>;
    private navigationHandler: NavigationHandler;
    private selectionHandler: SelectionHandler;
    private inputAnalyzer: InputAnalyzer;
    private dataHandler: DataHandler;

    constructor(initialDimensions: GridDimensions,
        onSelectionsChanged?: SelectionChangedCallback,
        pointerPositionCallback?: PointerPositionCallback,
        onDeselectionsChanged?: SelectionChangedCallback,
    ) {
        this.cellComponents = new Map();
        this.gridDimensions = initialDimensions;

        // Initialize handlers with shared references
        this.selectionHandler = new SelectionHandler(this.cellComponents, onSelectionsChanged, onDeselectionsChanged);
        this.navigationHandler = new NavigationHandler(this.gridDimensions, this.cellComponents, pointerPositionCallback);
        this.inputAnalyzer = new InputAnalyzer();
        this.dataHandler = new DataHandler(this.cellComponents);

        // Setup clipboard event handlers
        this.setupClipboardHandlers();
    }

    // Setup clipboard event handlers for better clipboard detection
    private setupClipboardHandlers(): void {
        // Listen for paste events
        document.addEventListener('paste', (event: ClipboardEvent) => {
            if (this.isNavigationMode()) {
                event.preventDefault();
                event.stopPropagation();

                const clipboardText = event.clipboardData?.getData('text/plain') || '';
                this.handlePasteFromClipboard(clipboardText);
            }
        }, { capture: true });

        // Listen for copy events
        document.addEventListener('copy', (event: ClipboardEvent) => {
            if (this.isNavigationMode()) {
                event.preventDefault();
                event.stopPropagation();

                this.handleCopyToClipboard(event);
            }
        }, { capture: true });

        // Listen for cut events
        document.addEventListener('cut', (event: ClipboardEvent) => {
            if (this.isNavigationMode()) {
                event.preventDefault();
                event.stopPropagation();

                this.handleCutToClipboard(event);
            }
        }, { capture: true });
    }

    // Process clipboard text and paste into grid
    private handlePasteFromClipboard(clipboardText: string): void {
        if (!clipboardText || clipboardText.trim() === '') {
            return;
        }

        const currentPosition = this.navigationHandler.getCurrentPosition();
        const pasteData = this.dataHandler.parseClipboardText(clipboardText);
        const success = this.dataHandler.paste(currentPosition, pasteData);
    }

    // Handle copy to clipboard
    private handleCopyToClipboard(event: ClipboardEvent): void {
        const selectedPositions = this.selectionHandler.getSelectedPositions();
        if (selectedPositions.length === 0) {
            // If no selection, copy current cell
            const currentPosition = this.navigationHandler.getCurrentPosition();
            selectedPositions.push(currentPosition);
        }

        // Create clipboard data using DataHandler
        const clipboardData = this.dataHandler.formatClipboardData(selectedPositions);

        if (event.clipboardData) {
            event.clipboardData.setData('text/plain', clipboardData);
        }
    }

    // Handle cut to clipboard
    private handleCutToClipboard(event: ClipboardEvent): void {
        const selectedPositions = this.selectionHandler.getSelectedPositions();
        if (selectedPositions.length === 0) {
            // If no selection, cut current cell
            const currentPosition = this.navigationHandler.getCurrentPosition();
            selectedPositions.push(currentPosition);
        }

        // Create clipboard data using DataHandler
        const clipboardData = this.dataHandler.formatClipboardData(selectedPositions);

        if (event.clipboardData) {
            event.clipboardData.setData('text/plain', clipboardData);
            // Delete the cell values after copying (that's what makes it "cut")
            this.dataHandler.deleteCellsValues(selectedPositions);
        }
    }

    // Register cell component (called from SmartSheet.svelte)
    registerCell(cellComponent: CellComponent) {
        const key = `${cellComponent.position.row}-${cellComponent.position.col}`;
        this.cellComponents.set(key, cellComponent);
    }

    // Unregister cell component (for cleanup)
    unregisterCell(cellComponent: CellComponent) {
        const key = `${cellComponent.position.row}-${cellComponent.position.col}`;
        this.cellComponents.delete(key);
    }

    // Update container reference
    setTableContainer(container: HTMLDivElement) {
        this.navigationHandler.setTableContainer(container);
    }

    // Update grid dimensions (when data structure changes)
    updateGridDimensions(dimensions: GridDimensions) {
        this.gridDimensions = dimensions;
        this.navigationHandler.updateGridDimensions(dimensions);
    }

    // Click on cell: navigate + select with modifier support
    handleMouseEvent(cellMouseEvent: CellMouseEvent) {
        // Analyze click with specialized analysis
        const clickAnalysis = this.inputAnalyzer.analyzeMouseEvent(cellMouseEvent);

        // Wheel should not trigger neither navigation nor selection
        if (clickAnalysis.clickType === 'wheel') {
            return;
        }

        const oldPosition = this.navigationHandler.getCurrentPosition();
        const oldAnchor = this.navigationHandler.getAnchor();

        // dblclick should not navigate, since the previous mousedown already did
        // Delegate selection logic to SelectionHandler with complete context
        if (clickAnalysis.clickType === 'double') {
            this.dataHandler.startEditingCell(oldPosition);
            this.selectionHandler.clearSelections();
            return;
        }

        // Delegate navigation and anchor coordination to NavigationHandler
        const newPosition = this.navigationHandler.processMouseNavigation(clickAnalysis);
        const anchorPosition = this.navigationHandler.getAnchor() || newPosition;

        // If the position didn't change, we can skip selection logic
        // Except for mouseup, since mousedown + mouseup in the same cell must select the cell
        if (this.navigationHandler.comparePositions(oldPosition, newPosition) &&
        this.navigationHandler.comparePositions(oldAnchor || { row: -1, col: -1 }, anchorPosition) &&
        clickAnalysis.type !== 'mouseup') {
            return;
        }

        this.selectionHandler.processClickSelection(clickAnalysis, newPosition, anchorPosition);
    }

    // Keyboard navigation: process input and update selection
    handleKeyDown(event: KeyboardEvent) {
        // PHASE 1: Basic analysis for categorization
        const basicAnalysis = this.inputAnalyzer.analyzeEvent(event);

        // Handle preventDefault if needed
        if (basicAnalysis.shouldPreventDefault) {
            event.preventDefault();
        }
        const currentPosition = this.navigationHandler.getCurrentPosition();

        // PHASE 2: Process by category
        if (basicAnalysis.keyCategory === 'arrow') {
            return this.handleNavigationKey(basicAnalysis);
        } else if (basicAnalysis.keyCategory === 'command') {
            const commandAnalysis = this.inputAnalyzer.analyzeCommand(basicAnalysis);
            if (commandAnalysis.command === 'undo') {
                this.dataHandler.undo();
                return;
            } else if (commandAnalysis.command === 'redo') {
                this.dataHandler.redo();
                return;
            } else {
                //console.warn(`[SmartSheetController] Unhandled command: ${commandAnalysis.command}`);
                return;
            }
        } else if (basicAnalysis.keyCategory === 'write' || basicAnalysis.keyCategory === 'backspace') {
            // Handle writing input (e.g. typing in a cell)
            this.dataHandler.startEditingCell(currentPosition, basicAnalysis.key);
            this.selectionHandler.clearSelections();
            return;
        } else if (basicAnalysis.keyCategory === 'delete') {
            const selections = this.selectionHandler.getSelectedPositions();
            this.dataHandler.deleteCellsValues(selections);
            return;
        } else if (basicAnalysis.keyCategory === 'edit') {
            // Handle edit input (e.g. pressing Enter in a cell)
            this.dataHandler.startEditingCell(currentPosition);
            this.selectionHandler.clearSelections();
            return;
        } else if (basicAnalysis.keyCategory === 'space') {
            // TODO: Implement Delete/Backspace handling
            return;
        }
        // Other categories not processed yet
    }

    handleCellInputCommit(position: GridPosition, event: KeyboardEvent) {
        this.dataHandler.finishCellEdit(position, 'commit');
        if (event.key === 'Enter') {
            this.navigationHandler.navigateToNextDownCell();
        } else if (event.key === 'Tab') {
            this.navigationHandler.navigateToNextRightCell();
        } // Shouuldn't be triggered by other keys
        // Re-select the current position after commit
        this.selectionHandler.selectSingle(this.navigationHandler.getCurrentPosition());
    }

    handleCellInputCancel(position: GridPosition, event: KeyboardEvent) {
        this.dataHandler.finishCellEdit(position, 'cancel');
        // Re-select the current position after cancel
        this.selectionHandler.selectSingle(this.navigationHandler.getCurrentPosition());
    }

    // Handle navigation keys with specialized analysis
    private handleNavigationKey(basicAnalysis: RawKeyboardAnalysis) {
        // PHASE 2: Specialized navigation analysis
        const navAnalysis = this.inputAnalyzer.analyzeNavigation(basicAnalysis);

        // Delegate to NavigationHandler with complete analysis
        const currentPosition = this.navigationHandler.processKeyboardNavigation(navAnalysis);
        const anchorPosition = this.navigationHandler.getAnchor() || currentPosition;

        // Delegate selection logic to SelectionHandler with complete context
        this.selectionHandler.processNavigationSelection(navAnalysis, currentPosition, anchorPosition);

    }

    handleInputBlur(position: GridPosition) {
        // Delegate to DataHandler to set cell not editing
        this.dataHandler.finishCellEdit(position, 'blur');
    }

    // Activate navigation: select current cell only if no selection exists
    activateNavigation() {
        this.navigationHandler.activateNavigation();
        // Only auto-select current position if there's no existing selection
        const currentSelection = this.selectionHandler.getSelectedCells();
        if (currentSelection.size === 0) {
            const currentPosition = this.navigationHandler.getCurrentPosition();
            this.selectionHandler.selectSingle(currentPosition);
        }
        return true;
    }

    // Deactivate navigation: don't clear selection
    deactivateNavigation() {
        this.navigationHandler.deactivateNavigation();
        return false;
    }

    // Getters for state
    getCurrentPosition(): GridPosition {
        return this.navigationHandler.getCurrentPosition();
    }

    isNavigationMode(): boolean {
        return this.navigationHandler.isNavigationMode();
    }

    getSelectedCells(): Set<string> {
        return this.selectionHandler.getSelectedCells();
    }

    isCellSelected(position: GridPosition): boolean {
        return this.selectionHandler.isCellSelected(position);
    }

    // Get current cell value (from the cell component itself)
    getCurrentCellValue(): CellValue | undefined {
        const position = this.getCurrentPosition();
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        return cellComponent?.value;
    }

    // PUBLIC API for external selection control
    selectPositions(positions: GridPosition[]): void {
        const keys = positions.map(pos => `${pos.row}-${pos.col}`);
        this.selectionHandler.updateSelection(new Set(keys));
    }

    addToSelection(positions: GridPosition[]): void {
        const currentSelection = this.selectionHandler.getSelectedCells();
        const newKeys = positions.map(pos => `${pos.row}-${pos.col}`);
        newKeys.forEach(key => currentSelection.add(key));
        this.selectionHandler.updateSelection(currentSelection);
    }

    removeFromSelection(positions: GridPosition[]): void {
        const currentSelection = this.selectionHandler.getSelectedCells();
        const keysToRemove = positions.map(pos => `${pos.row}-${pos.col}`);
        keysToRemove.forEach(key => currentSelection.delete(key));
        this.selectionHandler.updateSelection(currentSelection);
    }

    navigateToPosition(position: GridPosition): boolean {
        const result = this.navigationHandler.movePointer(position);
        return result !== null;
    }

    // Helper to get grid info for external logic
    getGridDimensions(): GridDimensions {
        return { ...this.gridDimensions };
    }

    // Helper to get all positions in grid
    getAllPositions(): GridPosition[] {
        const positions: GridPosition[] = [];
        for (let row = 0; row <= this.gridDimensions.maxRow; row++) {
            for (let col = 0; col <= this.gridDimensions.maxCol; col++) {
                positions.push({ row, col });
            }
        }
        return positions;
    }

    // Public access to handlers (for future extensibility)
    get selection() {
        return this.selectionHandler;
    }

    get navigation() {
        return this.navigationHandler;
    }

    getSelections() {
        return this.selectionHandler.getSelections();
    }
}
