import type { GridPosition, GridDimensions, NavigationState, CellComponent } from './types';

// Selection Handler - Manages cell selection state efficiently
export class SelectionHandler {
    private selectedCells: Set<string>;
    private cellComponents: Map<string, CellComponent>;

    constructor(cellComponents: Map<string, CellComponent>) {
        this.selectedCells = new Set<string>();
        this.cellComponents = cellComponents;
    }

    // Helper method to convert position to key
    private positionToKey(position: GridPosition): string {
        return `${position.row}-${position.col}`;
    }

    // Helper method to convert key to position
    private keyToPosition(key: string): GridPosition {
        const [row, col] = key.split('-').map(Number);
        return { row, col };
    }

    // Efficient update: only changes cells that actually changed state
    updateSelection(newSelection: Set<string>) {
        // Find cells to deselect (were selected, now not)
        const toDeselect = new Set<string>();
        this.selectedCells.forEach(key => {
            if (!newSelection.has(key)) {
                toDeselect.add(key);
            }
        });

        // Find cells to select (weren't selected, now are)
        const toSelect = new Set<string>();
        newSelection.forEach(key => {
            if (!this.selectedCells.has(key)) {
                toSelect.add(key);
            }
        });

        // Apply changes only to cells that changed
        this.applyCellChanges(toDeselect, toSelect);
        
        // Update internal set
        this.selectedCells = new Set(newSelection);
    }

    // Apply visual changes to Cell components
    private applyCellChanges(toDeselect: Set<string>, toSelect: Set<string>) {
        // Deselect specific cells
        toDeselect.forEach(key => {
            const cellComponent = this.cellComponents.get(key);
            if (cellComponent) {
                cellComponent.setSelected(false);
            }
        });

        // Select specific cells
        toSelect.forEach(key => {
            const cellComponent = this.cellComponents.get(key);
            if (cellComponent) {
                cellComponent.setSelected(true);
            }
        });
    }

    // Convenience methods that use updateSelection internally
    selectSingle(position: GridPosition) {
        const key = this.positionToKey(position);
        this.updateSelection(new Set([key])); // Only this cell
    }

    clearSelection() {
        this.updateSelection(new Set()); // Empty set
    }

    toggleCell(position: GridPosition) {
        const key = this.positionToKey(position);
        const newSelection = new Set(this.selectedCells);

        if (newSelection.has(key)) {
            newSelection.delete(key);
        } else {
            newSelection.add(key);
        }

        this.updateSelection(newSelection);
    }

    // Getters
    getSelectedCells(): Set<string> {
        return new Set(this.selectedCells);
    }

    getSelectedPositions(): GridPosition[] {
        return Array.from(this.selectedCells).map(key => this.keyToPosition(key));
    }

    isCellSelected(position: GridPosition): boolean {
        const key = this.positionToKey(position);
        return this.selectedCells.has(key);
    }
}

// Navigation Handler - Manages pointer position and navigation
export class NavigationHandler {
    private gridDimensions: GridDimensions;
    private navigationState: NavigationState;
    private tableContainer: HTMLDivElement | undefined;
    private cellComponents: Map<string, CellComponent>;

    constructor(gridDimensions: GridDimensions, cellComponents: Map<string, CellComponent>) {
        this.gridDimensions = gridDimensions;
        this.cellComponents = cellComponents;
        this.navigationState = {
            pointerPosition: { row: 0, col: 0 },
            navigationMode: false
        };
    }

    // Update container reference
    setTableContainer(container: HTMLDivElement) {
        this.tableContainer = container;
    }

    // Update grid dimensions
    updateGridDimensions(dimensions: GridDimensions) {
        this.gridDimensions = dimensions;
    }

    // Move pointer to specific position
    movePointer(position: GridPosition): GridPosition | null {
        const { maxRow, maxCol } = this.gridDimensions;

        if (position.row >= 0 && position.row <= maxRow &&
            position.col >= 0 && position.col <= maxCol) {
            this.navigationState.pointerPosition = { ...position };

            // Auto-scroll if container is available
            if (this.tableContainer) {
                this.scrollToPosition(position);
            }

            return { ...position };
        }

        return null;
    }

    // Process keyboard navigation
    processKeyboard(event: KeyboardEvent): GridPosition | null {
        if (!this.navigationState.navigationMode) return null;

        // Only process arrow keys
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
            return null;
        }

        // Prevent default arrow key behavior
        event.preventDefault();

        const { row, col } = this.navigationState.pointerPosition;
        const { maxRow, maxCol } = this.gridDimensions;
        let newPosition: GridPosition | null = null;

        switch (event.key) {
            case 'ArrowUp':
                if (row > 0) {
                    newPosition = { row: row - 1, col };
                }
                break;
            case 'ArrowDown':
                if (row < maxRow) {
                    newPosition = { row: row + 1, col };
                }
                break;
            case 'ArrowLeft':
                if (col > 0) {
                    newPosition = { row, col: col - 1 };
                }
                break;
            case 'ArrowRight':
                if (col < maxCol) {
                    newPosition = { row, col: col + 1 };
                }
                break;
        }
        
        if (newPosition) {
            this.navigationState.pointerPosition = newPosition;
            this.scrollToPosition(newPosition);
        }

        return this.navigationState.pointerPosition;
    }

    // Automatic scroll to keep pointer visible
    private scrollToPosition(position: GridPosition): void {
        if (!this.tableContainer) return;

        // Get cell element from components map (more efficient than DOM query)
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);

        if (!cellComponent) return;

        const cellElement = cellComponent.element;
        const container = this.tableContainer;
        const containerRect = container.getBoundingClientRect();
        const cellRect = cellElement.getBoundingClientRect();

        // Calculate positions relative to container scroll
        const scrollTop = container.scrollTop;
        const scrollLeft = container.scrollLeft;
        const containerHeight = container.clientHeight;
        const containerWidth = container.clientWidth;

        // Cell position relative to container
        const cellTop = cellRect.top - containerRect.top + scrollTop;
        const cellBottom = cellTop + cellRect.height;
        const cellLeft = cellRect.left - containerRect.left + scrollLeft;
        const cellRight = cellLeft + cellRect.width;

        // Calculate new vertical scroll
        let newScrollTop = scrollTop;
        if (cellTop < scrollTop) {
            // Cell is above visible area
            newScrollTop = cellTop;
        } else if (cellBottom > scrollTop + containerHeight) {
            // Cell is below visible area
            newScrollTop = cellBottom - containerHeight;
        }

        // Calculate new horizontal scroll
        let newScrollLeft = scrollLeft;
        if (cellLeft < scrollLeft) {
            // Cell is to the left of visible area
            newScrollLeft = cellLeft;
        } else if (cellRight > scrollLeft + containerWidth) {
            // Cell is to the right of visible area
            newScrollLeft = cellRight - containerWidth;
        }

        // Apply smooth scroll if there are changes
        if (newScrollTop !== scrollTop || newScrollLeft !== scrollLeft) {
            container.scrollTo({
                top: newScrollTop,
                left: newScrollLeft,
                behavior: 'smooth'
            });
        }
    }

    // Navigation mode control
    activateNavigation(): boolean {
        this.navigationState.navigationMode = true;
        if (this.tableContainer) {
            this.tableContainer.focus();
        }
        return true;
    }

    deactivateNavigation(): boolean {
        this.navigationState.navigationMode = false;
        return false;
    }

    // Getters
    getCurrentPosition(): GridPosition {
        return { ...this.navigationState.pointerPosition };
    }

    isNavigationMode(): boolean {
        return this.navigationState.navigationMode;
    }

    getNavigationState(): NavigationState {
        return { ...this.navigationState };
    }
}

// Main Controller - Mediates between navigation and selection
export class SmartSheetController {
    private gridDimensions: GridDimensions;
    private cellComponents: Map<string, CellComponent>;
    private navigationHandler: NavigationHandler;
    private selectionHandler: SelectionHandler;

    constructor(initialDimensions: GridDimensions) {
        this.cellComponents = new Map();
        this.gridDimensions = initialDimensions;

        // Initialize handlers with shared references
        this.selectionHandler = new SelectionHandler(this.cellComponents);
        this.navigationHandler = new NavigationHandler(this.gridDimensions, this.cellComponents);
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

    // Click on cell: navigate + select (EFFICIENT)
    handleCellClick(position: GridPosition) {
        // 1. Navigate
        this.navigationHandler.movePointer(position);

        // 2. Select only the clicked cell (deselects others automatically)
        this.selectionHandler.selectSingle(position);
    }

    // Keyboard navigation: process input and update selection
    handleKeyDown(event: KeyboardEvent): GridPosition {
        // Get current pointer position after processing keyboard input
        const currentPosition = this.navigationHandler.processKeyboard(event);

        // Always update selection to match current pointer position
        // This ensures selection stays in sync with navigation
        if (currentPosition && this.navigationHandler.isNavigationMode()) {
            this.selectionHandler.selectSingle(currentPosition);
        }

        // Return current pointer position for UI updates
        return currentPosition || this.navigationHandler.getCurrentPosition();
    }

    // Activate navigation: select current cell
    activateNavigation() {
        this.navigationHandler.activateNavigation();
        const currentPosition = this.navigationHandler.getCurrentPosition();
        this.selectionHandler.selectSingle(currentPosition);
        return true;
    }

    // Deactivate navigation: clear selection
    deactivateNavigation() {
        this.navigationHandler.deactivateNavigation();
        this.selectionHandler.clearSelection();
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

    // Public access to handlers (for future extensibility)
    get selection() {
        return this.selectionHandler;
    }

    get navigation() {
        return this.navigationHandler;
    }
}
