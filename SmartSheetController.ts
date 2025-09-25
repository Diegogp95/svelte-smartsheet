import type {
    GridPosition,
    GridDimensions,
    CellComponent,
    RawKeyboardAnalysis,
    CellMouseEvent,
    CellValue,
    BackgroundProperties,
    TailwindProperties,
    HeaderPosition,
    HeaderComponent,
    HeaderMouseEvent,
    HeaderValue,
    FlashOptions,
    GridMouseInteractionType,
} from './types';
import InputAnalyzer from './InputAnalyzer';
import MouseEventTranslator from './MouseEventTranslator';
import NavigationHandler from './NavigationHandler';
import SelectionHandler from './SelectionHandler';
import DataHandler from './DataHandler';
import type { SelectionChangedCallback } from './SelectionHandler';
import type { PointerPositionCallback, AutoScrollSelectionCallback } from './NavigationHandler';
import type { EditingStateCallback } from './DataHandler';
import ColorHandler from './ColorHandler';
import VirtualizeHandler from './VirtualizeHandler';
import type { VisibleComponentsCallback, RenderAreaCallback } from './VirtualizeHandler';

// Main Controller - Mediates between navigation and selection
export default class SmartSheetController<TExtraProps = undefined,
    TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    // Instance identifier for unique DOM element IDs
    private instanceId: string = Math.random().toString(36).substr(2, 9);

    // Handlers
    private navigationHandler: NavigationHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private selectionHandler: SelectionHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private dataHandler: DataHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private colorHandler: ColorHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private virtualizeHandler: VirtualizeHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private inputAnalyzer: InputAnalyzer;
    private mouseEventTranslator: MouseEventTranslator;
    // Data
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent;
    // Props
    private gridDimensions: GridDimensions;
    private headersReadOnly: boolean;
    // Clipboard event listeners references for cleanup
    private pasteListener: ((event: ClipboardEvent) => void) | null = null;
    private copyListener: ((event: ClipboardEvent) => void) | null = null;
    private cutListener: ((event: ClipboardEvent) => void) | null = null;
    // Separate header components by type for different extraProps handling
    // Style
    private styleMode: 'style' | 'tailwind'; // Default to inline styles0
    // ExtraProps schema registry for homogeneous structures
    private extraPropsSchema = {
        cellProperties: new Set<keyof TExtraProps>(),
        rowHeaderProperties: new Set<keyof TRowHeaderProps>(),
        colHeaderProperties: new Set<keyof TColHeaderProps>(),
        analyzed: false
    };

    constructor(initialDimensions: GridDimensions,
        gridData: CellValue[][],
        rowHeaders: HeaderValue[] | undefined,
        colHeaders: HeaderValue[] | undefined,
        rowsTitle: string | undefined,
        cellsExtraProps: TExtraProps[][] | undefined,
        rowHeaderProps: TRowHeaderProps[] | undefined,
        colHeaderProps: TColHeaderProps[] | undefined,
        styleMode: 'style' | 'tailwind',
        headersReadOnly: boolean,
        onSelectionsChanged?: SelectionChangedCallback,
        pointerPositionCallback?: PointerPositionCallback,
        onDeselectionsChanged?: SelectionChangedCallback,
        onVisibleComponentsChanged?: VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onRenderAreaChanged?: RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onEditingStateChanged?: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
    ) {
        this.gridDimensions = initialDimensions;
        this.styleMode = styleMode;
        this.headersReadOnly = headersReadOnly;

        // Initialize data maps - BUILD FROM INPUT DATA
        this.cellComponents = this.buildCellComponentsMap(gridData, cellsExtraProps);
        this.rowHeaderComponents = this.buildRowHeaderComponentsMap(rowHeaders, rowHeaderProps);
        this.colHeaderComponents = this.buildColHeaderComponentsMap(colHeaders, colHeaderProps);

        this.cornerHeaderComponent = {
            value: rowsTitle || '',
            position: { index: 0, headerType: 'corner' },
            selected: false,
            editing: false,
            extraProps: undefined,
            styles: {
                styling: '',
                tailwindStyling: '',
            },
        };

        // Initialize handlers with populated data maps
        this.selectionHandler = new SelectionHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>(
            this.cellComponents,
            this.rowHeaderComponents,
            this.colHeaderComponents,
            this.cornerHeaderComponent,
            onSelectionsChanged,
            onDeselectionsChanged
        );
        this.navigationHandler = new NavigationHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>(
            this.gridDimensions,
            this.cellComponents,
            this.rowHeaderComponents,
            this.colHeaderComponents,
            this.cornerHeaderComponent,
            pointerPositionCallback,
            this.handleDocumentMouseMove,
            this.handleAutoScrollSelection
        );
        this.inputAnalyzer = new InputAnalyzer();
        this.mouseEventTranslator = new MouseEventTranslator(this.gridDimensions);
        this.dataHandler = new DataHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>(
            this.cellComponents,
            this.rowHeaderComponents,
            this.colHeaderComponents,
            this.cornerHeaderComponent,
            this.instanceId,
            onEditingStateChanged
        );
        this.colorHandler = new ColorHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>(
            this.gridDimensions,
            this.styleMode,
            this.cellComponents,
            this.rowHeaderComponents,
            this.colHeaderComponents,
            this.cornerHeaderComponent,
            this.instanceId,
        );
        this.virtualizeHandler = new VirtualizeHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>(
            this.gridDimensions,
            this.cellComponents,
            this.rowHeaderComponents,
            this.colHeaderComponents,
            this.cornerHeaderComponent,
            onVisibleComponentsChanged,
            onRenderAreaChanged,
        );

        // Clipboard listeners will be added/removed based on navigation mode
    };

        /**
     * Build cell components map from grid data
     * Creates CellComponent objects with data and state, no DOM elements
     */
    private buildCellComponentsMap(
        gridData: CellValue[][],
        cellsExtraProps: TExtraProps[][] | undefined
    ): Map<string, CellComponent<TExtraProps>> {
        const cellMap = new Map<string, CellComponent<TExtraProps>>();
        for (let row = 0; row < gridData.length; row++) {
            for (let col = 0; col < gridData[row].length; col++) {
                const position: GridPosition = { row, col };
                const key = this.positionToKey(position);
                const cellComponent: CellComponent<TExtraProps> = {
                    position,
                    value: gridData[row][col] ?? '',
                    selected: false,
                    extraProps: cellsExtraProps?.[row]?.[col] as TExtraProps,
                    styles: {
                        styling: '',
                        tailwindStyling: '',
                    }
                };
                cellMap.set(key, cellComponent);
            }
        }
        return cellMap;
    }

    /**
     * Build row header components map from header data
     */
    private buildRowHeaderComponentsMap(
        rowHeaders: HeaderValue[] | undefined,
        rowHeaderProps: TRowHeaderProps[] | undefined
    ): Map<string, HeaderComponent<TRowHeaderProps>> {
        const headerMap = new Map<string, HeaderComponent<TRowHeaderProps>>();

        // If no rowHeaders provided, create default headers based on grid dimensions
        const headerCount = rowHeaders ? rowHeaders.length : this.gridDimensions.maxRow + 1;

        for (let index = 0; index < headerCount; index++) {
            const position: HeaderPosition = { headerType: 'row', index };
            const key = `row-${index}`;
            const headerComponent: HeaderComponent<TRowHeaderProps> = {
                position,
                value: rowHeaders?.[index] ?? (index + 1).toString(),
                selected: false,
                editing: false,
                extraProps: rowHeaderProps?.[index] as TRowHeaderProps,
                styles: {
                    styling: '',
                    tailwindStyling: ''
                }
            };
            headerMap.set(key, headerComponent);
        }
        return headerMap;
    }

    /**
     * Build column header components map from header data
     */
    private buildColHeaderComponentsMap(
        colHeaders: HeaderValue[] | undefined,
        colHeaderProps: TColHeaderProps[] | undefined
    ): Map<string, HeaderComponent<TColHeaderProps>> {
        const headerMap = new Map<string, HeaderComponent<TColHeaderProps>>();

        // If no colHeaders provided, create default headers based on grid dimensions
        const headerCount = colHeaders ? colHeaders.length : this.gridDimensions.maxCol + 1;

        for (let index = 0; index < headerCount; index++) {
            const position: HeaderPosition = { headerType: 'col', index };
            const key = `col-${index}`;
            const headerComponent: HeaderComponent<TColHeaderProps> = {
                position,
                value: colHeaders?.[index] ?? this.generateColumnLabel(index),
                selected: false,
                editing: false,
                extraProps: colHeaderProps?.[index] as TColHeaderProps,
                styles: {
                    styling: '',
                    tailwindStyling: ''
                }
            };
            headerMap.set(key, headerComponent);
        }
        return headerMap;
    }

    /**
     * Helper method to convert position to key
     */
    private positionToKey(position: GridPosition): string {
        return `${position.row}-${position.col}`;
    }

    /**
     * Helper method to generate column labels (A, B, C, ... AA, AB, etc.)
     */
    private generateColumnLabel(index: number): string {
        let result = '';
        let num = index;
        do {
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26) - 1;
        } while (num >= 0);
        return result;
    }

    /**
     * Handle document mouse move events during outside dragging
     * This will be called by NavigationHandler when mouse is outside table during drag
     */
    private handleDocumentMouseMove = (event: MouseEvent): void => {
        // Create synthetic analysis for outside dragging
        const draggingContext = this.navigationHandler.getDraggingActionContext();
        const analysis = this.inputAnalyzer.createOutsideScrollAnalysis(
            event,
            this.navigationHandler.getTableContainer() as HTMLDivElement,
            draggingContext,
        );

        // Process the navigation action through the normal flow
        this.navigationHandler.processMouseNavigation(analysis);
    }

    /**
     * Handle auto-scroll selection updates during outside dragging
     * This will be called by NavigationHandler when auto-scroll moves the pointer
     */
    private handleAutoScrollSelection = (position: GridPosition): void => {
        if (!this.navigationHandler.isDragging()) {
            return;
        }

        const anchor = this.navigationHandler.getAnchor();

        // Create synthetic analysis for continue-drag with update-selection
        const analysis = this.inputAnalyzer.createContinueDragAnalysis(position, anchor);

        // Process selection update
        this.selectionHandler.processMouseSelection(analysis, position, anchor);

        // Reflect selections on headers
        this.reflectSelectionsOnHeaders();
    }

    // Helper method to reflect cell selections on headers after any selection change
    private reflectSelectionsOnHeaders(): void {
        const selectedCells = this.selectionHandler.getSelectedCells();
        this.selectionHandler.reflectCellSelections(selectedCells);
    }

    // Add clipboard event handlers when entering navigation mode
    private addClipboardHandlers(): void {
        // Only add if not already added
        if (this.pasteListener) {
            return;
        }

        // Create listener functions that can be referenced for removal
        this.pasteListener = (event: ClipboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const clipboardText = event.clipboardData?.getData('text/plain') || '';
            this.handlePasteFromClipboard(clipboardText);
        };

        this.copyListener = (event: ClipboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            this.handleCopyToClipboard(event);
        };

        this.cutListener = (event: ClipboardEvent) => {
            event.preventDefault();
            event.stopPropagation();

            this.handleCutToClipboard(event);
        };

        // Add listeners to document
        document.addEventListener('paste', this.pasteListener, { capture: true });
        document.addEventListener('copy', this.copyListener, { capture: true });
        document.addEventListener('cut', this.cutListener, { capture: true });
    }

    // Remove clipboard event handlers when leaving navigation mode
    private removeClipboardHandlers(): void {
        if (this.pasteListener) {
            document.removeEventListener('paste', this.pasteListener, { capture: true });
            this.pasteListener = null;
        }

        if (this.copyListener) {
            document.removeEventListener('copy', this.copyListener, { capture: true });
            this.copyListener = null;
        }

        if (this.cutListener) {
            document.removeEventListener('cut', this.cutListener, { capture: true });
            this.cutListener = null;
        }
    }

    // Process clipboard text and paste into grid
    private handlePasteFromClipboard(clipboardText: string): void {
        if (!clipboardText || clipboardText.trim() === '') {
            return;
        }

        const currentPosition = this.navigationHandler.getCurrentPosition();
        const pasteData = this.dataHandler.parseClipboardText(clipboardText);
        const success = this.dataHandler.paste(currentPosition, pasteData);
        // Need to update the rendered area if paste was successful
        if (success) {
            // execute the virtualization callback to refresh visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
        }
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
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
        }
    }

    // Maps getters
    getCellComponents(): Map<string, CellComponent<TExtraProps>> {
        return this.cellComponents;
    }

    getColHeaderComponents(): Map<string, HeaderComponent<TColHeaderProps>> {
        return this.colHeaderComponents;
    }

    getRowHeaderComponents(): Map<string, HeaderComponent<TRowHeaderProps>> {
        return this.rowHeaderComponents;
    }

    getCornerHeaderComponent(): HeaderComponent {
        return this.cornerHeaderComponent;
    }

    // Update container reference

    setUpNavigator(tableContainer: HTMLDivElement, rowHeights: number[], colWidths: number[]) {
        this.navigationHandler.setTableContainer(tableContainer);
        this.navigationHandler.setRowHeights(rowHeights);
        this.navigationHandler.setColWidths(colWidths);

        // Setup mouseEventTranslator with same data
        this.mouseEventTranslator.setTableContainer(tableContainer);
        this.mouseEventTranslator.setRowHeights(rowHeights);
        this.mouseEventTranslator.setColWidths(colWidths);
    }

    setRowHeights(heights: number[]) {
        this.navigationHandler.setRowHeights(heights);
        this.mouseEventTranslator.setRowHeights(heights);
    }

    setColWidths(widths: number[]) {
        this.navigationHandler.setColWidths(widths);
        this.mouseEventTranslator.setColWidths(widths);
    }

    // Update header containers references
    setColumnsHeaderContainer(container: HTMLDivElement) {
        this.navigationHandler.setColumnsHeaderContainer(container);
        this.mouseEventTranslator.setColHeadersContainer(container);
    }

    setRowsHeaderContainer(container: HTMLDivElement) {
        this.navigationHandler.setRowsHeaderContainer(container);
        this.mouseEventTranslator.setRowHeadersContainer(container);
    }

    // Set main grid container reference
    setMainGridContainer(container: HTMLDivElement) {
        this.mouseEventTranslator.setMainGridContainer(container);
    }

    // Update grid dimensions (when data structure changes)
    updateGridDimensions(dimensions: GridDimensions) {
        this.gridDimensions = dimensions;
        this.navigationHandler.updateGridDimensions(dimensions);
        this.mouseEventTranslator.updateGridDimensions(dimensions);
    }

    // ==================== MOUSE EVENT HANDLERS WITH TRANSLATION ====================

    /**
     * Unified mouse event handler for all container types
     * Handles validation, translation, and event generation
     */
    private handleUnifiedMouseEvent(
        event: MouseEvent,
        eventType: GridMouseInteractionType,
        containerType: 'main' | 'rowHeaders' | 'colHeaders' | 'corner'
    ) {
        // Prevent mousedown/mouseup when click count > 1 (double click handling)
        if ((eventType === 'mousedown' || eventType === 'mouseup') && event.detail > 1) {
            return;
        }

        // Only allow left click (button === 0) for mousedown/mouseup events
        if ((eventType === 'mousedown' || eventType === 'mouseup') && event.button !== 0) {
            return;
        }

        const position = this.mouseEventTranslator.translateMouseToGridPosition(event, containerType);

        if (!position) {
            return;
        }

        // Generate appropriate event based on position type
        if ('row' in position && 'col' in position) {
            // Cell event for main grid
            const cellMouseEvent = this.mouseEventTranslator.generateCellMouseEvent(event, position, eventType);

            // Connect to existing system
            this.handleMouseEvent(new CustomEvent('cell-mouse', { detail: cellMouseEvent }));

        } else if ('headerType' in position) {
            // Header event for all header types
            const headerMouseEvent = this.mouseEventTranslator.generateHeaderMouseEvent(event, position, eventType);

            // Connect to existing system
            this.handleMouseEvent(new CustomEvent('header-mouse', { detail: headerMouseEvent }));
        }
    }

    /**
     * Handle mouse events from the main grid container
     */
    handleMainGridMouseEvent(event: MouseEvent, eventType: GridMouseInteractionType) {
        this.handleUnifiedMouseEvent(event, eventType, 'main');
    }

    /**
     * Handle mouse events from row headers container
     */
    handleRowHeaderMouseEvent(event: MouseEvent, eventType: GridMouseInteractionType) {
        this.handleUnifiedMouseEvent(event, eventType, 'rowHeaders');
    }

    /**
     * Handle mouse events from column headers container
     */
    handleColHeaderMouseEvent(event: MouseEvent, eventType: GridMouseInteractionType) {
        this.handleUnifiedMouseEvent(event, eventType, 'colHeaders');
    }

    /**
     * Handle mouse events from corner header
     */
    handleCornerHeaderMouseEvent(event: MouseEvent, eventType: GridMouseInteractionType) {
        this.handleUnifiedMouseEvent(event, eventType, 'corner');
    }

    // ==================== INTELLIGENT MOUSEMOVE HANDLERS ====================

    /**
     * Unified intelligent mousemove handler for all container types
     */
    handleUnifiedMouseMove(event: MouseEvent, containerType: 'main' | 'rowHeaders' | 'colHeaders') {
        const pseudoEvent = this.mouseEventTranslator.handleIntelligentMouseMove(event, containerType);

        if (pseudoEvent) {
            // Connect to existing system
            if ('row' in pseudoEvent.position && 'col' in pseudoEvent.position) {
                this.handleMouseEvent(new CustomEvent('cell-mouse', { detail: pseudoEvent }));
            } else if ('headerType' in pseudoEvent.position) {
                this.handleMouseEvent(new CustomEvent('header-mouse', { detail: pseudoEvent }));
            }
        }
    }

    /**
     * Handle mouseleave from containers to reset position tracking
     */
    handleContainerMouseLeave(containerType: 'main' | 'rowHeaders' | 'colHeaders') {
        this.mouseEventTranslator.resetPositionTracking(containerType);
    }

    // ==================== END INTELLIGENT MOUSEMOVE HANDLERS ====================

    // ==================== END MOUSE EVENT HANDLERS ====================

    // Unified mouse event handler: process both cell and header events
    handleMouseEvent(event: CustomEvent<CellMouseEvent | HeaderMouseEvent>) {
        const context = this.navigationHandler.getDraggingActionContext();
        const isDragging = this.navigationHandler.isDragging();
        const analysis = this.inputAnalyzer.analyzeMouseEvent(event.detail, isDragging, context);

        // Double click sets the cell or header in editing
        if (analysis.type === 'dblclick') {
            this.selectionHandler.clearSelections();
            if (analysis.componentType === 'cell') {
                this.dataHandler.startEditingComponent(analysis.position as GridPosition, 'cell');
            } else if (analysis.componentType === 'header' && !this.headersReadOnly) {
                this.dataHandler.startEditingComponent(analysis.position as HeaderPosition, 'header');
            }
            return;
        } else if (analysis.type === 'middleclick') {
            // Middle click should not trigger navigation or selection
            event.stopPropagation();
            return;
        } else if (analysis.type === 'contextmenu') {
            // Handle context menu (right-click) events
            event.preventDefault();
            event.stopPropagation();
            // For future implementation
            return;
        }

        // Process navigation actions
        this.navigationHandler.processMouseNavigation(analysis);

        // Get new positions after navigation
        const newPosition = this.navigationHandler.getCurrentPosition();
        const anchorPosition = this.navigationHandler.getAnchor();

        // Process selection actions
        this.selectionHandler.processMouseSelection(analysis, newPosition, anchorPosition);

        // Reflect selections on headers
        this.reflectSelectionsOnHeaders();
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
        } else if (basicAnalysis.keyCategory === 'tab') {
            let newPos: GridPosition;
            if (basicAnalysis.modifiers.shift) {
                newPos = this.navigationHandler.navigateToPreviousCell();
            } else {
                this.navigationHandler.navigateToNextCell();
                newPos = this.navigationHandler.getCurrentPosition();
            }
                this.selectionHandler.selectSingle(newPos);
                this.reflectSelectionsOnHeaders();
                return;
        } else if (basicAnalysis.keyCategory === 'command') {
            const commandAnalysis = this.inputAnalyzer.analyzeCommand(basicAnalysis);
            if (commandAnalysis.command === 'undo') {
                const [affectedPositions, componentType] = this.dataHandler.undo();
                if (affectedPositions.length > 0) {
                    // Update the visible components
                    this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
                    // Visually flash the affected cells (only rendered ones)
                    if (componentType === 'cell') {
                        this.flashCells(
                            affectedPositions as GridPosition[],
                            { color: 'red' }
                        );
                    } else {
                        this.flashHeaders(
                            affectedPositions as HeaderPosition[],
                            { color: 'red' }
                        );
                    }
                }
                return;
            } else if (commandAnalysis.command === 'redo') {
                const [affectedPositions, componentType] = this.dataHandler.redo();
                if (affectedPositions.length > 0) {
                    // Update the visible components
                    this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
                    if (componentType === 'cell') {
                        this.flashCells(
                            affectedPositions as GridPosition[],
                            { color: 'blue' }
                        );
                    } else {
                        this.flashHeaders(
                            affectedPositions as HeaderPosition[],
                            { color: 'blue' }
                        );
                    }
                }
                return;
            } else {
                //console.warn(`[SmartSheetController] Unhandled command: ${commandAnalysis.command}`);
                return;
            }
        } else if (basicAnalysis.keyCategory === 'write' || basicAnalysis.keyCategory === 'backspace') {
            // Handle writing input (e.g. typing in a cell)
            this.dataHandler.startEditingComponent(currentPosition, 'cell', basicAnalysis.key);
            this.selectionHandler.clearSelections();
            this.reflectSelectionsOnHeaders();
            return;
        } else if (basicAnalysis.keyCategory === 'delete') {
            const selections = this.selectionHandler.getSelectedPositions();
            this.dataHandler.deleteCellsValues(selections);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            return;
        } else if (basicAnalysis.keyCategory === 'edit') {
            // Handle edit input (e.g. pressing Enter in a cell)
            this.dataHandler.startEditingComponent(currentPosition, 'cell');
            this.selectionHandler.clearSelections();
            this.reflectSelectionsOnHeaders();
            return;
        } else if (basicAnalysis.keyCategory === 'space') {
            // TODO: Implement Delete/Backspace handling
            return;
        }
        // Other categories not processed yet
    }

    handleInputCommit(event: KeyboardEvent) {
        this.dataHandler.finishComponentEdit('commit');
        if (event.key === 'Enter') {
            this.navigationHandler.navigateToNextDownCell();
        } else if (event.key === 'Tab') {
            this.navigationHandler.navigateToNextRightCell();
        } // Shouuldn't be triggered by other keys
        // Re-select the current position after commit
        this.selectionHandler.selectSingle(this.navigationHandler.getCurrentPosition());
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
        this.reflectSelectionsOnHeaders();
    }

    handleInputCancel(event: KeyboardEvent) {
        this.dataHandler.finishComponentEdit('cancel');
        // Re-select the current position after cancel
        this.selectionHandler.selectSingle(this.navigationHandler.getCurrentPosition());
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
        this.reflectSelectionsOnHeaders();
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
        //this.reflectSelectionsOnHeaders();

    }

    handleInputBlur() {
        // Delegate to DataHandler to set cell not editing
        this.dataHandler.finishComponentEdit('blur');
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Activate navigation: select current cell only if no selection exists
    activateNavigation() {
        this.navigationHandler.activateNavigation();
        // Add clipboard listeners when entering navigation mode
        this.addClipboardHandlers();

        // Only auto-select current position if there's no existing selection
        const currentSelection = this.selectionHandler.getSelectedCells();
        if (currentSelection.size === 0) {
            const currentPosition = this.navigationHandler.getCurrentPosition();
            //this.selectionHandler.selectSingle(currentPosition);
            this.reflectSelectionsOnHeaders();
        }
        return true;
    }

    // Deactivate navigation: don't clear selection
    deactivateNavigation() {
        this.navigationHandler.deactivateNavigation();
        // Remove clipboard listeners when leaving navigation mode
        this.removeClipboardHandlers();

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

    // Get instance ID for unique element identification
    getInstanceId(): string {
        return this.instanceId;
    }

    // Get current cell value (from the cell component itself)
    getCurrentCellValue(): CellValue | undefined {
        const position = this.getCurrentPosition();
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        return cellComponent?.value;
    }

    // === VIRTUALIZATION METHODS ===

    // Initialize virtualization with container dimensions (called on mount)
    initializeVirtualization(tableContainer: HTMLDivElement,
        rowHeights: number[],
        colWidths: number[]
    ): void {
        this.virtualizeHandler.initialize(
            tableContainer, rowHeights, colWidths
        );
    }

    // Handle scroll events for virtualization
    handleVirtualizationScroll(): void {
        this.virtualizeHandler.handleScroll();
    }

    // Get current render area
    getRenderArea() {
        return this.virtualizeHandler.getRenderArea();
    }

    // Get visible components for current render area
    getVisibleComponents() {
        return this.virtualizeHandler.getVisibleComponents();
    }

    // =============================================================================================
    // ===================== PUBLIC API - Methods exposed for external control =====================
    // =============================================================================================

    selectPositions(positions: GridPosition[]): void {
        // Clear existing selections first
        this.selectionHandler.clearSelections();
        // Add individual selections for each position
        this.selectionHandler.addMultipleSelections(positions);
        this.reflectSelectionsOnHeaders();
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

    // PUBLIC API for background control (supports single or batch via tuple arrays)

    private _applyCellStyleArgs<T>(
        arg1: GridPosition | GridPosition[] | [GridPosition, T][],
        arg2: T | undefined,
        handlerMethod: (pos: GridPosition, value: T) => void,
        methodName: string
    ): void {
        if (Array.isArray(arg1)) {
            if (arg1.length > 0 && Array.isArray(arg1[0])) {
                for (const [pos, value] of arg1 as [GridPosition, T][]) {
                    handlerMethod(pos, value);
                }
            } else if (arg2 !== undefined) {
                for (const pos of arg1 as GridPosition[]) {
                    handlerMethod(pos, arg2);
                }
            } else {
                console.warn(`[SmartSheetController] ${methodName} requires either an array of [position, value] tuples or a position and a value.`);
            }
        } else if (arg2 !== undefined) {
            handlerMethod(arg1 as GridPosition, arg2);
        } else {
            console.warn(`[SmartSheetController] ${methodName} requires either an array of [position, value] tuples or a position and a value.`);
        }
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    setCellBackgroundColor(
        arg1: GridPosition | GridPosition[] | [GridPosition, string][],
        arg2?: string
    ): void {
        this._applyCellStyleArgs(arg1, arg2, this.colorHandler.changeCellBackgroundColor.bind(this.colorHandler), 'setCellBackgroundColor');
    }

    // setCellTailwindBackgroundColor
    setCellTailwindBackgroundColor(
        arg1: GridPosition | GridPosition[] | [GridPosition, string][],
        arg2?: string
    ): void {
        this._applyCellStyleArgs(arg1, arg2, this.colorHandler.changeCellTailwindBackgroundColor.bind(this.colorHandler), 'setCellTailwindBackgroundColor');
    }

    // setCellStyle for styling
    setCellStyle(
        arg1: GridPosition | GridPosition[] | [GridPosition, BackgroundProperties][],
        arg2?: BackgroundProperties
    ): void {
        this._applyCellStyleArgs(arg1, arg2, this.colorHandler.setCellStyling.bind(this.colorHandler), 'setCellStyle');
    }

    // setTailwindProperties
    setTailwindProperties(
        arg1: GridPosition | GridPosition[] | [GridPosition, TailwindProperties][],
        arg2?: TailwindProperties
    ): void {
        this._applyCellStyleArgs(arg1, arg2, this.colorHandler.setCellTailwindStyling.bind(this.colorHandler), 'setTailwindProperties');
    }

    // Batch background styles via generator
    applyBackgroundStyles(styleGenerator: (cells: Map<string, CellComponent>) => [GridPosition, BackgroundProperties][]): void {
        this.colorHandler.applyBackgroundStyles(styleGenerator as any);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Batch tailwind styles via generator
    applyTailwindStyles(styleGenerator: (cells: Map<string, CellComponent>) => [GridPosition, TailwindProperties][]): void {
        this.colorHandler.applyTailwindStyles(styleGenerator as any);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Reset all cell backgrounds to default
    resetAllBackgrounds(): void {
        this.colorHandler.applyDefaultStyles('cell');
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Selection API that takes a function aware of cell structure
    applySelections(
        selectionGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[]
    ): void {
        const positions = selectionGenerator(this.cellComponents);
        this.selectPositions(positions);
    }

    // Navigation APIs that take functions aware of cell structure
    navigateToFirst(
        cellMatcher: (cell: CellComponent<TExtraProps>) => boolean
    ): boolean {
        const success = this.navigationHandler.navigateToFirst(cellMatcher);

        // If navigation was successful, select the cell
        if (success) {
            const currentPosition = this.navigationHandler.getCurrentPosition();
            this.selectionHandler.selectSingle(currentPosition);
            this.reflectSelectionsOnHeaders();
        }

        return success;
    }

    navigateToNext(
        cellMatcher: (cell: CellComponent<TExtraProps>) => boolean
    ): boolean {
        const success = this.navigationHandler.navigateToNext(cellMatcher);
        // If navigation was successful, select the cell
        if (success) {
            const currentPosition = this.navigationHandler.getCurrentPosition();
            this.selectionHandler.selectSingle(currentPosition);
            this.reflectSelectionsOnHeaders();
        }
        return success;
    }

    // Data imputation APIs
    imputeValues(imputations: [GridPosition, CellValue][]): GridPosition[] {
        const affectedPositions = this.dataHandler.imputeValues(imputations);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
        if (affectedPositions.length > 0) {
            this.flashCells(
                affectedPositions,
                { color: 'green' }
            );
        }
        return affectedPositions;
    }

    applyImputations(
        imputationGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, CellValue][]
    ): GridPosition[] {
        const affectedPositions = this.dataHandler.applyImputations(imputationGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
        if (affectedPositions.length > 0) {
            this.flashCells(
                affectedPositions,
                { color: 'green' }
            );
        }
        return affectedPositions;
    }

    // ==================== VISUAL EFFECTS APIs ====================

    /**
     * Trigger flash effect on multiple cells
     */
    flashCells(positions: GridPosition[], options?: FlashOptions): void {
        const visibleComponents = this.virtualizeHandler.getVisibleComponents();
        this.colorHandler.flashCells(positions, visibleComponents, options);
    }

    flashHeaders(positions: HeaderPosition[], options?: FlashOptions): void {
        const visibleComponents = this.virtualizeHandler.getVisibleComponents();
        this.colorHandler.flashHeaders(positions, visibleComponents, options);
    }

    /**
     * Trigger flash effect using a generator function
     */
    applyFlashEffect(
        flashGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[],
        options?: FlashOptions
    ): void {
        const visibleComponents = this.virtualizeHandler.getVisibleComponents();
        this.colorHandler.applyFlashEffect(flashGenerator, visibleComponents, options);
    }

    // ==================== HEADER STYLING API ====================

    private _applyHeaderStyleArgs<T>(
        headerType: 'row' | 'col' | 'corner',
        arg1: number | number[] | [number, T][],
        arg2: T | undefined,
        handlerMethod: (type: 'row' | 'col' | 'corner', index: number, value: T) => void,
        methodName: string
    ): void {
        if (Array.isArray(arg1)) {
            if (arg1.length > 0 && Array.isArray(arg1[0])) {
                for (const [index, value] of arg1 as [number, T][]) {
                    handlerMethod(headerType, index, value);
                }
            } else if (arg2 !== undefined) {
                for (const index of arg1 as number[]) {
                    handlerMethod(headerType, index, arg2);
                }
            } else {
                console.warn(`[SmartSheetController] ${methodName} requires either an array of [index, value] tuples or an index and a value.`);
            }
        } else if (arg2 !== undefined) {
            handlerMethod(headerType, arg1 as number, arg2);
        } else {
            console.warn(`[SmartSheetController] ${methodName} requires either an array of [index, value] tuples or an index and a value.`);
        }
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Header styling methods (supports single or batch via tuple arrays)
    setHeaderBackgroundColor(
        type: 'row' | 'col' | 'corner',
        arg1: number | number[] | [number, string][],
        arg2?: string
    ): void {
        this._applyHeaderStyleArgs(type, arg1, arg2, this.colorHandler.changeHeaderBackgroundColor.bind(this.colorHandler), 'setHeaderBackgroundColor');
    }

    setHeaderTextColor(
        type: 'row' | 'col' | 'corner',
        arg1: number | number[] | [number, string][],
        arg2?: string
    ): void {
        this._applyHeaderStyleArgs(type, arg1, arg2, this.colorHandler.changeHeaderTextColor.bind(this.colorHandler), 'setHeaderTextColor');
    }

    setHeaderStyle(
        type: 'row' | 'col' | 'corner',
        arg1: number | number[] | [number, BackgroundProperties][],
        arg2?: BackgroundProperties
    ): void {
        this._applyHeaderStyleArgs(type, arg1, arg2, this.colorHandler.setHeaderStyling.bind(this.colorHandler), 'setHeaderStyle');
    }

    setHeaderTailwindStyle(
        type: 'row' | 'col' | 'corner',
        arg1: number | number[] | [number, TailwindProperties][],
        arg2?: TailwindProperties
    ): void {
        this._applyHeaderStyleArgs(type, arg1, arg2, this.colorHandler.setHeaderTailwindStyling.bind(this.colorHandler), 'setHeaderTailwindStyle');
    }

    // Batch header styles via generators
    applyRowHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        this.colorHandler.applyRowHeaderBackgroundStyles(styleGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    applyColHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        this.colorHandler.applyColHeaderBackgroundStyles(styleGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    applyRowHeaderTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        this.colorHandler.applyRowHeaderTailwindStyles(styleGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    applyColHeaderTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        this.colorHandler.applyColHeaderTailwindStyles(styleGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Reset header styles
    resetHeaderStyles(): void {
        this.colorHandler.applyDefaultStyles('row');
        this.colorHandler.applyDefaultStyles('col');
        this.colorHandler.applyDefaultStyles('corner');
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Reset all styles (cells and headers)
    resetAllStyles(): void {
        this.colorHandler.resetAllStyles();
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // ==================== HEADER + ROW/COLUMN STYLING API ====================

    private _applyHeaderAndCellsStyleArgs<T1, T2>(
        isRow: boolean,
        arg1: number | number[] | [number, T1, T2][],
        arg2: T1 | undefined,
        arg3: T2 | undefined,
        handlerMethod: (index: number, headerProps: T1, cellProps: T2) => void,
        methodName: string
    ): void {
        if (Array.isArray(arg1)) {
            if (arg1.length > 0 && Array.isArray(arg1[0])) {
                for (const [index, headerProps, cellProps] of arg1 as [number, T1, T2][]) {
                    handlerMethod(index, headerProps, cellProps);
                }
            } else if (arg2 !== undefined && arg3 !== undefined) {
                for (const index of arg1 as number[]) {
                    handlerMethod(index, arg2, arg3);
                }
            } else {
                console.warn(`[SmartSheetController] ${methodName} requires either an array of [index, headerProps, cellProps] tuples or an index, headerProps, and cellProps.`);
            }
        } else if (arg2 !== undefined && arg3 !== undefined) {
            handlerMethod(arg1 as number, arg2, arg3);
        } else {
            console.warn(`[SmartSheetController] ${methodName} requires either an array of [index, headerProps, cellProps] tuples or an index, headerProps, and cellProps.`);
        }
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Style row header and all cells in that row (supports single or batch via tuple arrays)
    styleRowHeaderAndCells(
        arg1: number | number[] | [number, BackgroundProperties, BackgroundProperties][],
        arg2?: BackgroundProperties,
        arg3?: BackgroundProperties
    ): void {
        this._applyHeaderAndCellsStyleArgs(true, arg1, arg2, arg3, this.colorHandler.styleRowHeaderAndCells.bind(this.colorHandler), 'styleRowHeaderAndCells');
    }

    // Style column header and all cells in that column (supports single or batch via tuple arrays)
    styleColHeaderAndCells(
        arg1: number | number[] | [number, BackgroundProperties, BackgroundProperties][],
        arg2?: BackgroundProperties,
        arg3?: BackgroundProperties
    ): void {
        this._applyHeaderAndCellsStyleArgs(false, arg1, arg2, arg3, this.colorHandler.styleColHeaderAndCells.bind(this.colorHandler), 'styleColHeaderAndCells');
    }

    // Style row header and all cells in that row with Tailwind classes (supports single or batch via tuple arrays)
    styleRowHeaderAndCellsTailwind(
        arg1: number | number[] | [number, TailwindProperties, TailwindProperties][],
        arg2?: TailwindProperties,
        arg3?: TailwindProperties
    ): void {
        this._applyHeaderAndCellsStyleArgs(true, arg1, arg2, arg3, this.colorHandler.styleRowHeaderAndCellsTailwind.bind(this.colorHandler), 'styleRowHeaderAndCellsTailwind');
    }

    // Style column header and all cells in that column with Tailwind classes (supports single or batch via tuple arrays)
    styleColHeaderAndCellsTailwind(
        arg1: number | number[] | [number, TailwindProperties, TailwindProperties][],
        arg2?: TailwindProperties,
        arg3?: TailwindProperties
    ): void {
        this._applyHeaderAndCellsStyleArgs(false, arg1, arg2, arg3, this.colorHandler.styleColHeaderAndCellsTailwind.bind(this.colorHandler), 'styleColHeaderAndCellsTailwind');
    }

    // Batch header + cells styles via generators
    applyRowHeaderAndCellsBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]
    ): void {
        this.colorHandler.applyRowHeaderAndCellsBackgroundStyles(styleGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    applyColHeaderAndCellsBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]
    ): void {
        this.colorHandler.applyColHeaderAndCellsBackgroundStyles(styleGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    applyRowHeaderAndCellsTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]
    ): void {
        this.colorHandler.applyRowHeaderAndCellsTailwindStyles(styleGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    applyColHeaderAndCellsTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]
    ): void {
        this.colorHandler.applyColHeaderAndCellsTailwindStyles(styleGenerator);
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // ==================== EXTRAPROPS UPDATE API ====================

    /**
     * Update all cell extraProps with new values
     * @param extraPropsMatrix 2D array matching grid dimensions
     */
    updateAllCellExtraProps(extraPropsMatrix: TExtraProps[][]): void {
        if (!extraPropsMatrix || extraPropsMatrix.length === 0) {
            console.warn('[SmartSheetController] updateAllCellExtraProps: extraPropsMatrix is empty or undefined');
            return;
        }

        // Validate dimensions
        const expectedRows = this.gridDimensions.maxRow + 1;
        const expectedCols = this.gridDimensions.maxCol + 1;

        if (extraPropsMatrix.length !== expectedRows) {
            console.warn(`[SmartSheetController] updateAllCellExtraProps: Expected ${expectedRows} rows, got ${extraPropsMatrix.length}`);
            return;
        }

        // Update all cell components with new extraProps
        for (let row = 0; row < expectedRows; row++) {
            if (!extraPropsMatrix[row] || extraPropsMatrix[row].length !== expectedCols) {
                console.warn(`[SmartSheetController] updateAllCellExtraProps: Row ${row} has incorrect length. Expected ${expectedCols}, got ${extraPropsMatrix[row]?.length}`);
                continue;
            }

            for (let col = 0; col < expectedCols; col++) {
                const key = this.positionToKey({ row, col });
                const cellComponent = this.cellComponents.get(key);

                if (cellComponent) {
                    cellComponent.extraProps = extraPropsMatrix[row][col] as TExtraProps;
                }
            }
        }

        // Invalidate analysis to force re-analysis with new extraProps
        this.invalidateExtraPropsAnalysis();

        // Update visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    /**
     * Update all row header extraProps with new values
     * @param extraPropsArray Array matching number of rows
     */
    updateAllRowHeaderExtraProps(extraPropsArray: TRowHeaderProps[]): void {
        if (!extraPropsArray || extraPropsArray.length === 0) {
            console.warn('[SmartSheetController] updateAllRowHeaderExtraProps: extraPropsArray is empty or undefined');
            return;
        }

        // Validate dimensions
        const expectedRows = this.gridDimensions.maxRow + 1;

        if (extraPropsArray.length !== expectedRows) {
            console.warn(`[SmartSheetController] updateAllRowHeaderExtraProps: Expected ${expectedRows} items, got ${extraPropsArray.length}`);
            return;
        }

        // Update all row header components with new extraProps
        for (let index = 0; index < expectedRows; index++) {
            const key = `row-${index}`;
            const headerComponent = this.rowHeaderComponents.get(key);

            if (headerComponent) {
                headerComponent.extraProps = extraPropsArray[index] as TRowHeaderProps;
            }
        }

        // Invalidate analysis to force re-analysis with new extraProps
        this.invalidateExtraPropsAnalysis();

        // Update visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    /**
     * Update all column header extraProps with new values
     * @param extraPropsArray Array matching number of columns
     */
    updateAllColHeaderExtraProps(extraPropsArray: TColHeaderProps[]): void {
        if (!extraPropsArray || extraPropsArray.length === 0) {
            console.warn('[SmartSheetController] updateAllColHeaderExtraProps: extraPropsArray is empty or undefined');
            return;
        }

        // Validate dimensions
        const expectedCols = this.gridDimensions.maxCol + 1;

        if (extraPropsArray.length !== expectedCols) {
            console.warn(`[SmartSheetController] updateAllColHeaderExtraProps: Expected ${expectedCols} items, got ${extraPropsArray.length}`);
            return;
        }

        // Update all column header components with new extraProps
        for (let index = 0; index < expectedCols; index++) {
            const key = `col-${index}`;
            const headerComponent = this.colHeaderComponents.get(key);

            if (headerComponent) {
                headerComponent.extraProps = extraPropsArray[index] as TColHeaderProps;
            }
        }

        // Invalidate analysis to force re-analysis with new extraProps
        this.invalidateExtraPropsAnalysis();

        // Update visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    /**
     * Analyze the structure of extraProps by examining the first non-null example
     * Since extraProps are homogeneous, all instances have the same properties
     */
    private analyzeExtraPropsStructure(): void {
        if (this.extraPropsSchema.analyzed) return;

        // Analyze cell extraProps from first available cell
        for (const [key, cell] of this.cellComponents) {
            if (cell.extraProps && typeof cell.extraProps === 'object') {
                Object.keys(cell.extraProps).forEach(prop =>
                    this.extraPropsSchema.cellProperties.add(prop as keyof TExtraProps)
                );
                break; // Solo necesitamos el primero ya que son homogéneos
            }
        }

        // Analyze row header extraProps from first available header
        for (const [key, header] of this.rowHeaderComponents) {
            if (header.extraProps && typeof header.extraProps === 'object') {
                Object.keys(header.extraProps).forEach(prop =>
                    this.extraPropsSchema.rowHeaderProperties.add(prop as keyof TRowHeaderProps)
                );
                break;
            }
        }

        // Analyze column header extraProps from first available header
        for (const [key, header] of this.colHeaderComponents) {
            if (header.extraProps && typeof header.extraProps === 'object') {
                Object.keys(header.extraProps).forEach(prop =>
                    this.extraPropsSchema.colHeaderProperties.add(prop as keyof TColHeaderProps)
                );
                break;
            }
        }

        this.extraPropsSchema.analyzed = true;
    }

    /**
     * Invalidate extraProps analysis to force re-analysis with new data
     */
    private invalidateExtraPropsAnalysis(): void {
        this.extraPropsSchema.analyzed = false;
        this.extraPropsSchema.cellProperties.clear();
        this.extraPropsSchema.rowHeaderProperties.clear();
        this.extraPropsSchema.colHeaderProperties.clear();
    }

    /**
     * Check if a specific property exists in extraProps schema
     * @param type Type of component to check ('cell', 'rowHeader', 'colHeader')
     * @param property Property name to check
     * @returns true if property exists in the schema
     */
    hasExtraProperty(type: 'cell' | 'rowHeader' | 'colHeader', property: string): boolean {
        this.analyzeExtraPropsStructure();

        switch(type) {
            case 'cell':
                return this.extraPropsSchema.cellProperties.has(property as keyof TExtraProps);
            case 'rowHeader':
                return this.extraPropsSchema.rowHeaderProperties.has(property as keyof TRowHeaderProps);
            case 'colHeader':
                return this.extraPropsSchema.colHeaderProperties.has(property as keyof TColHeaderProps);
            default:
                return false;
        }
    }

    /**
     * Get all known properties in extraProps schema for a component type
     * @param type Type of component ('cell', 'rowHeader', 'colHeader')
     * @returns Set of property names
     */
    getExtraPropertiesSchema(type: 'cell' | 'rowHeader' | 'colHeader'): Set<string> {
        this.analyzeExtraPropsStructure();

        switch(type) {
            case 'cell':
                return new Set(Array.from(this.extraPropsSchema.cellProperties).map(String));
            case 'rowHeader':
                return new Set(Array.from(this.extraPropsSchema.rowHeaderProperties).map(String));
            case 'colHeader':
                return new Set(Array.from(this.extraPropsSchema.colHeaderProperties).map(String));
            default:
                return new Set();
        }
    }

    // Cleanup method to be called when destroying the controller instance
    dispose(): void {
        // Ensure clipboard handlers are removed
        this.removeClipboardHandlers();
        // Deactivate navigation
        this.deactivateNavigation();
    }

}