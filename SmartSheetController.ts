import type {
    GridPosition,
    GridDimensions,
    CellComponent,
    RawKeyboardAnalysis,
} from './types';
import InputAnalyzer from './InputAnalyzer';
import NavigationHandler from './NavigationHandler';
import SelectionHandler from './SelectionHandler';
import type { SelectionChangedCallback } from './SelectionHandler';

// Main Controller - Mediates between navigation and selection
export default class SmartSheetController {
    private gridDimensions: GridDimensions;
    private cellComponents: Map<string, CellComponent>;
    private navigationHandler: NavigationHandler;
    private selectionHandler: SelectionHandler;
    private inputAnalyzer: InputAnalyzer;

    constructor(initialDimensions: GridDimensions, onSelectionsChanged?: SelectionChangedCallback) {
        this.cellComponents = new Map();
        this.gridDimensions = initialDimensions;

        // Initialize handlers with shared references
        this.selectionHandler = new SelectionHandler(this.cellComponents, onSelectionsChanged);
        this.navigationHandler = new NavigationHandler(this.gridDimensions, this.cellComponents);
        this.inputAnalyzer = new InputAnalyzer();
    }

    // Register cell component (called from SmartSheet.svelte)
    registerCell(cellComponent: CellComponent) {
        const key = `${cellComponent.position.row}-${cellComponent.position.col}`;
        this.cellComponents.set(key, cellComponent);
    }

    // Unregister cell component (for cleanup)
    unregisterCell(position: GridPosition) {
        const key = `${position.row}-${position.col}`;
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
    handleCellClick(position: GridPosition, mouseEvent?: MouseEvent): GridPosition {
        // Analyze click with specialized analysis
        const clickAnalysis = this.inputAnalyzer.analyzeClick(mouseEvent, position);

        // Delegate navigation and anchor coordination to NavigationHandler
        const newPosition = this.navigationHandler.processMouseNavigation(clickAnalysis);
        const anchorPosition = this.navigationHandler.getAnchor() || newPosition;

        // Delegate selection logic to SelectionHandler with complete context
        this.selectionHandler.processClickSelection(clickAnalysis, newPosition, anchorPosition);

        return newPosition;
    }

    // Keyboard navigation: process input and update selection
    handleKeyDown(event: KeyboardEvent): GridPosition {
        // PHASE 1: Basic analysis for categorization
        const basicAnalysis = this.inputAnalyzer.analyzeEvent(event);

        // Handle preventDefault if needed
        if (basicAnalysis.shouldPreventDefault) {
            event.preventDefault();
        }

        // PHASE 2: Process by category
        if (basicAnalysis.keyCategory === 'arrow') {
            return this.handleNavigationKey(basicAnalysis);
        } else if (basicAnalysis.keyCategory === 'confirm') {
            // TODO: Implement Enter/Tab handling
            return this.navigationHandler.getCurrentPosition();
        } else if (basicAnalysis.keyCategory === 'delete') {
            // TODO: Implement Delete/Backspace handling
            return this.navigationHandler.getCurrentPosition();
        }

        // Other categories not processed yet
        return this.navigationHandler.getCurrentPosition();
    }

    // Handle navigation keys with specialized analysis
    private handleNavigationKey(basicAnalysis: RawKeyboardAnalysis): GridPosition {
        // PHASE 2: Specialized navigation analysis
        const navAnalysis = this.inputAnalyzer.analyzeNavigation(basicAnalysis);

        // Delegate to NavigationHandler with complete analysis
        const currentPosition = this.navigationHandler.processKeyboardNavigation(navAnalysis);
        const anchorPosition = this.navigationHandler.getAnchor() || currentPosition;

        // Delegate selection logic to SelectionHandler with complete context
        this.selectionHandler.processNavigationSelection(navAnalysis, currentPosition, anchorPosition);

        return currentPosition;
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
    getCurrentCellValue(): string | number | undefined {
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
