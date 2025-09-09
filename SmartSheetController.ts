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
    // Separate header components by type for different extraProps handling
    // Style
    private styleMode: 'style' | 'tailwind'; // Default to inline styles

    constructor(initialDimensions: GridDimensions,
        gridData: CellValue[][],
        rowHeaders: HeaderValue[] | undefined,
        colHeaders: HeaderValue[] | undefined,
        rowsTitle: string | undefined,
        cellsExtraProps: TExtraProps[][] | undefined,
        rowHeaderProps: TRowHeaderProps[] | undefined,
        colHeaderProps: TColHeaderProps[] | undefined,
        styleMode: 'style' | 'tailwind',
        onSelectionsChanged?: SelectionChangedCallback,
        pointerPositionCallback?: PointerPositionCallback,
        onDeselectionsChanged?: SelectionChangedCallback,
        onVisibleComponentsChanged?: VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onRenderAreaChanged?: RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onEditingStateChanged?: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
    ) {
        this.gridDimensions = initialDimensions;
        this.styleMode = styleMode;

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
            onEditingStateChanged
        );
        this.colorHandler = new ColorHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>(
            this.gridDimensions,
            this.styleMode,
            this.cellComponents,
            this.rowHeaderComponents,
            this.colHeaderComponents,
            this.cornerHeaderComponent,
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

        // Setup clipboard event handlers
        this.setupClipboardHandlers();
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
        if (!rowHeaders) return headerMap;
        for (let index = 0; index < rowHeaders.length; index++) {
            const position: HeaderPosition = { headerType: 'row', index };
            const key = `row-${index}`;
            const headerComponent: HeaderComponent<TRowHeaderProps> = {
                position,
                value: rowHeaders[index] ?? (index + 1).toString(),
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
        if (!colHeaders) return headerMap;
        for (let index = 0; index < colHeaders.length; index++) {
            const position: HeaderPosition = { headerType: 'col', index };
            const key = `col-${index}`;
            const headerComponent: HeaderComponent<TColHeaderProps> = {
                position,
                value: colHeaders[index] ?? this.generateColumnLabel(index),
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
            } else if (analysis.componentType === 'header') {
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
        } else if (basicAnalysis.keyCategory === 'command') {
            const commandAnalysis = this.inputAnalyzer.analyzeCommand(basicAnalysis);
            if (commandAnalysis.command === 'undo') {
                const [affectedPositions, componentType] = this.dataHandler.undo();
                if (affectedPositions.length > 0) {
                    // Update the visible components
                    this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
                    const visibleComponents = this.virtualizeHandler.getVisibleComponents();
                    // Visually flash the affected cells (only rendered ones)
                    if (componentType === 'cell') {
                        this.colorHandler.flashCells(
                            affectedPositions as GridPosition[],
                            visibleComponents,
                            { color: 'red' }
                        );
                    } else {
                        this.colorHandler.flashHeaders(
                            affectedPositions as HeaderPosition[],
                            visibleComponents,
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
                    // Visually flash the affected cells (only rendered ones)
                    const visibleComponents = this.virtualizeHandler.getVisibleComponents();
                    if (componentType === 'cell') {
                        this.colorHandler.flashCells(
                            affectedPositions as GridPosition[],
                            visibleComponents,
                            { color: 'blue' }
                        );
                    } else {
                        this.colorHandler.flashHeaders(
                            affectedPositions as HeaderPosition[],
                            visibleComponents,
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

    handleInputBlur(position: GridPosition) {
        // Delegate to DataHandler to set cell not editing
        this.dataHandler.finishComponentEdit('blur');
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Activate navigation: select current cell only if no selection exists
    activateNavigation() {
        this.navigationHandler.activateNavigation();
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

    // ==================== END PUBLIC API FOR MOUSE EVENT TRANSLATION ====================

    // PUBLIC API for external selection control
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
    }

    // Batch tailwind styles via generator
    applyTailwindStyles(styleGenerator: (cells: Map<string, CellComponent>) => [GridPosition, TailwindProperties][]): void {
        this.colorHandler.applyTailwindStyles(styleGenerator as any);
    }

    // Reset all cell backgrounds to default
    resetAllBackgrounds(): void {
        this.colorHandler.applyDefaultStyles('cell');
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
        const visibleComponents = this.virtualizeHandler.getVisibleComponents();
        if (affectedPositions.length > 0) {
            this.colorHandler.flashCells(
                affectedPositions,
                visibleComponents,
                { color: 'green' }
            );
        }
        return affectedPositions;
    }

    applyImputations(
        imputationGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, CellValue][]
    ): GridPosition[] {
        const affectedPositions = this.dataHandler.applyImputations(imputationGenerator);
        const visibleComponents = this.virtualizeHandler.getVisibleComponents();
        if (affectedPositions.length > 0) {
            this.colorHandler.flashCells(
                affectedPositions,
                visibleComponents,
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

    // Header styling methods
    setHeaderBackgroundColor(type: 'row' | 'col' | 'corner', index: number, color: string): void {
        this.colorHandler.changeHeaderBackgroundColor(type, index, color);
    }

    setHeaderTextColor(type: 'row' | 'col' | 'corner', index: number, color: string): void {
        this.colorHandler.changeHeaderTextColor(type, index, color);
    }

    setHeaderStyle(type: 'row' | 'col' | 'corner', index: number, props: BackgroundProperties): void {
        this.colorHandler.setHeaderStyling(type, index, props);
    }

    setHeaderTailwindStyle(type: 'row' | 'col' | 'corner', index: number, props: TailwindProperties): void {
        this.colorHandler.setHeaderTailwindStyling(type, index, props);
    }

    // Batch header styles via generators
    applyRowHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        this.colorHandler.applyRowHeaderBackgroundStyles(styleGenerator);
    }

    applyColHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        this.colorHandler.applyColHeaderBackgroundStyles(styleGenerator);
    }

    applyRowHeaderTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        this.colorHandler.applyRowHeaderTailwindStyles(styleGenerator);
    }

    applyColHeaderTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        this.colorHandler.applyColHeaderTailwindStyles(styleGenerator);
    }

    // Reset header styles
    resetHeaderStyles(): void {
        this.colorHandler.applyDefaultStyles('row');
        this.colorHandler.applyDefaultStyles('col');
        this.colorHandler.applyDefaultStyles('corner');
    }

    // Reset all styles (cells and headers)
    resetAllStyles(): void {
        this.colorHandler.resetAllStyles();
    }

    // ==================== HEADER + ROW/COLUMN STYLING API ====================

    // Style row header and all cells in that row
    styleRowHeaderAndCells(row: number, headerProps: BackgroundProperties, cellProps: BackgroundProperties): void {
        this.colorHandler.styleRowHeaderAndCells(row, headerProps, cellProps);
    }

    // Style column header and all cells in that column
    styleColHeaderAndCells(col: number, headerProps: BackgroundProperties, cellProps: BackgroundProperties): void {
        this.colorHandler.styleColHeaderAndCells(col, headerProps, cellProps);
    }

    // Style row header and all cells in that row with Tailwind classes
    styleRowHeaderAndCellsTailwind(row: number, headerProps: TailwindProperties, cellProps: TailwindProperties): void {
        this.colorHandler.styleRowHeaderAndCellsTailwind(row, headerProps, cellProps);
    }

    // Style column header and all cells in that column with Tailwind classes
    styleColHeaderAndCellsTailwind(col: number, headerProps: TailwindProperties, cellProps: TailwindProperties): void {
        this.colorHandler.styleColHeaderAndCellsTailwind(col, headerProps, cellProps);
    }

    // Batch header + cells styles via generators
    applyRowHeaderAndCellsBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]
    ): void {
        this.colorHandler.applyRowHeaderAndCellsBackgroundStyles(styleGenerator);
    }

    applyColHeaderAndCellsBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]
    ): void {
        this.colorHandler.applyColHeaderAndCellsBackgroundStyles(styleGenerator);
    }

    applyRowHeaderAndCellsTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]
    ): void {
        this.colorHandler.applyRowHeaderAndCellsTailwindStyles(styleGenerator);
    }

    applyColHeaderAndCellsTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]
    ): void {
        this.colorHandler.applyColHeaderAndCellsTailwindStyles(styleGenerator);
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

}