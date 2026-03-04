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
    ProcessingState,
    NavigationAnchorsAndPointers,
    DraggingActionContext,
    NumberFormat,
} from '../types/types.ts';
import InputAnalyzer from '../input/InputAnalyzer.ts';
import MouseEventTranslator from '../translation/MouseEventTranslator.ts';
import NavigationHandler from '../navigation/NavigationHandler.ts';
import SelectionHandler from '../selection/SelectionHandler.ts';
import DataHandler from '../data/DataHandler.ts';
import type { SelectionChangedCallback } from '../selection/SelectionHandler.ts';
import type { PointerPositionCallback, AutoScrollSelectionCallback } from '../navigation/NavigationHandler.ts';
import type { EditingStateCallback, ImputedElementsCallback } from '../data/DataHandler.ts';
import type { InputActivationPort } from '../ports/InputActivationPort.ts';
import type { ExternalEventPort } from '../ports/ExternalEventPort.ts';
import type { ViewportPort } from '../ports/ViewportPort.ts';
import type { FlashEffectPort } from '../ports/FlashEffectPort.ts';
import ColorHandler from '../styling/ColorHandler.ts';
import VirtualizeHandler from '../virtualization/VirtualizeHandler.ts';
import type { VisibleComponentsCallback, RenderAreaCallback, ScaleChangeCallback } from '../virtualization/VirtualizeHandler.ts';


// Callback type for processing state changes (using any to avoid circular dependency)
export type ProcessingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    (handler: SmartSheetController<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

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
    private viewportPort?: ViewportPort;
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
    // Processing state for operations feedback
    private processingState: ProcessingState = {
        isProcessing: false,
        message: '',
        operation: undefined,
        source: undefined
    };
    // Callback for processing state changes
    private onProcessingStateChanged?: ProcessingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;

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
        numberFormat: NumberFormat,
        onSelectionsChanged?: SelectionChangedCallback,
        pointerPositionCallback?: PointerPositionCallback,
        onDeselectionsChanged?: SelectionChangedCallback,
        onVisibleComponentsChanged?: VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onScaleChanged?: ScaleChangeCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onRenderAreaChanged?: RenderAreaCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onEditingStateChanged?: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onProcessingStateChanged?: ProcessingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        onImputedElementsChanged?: ImputedElementsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
    ) {
        this.gridDimensions = initialDimensions;
        this.styleMode = styleMode;
        this.headersReadOnly = headersReadOnly;
        this.onProcessingStateChanged = onProcessingStateChanged;

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
            this.gridDimensions,
            this.cellComponents,
            this.rowHeaderComponents,
            this.colHeaderComponents,
            this.cornerHeaderComponent,
            onSelectionsChanged,
            onDeselectionsChanged,
            this.handleEndOfDeselection,
            this.handleHeaderReflectionChanges,
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
            numberFormat,
            onEditingStateChanged,
            onImputedElementsChanged,
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
            onScaleChanged,
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
            this.viewportPort?.getTableContainerRect() ?? null,
            draggingContext,
        );

        // Process the navigation action through the normal flow
        this.navigationHandler.processMouseNavigation(analysis);
    }

    /**
     * Handle auto-scroll selection updates during outside dragging
     * This will be called by NavigationHandler when auto-scroll moves the pointer
     */
    private handleAutoScrollSelection = (position: GridPosition, draggingContext: DraggingActionContext): void => {
        if (!this.navigationHandler.isDragging()) {
            return;
        }

        const anchor = this.navigationHandler.getAnchor();

        // Create synthetic analysis for continue-drag with update-selection
        const analysis = this.inputAnalyzer.createContinueDragAnalysis(position, anchor, draggingContext);

        let navigationAnchorsAndPointers = this.navigationHandler.getNavigationAnchorsAndPointers();

        // Process selection update
        this.selectionHandler.processMouseSelection(analysis, navigationAnchorsAndPointers);
    }

    /**
     * Callback to handle end of deselection and synchronize respective pointers and anchors with the resulting active selection
     */
    private handleEndOfDeselection = (resultingActiveSelection: 'cell' | 'header-row' | 'header-col' | null,
            anchor: GridPosition | number, pointer: GridPosition | number): void => {
        const visibleArea = this.virtualizeHandler.getVisibleArea();
        this.navigationHandler.synchronizeSelectionPointerAndAnchor(resultingActiveSelection, anchor, pointer, visibleArea);
    }

    /**
     * Header reflection callback - handles adding/removing borders to headers
     * based on cell selection changes (Excel-like behavior)
     */
    private handleHeaderReflectionChanges = (
        toAddRowReflections: Set<number>,
        toRemoveRowReflections: Set<number>,
        toAddColReflections: Set<number>,
        toRemoveColReflections: Set<number>
    ): void => {
        // Define reflection colors and styles
        const reflectionColor = 'rgba(59, 130, 246, 1.0)'; // Blue color for reflections
        const reflectionWidth = '4px';

        // Row headers: Remove right borders from headers no longer affected (restore defaults)
        toRemoveRowReflections.forEach(rowIndex => {
            if (this.styleMode === 'style') {
                this.colorHandler.setHeaderStyling('row', rowIndex, {
                    'border-right-color': this.colorHandler.defaultHeaderBackgroundProperties['border-right-color'],
                    'border-right-width': this.colorHandler.defaultHeaderBackgroundProperties['border-right-width'],
                    'border-right-style': this.colorHandler.defaultHeaderBackgroundProperties['border-right-style']
                });
            } else {
                this.colorHandler.setHeaderTailwindStyling('row', rowIndex, {
                    'border-right-color': this.colorHandler.defaultHeaderTailwindProperties['border-right-color'],
                    'border-right-width': this.colorHandler.defaultHeaderTailwindProperties['border-right-width'],
                    'border-right-style': this.colorHandler.defaultHeaderTailwindProperties['border-right-style']
                });
            }
        });

        // Column headers: Remove bottom borders from headers no longer affected (restore defaults)
        toRemoveColReflections.forEach(colIndex => {
            if (this.styleMode === 'style') {
                this.colorHandler.setHeaderStyling('col', colIndex, {
                    'border-bottom-color': this.colorHandler.defaultHeaderBackgroundProperties['border-bottom-color'],
                    'border-bottom-width': this.colorHandler.defaultHeaderBackgroundProperties['border-bottom-width'],
                    'border-bottom-style': this.colorHandler.defaultHeaderBackgroundProperties['border-bottom-style']
                });
            } else {
                this.colorHandler.setHeaderTailwindStyling('col', colIndex, {
                    'border-bottom-color': this.colorHandler.defaultHeaderTailwindProperties['border-bottom-color'],
                    'border-bottom-width': this.colorHandler.defaultHeaderTailwindProperties['border-bottom-width'],
                    'border-bottom-style': this.colorHandler.defaultHeaderTailwindProperties['border-bottom-style']
                });
            }
        });

        // Row headers: Add right borders to newly affected headers
        toAddRowReflections.forEach(rowIndex => {
            if (this.styleMode === 'style') {
                this.colorHandler.setHeaderStyling('row', rowIndex, {
                    'border-right-color': reflectionColor,
                    'border-right-width': reflectionWidth,
                    'border-right-style': 'solid'
                });
            } else {
                this.colorHandler.setHeaderTailwindStyling('row', rowIndex, {
                    'border-right-color': 'blue-500',
                    'border-right-width': '3',
                    'border-right-style': 'solid'
                });
            }
        });

        // Column headers: Add bottom borders to newly affected headers
        toAddColReflections.forEach(colIndex => {
            if (this.styleMode === 'style') {
                this.colorHandler.setHeaderStyling('col', colIndex, {
                    'border-bottom-color': reflectionColor,
                    'border-bottom-width': reflectionWidth,
                    'border-bottom-style': 'solid'
                });
            } else {
                this.colorHandler.setHeaderTailwindStyling('col', colIndex, {
                    'border-bottom-color': 'blue-500',
                    'border-bottom-width': '3',
                    'border-bottom-style': 'solid'
                });
            }
        });

        // Invalidate virtualization to re-render affected headers
        if (toAddRowReflections.size > 0 || toRemoveRowReflections.size > 0 ||
            toAddColReflections.size > 0 || toRemoveColReflections.size > 0) {
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
        }
    };

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

    setUpNavigator(rowHeights: number[], colWidths: number[]) {
        this.navigationHandler.setRowHeights(rowHeights);
        this.navigationHandler.setColWidths(colWidths);
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

        // No need to translate mousedown in corner header (always the same position)
        // No need for start drag, just create a selection of all cells
        if (containerType === 'corner' && eventType === 'mousedown') {
            this.handleCornerHeaderClick(event);
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
     * Handle click in corner header (select all)
     */
    handleCornerHeaderClick(event: MouseEvent) {
        // Only left click
        if (event.button !== 0) {
            return;
        }
        this.navigationHandler.setAnchor({ row: this.gridDimensions.maxRow, col: this.gridDimensions.maxCol });
        this.navigationHandler.movePointer({ row: 0, col: 0 });
        this.selectionHandler.clearSelections();
        this.selectionHandler.addMultipleCellRanges([{ topLeft: { row: 0, col: 0 },
            bottomRight: { row: this.gridDimensions.maxRow, col: this.gridDimensions.maxCol } }]);
        return;
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

        // If mouseenter type and no navigation and no selection action, update mousePosition and return
        if (event.detail.type === 'mouseenter' && analysis.navigationAction === 'none' && analysis.selectionAction === 'none') {
            this.navigationHandler.setMousePosition(event.detail.position);
            return;
        }

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

        // Visible area
        const visibleArea = this.virtualizeHandler.getVisibleArea();

        // Process navigation actions
        this.navigationHandler.processMouseNavigation(analysis, visibleArea);

        // Get navigation anchors and pointers after navigation
        const navigationAnchorsAndPointers = this.navigationHandler.getNavigationAnchorsAndPointers();

        // Process selection actions with anchors and pointers
        this.selectionHandler.processMouseSelection(analysis, navigationAnchorsAndPointers);
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
        if (basicAnalysis.keyCategory === 'navigation') {
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
        } else if (basicAnalysis.keyCategory === 'write' || basicAnalysis.keyCategory === 'backspace'
            || basicAnalysis.keyCategory === 'space'
        ) {
            // Handle writing input (e.g. typing in a cell)
            this.dataHandler.startEditingComponent(currentPosition, 'cell', basicAnalysis.key);
            this.selectionHandler.clearSelections();
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
    }

    handleInputCancel(event: KeyboardEvent) {
        this.dataHandler.finishComponentEdit('cancel');
        // Re-select the current position after cancel
        this.selectionHandler.selectSingle(this.navigationHandler.getCurrentPosition());
        // Update the visible components
        this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
    }

    // Handle navigation keys with specialized analysis
    private handleNavigationKey(basicAnalysis: RawKeyboardAnalysis) {
        // PHASE 2: Specialized navigation analysis
        const activeSelection = this.selectionHandler.getActiveSelectionType();
        //const navAnalysis = this.inputAnalyzer.analyzeNavigation(basicAnalysis);
        const navAnalysis = this.inputAnalyzer.analyzeKeyboardNavigation(basicAnalysis, activeSelection);

        // Delegate to NavigationHandler with complete analysis
        const visibleArea = this.virtualizeHandler.getVisibleArea();
        this.navigationHandler.processKeyboardNavigation(navAnalysis, visibleArea);

        // Now we get the navigation anchors and pointers after navigation
        const navigationAnchorsAndPointers = this.navigationHandler.getNavigationAnchorsAndPointers();

        // Delegate selection logic to SelectionHandler with complete context
        this.selectionHandler.processKeyboardSelection(navAnalysis, navigationAnchorsAndPointers);
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
        // currently disabled, might be eliminated or enabled later
        const currentSelection = this.selectionHandler.getSelectedCells();
        if (currentSelection.size === 0) {
            const currentPosition = this.navigationHandler.getCurrentPosition();
            //this.selectionHandler.selectSingle(currentPosition);
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

    // Wire the adapter's FlashEffectPort so ColorHandler can trigger DOM flash animations
    setFlashEffectPort(port: FlashEffectPort): void {
        this.colorHandler.setFlashEffectPort(port);
    }

    // Wire the adapter's InputActivationPort so DataHandler can delegate DOM interaction
    setInputActivationPort(port: InputActivationPort): void {
        this.dataHandler.setInputActivationPort(port);
    }

    // Wire the adapter's ExternalEventPort so NavigationHandler can register outside-drag listeners
    setExternalEventPort(port: ExternalEventPort): void {
        this.navigationHandler.setExternalEventPort(port);
    }

    // Wire the adapter's ViewportPort so NavigationHandler, VirtualizeHandler and MouseEventTranslator can query and command the viewport
    setViewportPort(port: ViewportPort): void {
        this.viewportPort = port;
        this.navigationHandler.setViewportPort(port);
        this.virtualizeHandler.setViewportPort(port);
        this.mouseEventTranslator.setViewportPort(port);
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
    initializeVirtualization(
        rowHeights: number[],
        colWidths: number[]
    ): void {
        this.virtualizeHandler.initialize(rowHeights, colWidths);
    }

    // Handle scroll events for virtualization
    handleVirtualizationScroll(): void {
        this.virtualizeHandler.handleScroll();
    }

    // Handle scale change events for visualization scaling
    handleScaleChange(wheelDeltaY: number): void {
        this.virtualizeHandler.scaleVisualization(wheelDeltaY);
    }

    // Get current render area
    getRenderArea() {
        return this.virtualizeHandler.getRenderArea();
    }

    // Get visible components for current render area
    getVisibleComponents() {
        return this.virtualizeHandler.getVisibleComponents();
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

    // ===================== HEADER SUBSET CALCULATIONS =====================

    /**
     * This section defines the logic for calculating subsets of cells based on header selections.
     * This is the base for NARROWING concept in study, the aim is to operate certains APIs in a
     * subset of cells defined by header selections.
     */

    /**
     * Calculate subset of cells based on current header selections
     * - If only row selections exist: use cells derived from row headers
     * - If only column selections exist: use cells derived from column headers
     * - If both exist: calculate intersection of row and column selections
     * - If neither exist: return empty set
     */
    private calculateHeaderSubsetCells(): {
        subsetCells: Set<string>,
        hasRowSelections: boolean,
        hasColSelections: boolean
    } {
        const rowSelections = this.selectionHandler.getHeaderSelectionsRows();
        const colSelections = this.selectionHandler.getHeaderSelectionsCols();

        const hasRowSelections = rowSelections.length > 0;
        const hasColSelections = colSelections.length > 0;

        let subsetCells: Set<string>;

        if (hasRowSelections && hasColSelections) {
            // INTERSECTION: cells that exist in BOTH row and column selections
            subsetCells = this.selectionHandler.calculateRowColIntersection(rowSelections, colSelections);
        } else if (hasRowSelections) {
            // Only rows: use cells derived from row header selections
            subsetCells = new Set<string>();
            rowSelections.forEach(headerSelection => {
                headerSelection.getCells().forEach(cell => subsetCells.add(cell));
            });
        } else if (hasColSelections) {
            // Only columns: use cells derived from column header selections
            subsetCells = new Set<string>();
            colSelections.forEach(headerSelection => {
                headerSelection.getCells().forEach(cell => subsetCells.add(cell));
            });
        } else {
            // No header selections: empty set
            subsetCells = new Set<string>();
        }

        return { subsetCells, hasRowSelections, hasColSelections };
    }

    /** =============================================================================================
    /*  ===================== PUBLIC API - Methods exposed for external control =====================
    /*  =============================================================================================
    */

    // ===================== SELECTION APIs =====================
    selectPositions(positions: GridPosition[]): void {
        // Clear existing selections first
        this.selectionHandler.clearSelections();
        // Add individual selections for each position
        this.selectionHandler.addMultipleSelections(positions);
    }

    selectHeaders(headerType: 'row' | 'col', indices: number[]): void {
        // Clear existing selections first
        this.selectionHandler.clearSelections();
        // Add individual selections for each header index
        this.selectionHandler.addMultipleHeaderSelections(headerType, indices);
    }

    // Selection API that takes a function aware of cell structure
    applySelections(
        selectionGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[]
    ): void {
        this.selectionHandler.clearSelections();
        const positions = selectionGenerator(this.cellComponents);
        //this.selectPositions(positions);
        // New intelligent selection application
        this.selectionHandler.addIntelligentSelections(positions);
    }

    applyHeaderSelections(
        headerType: 'row' | 'col',
        selectionGenerator: (
            headers: Map<string, TRowHeaderProps | TColHeaderProps>
        ) => number[]
    ): void {
        this.selectionHandler.clearSelections();
        let indices: number[] = [];
        if (headerType === 'row') {
            indices = selectionGenerator(this.rowHeaderComponents as Map<string, TRowHeaderProps>);
        } else {
            indices = selectionGenerator(this.colHeaderComponents as Map<string, TColHeaderProps>);
        }
        //this.selectionHandler.addMultipleHeaderSelections(headerType, indices);
        // New intelligent header selection application
        this.selectionHandler.addIntelligentHeaderSelections(headerType, indices);
    }

    // ===================== NAVIGATION APIs =====================

    navigateToPosition(position: GridPosition): boolean {
        const result = this.navigationHandler.movePointer(position, 'instant', 'initial');
        return result !== null;
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
        }
        return success;
    }

    /**
     * Apply selections to a subset of cells based on current header selections
     * This is a "narrowing" version of applySelections that only operates on cells 
     * that are part of the current header selections.
     *
     * Logic:
     * - If only row selections exist: operates on cells derived from row headers
     * - If only column selections exist: operates on cells derived from column headers
     * - If both exist: operates on intersection of row and column selections
     * - If neither exist: returns without applying any selections
     *
     * @param selectionGenerator Function that receives filtered cell map and returns positions to select
     */
    applySelectionsToHeaderSubset(
        selectionGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[]
    ): void {
        // 1. Calculate subset of cells based on current header selections
        const { subsetCells, hasRowSelections, hasColSelections } = this.calculateHeaderSubsetCells();

        // 2. If no header selections exist, return without doing anything
        if (subsetCells.size === 0) {
            return;
        }

        // 3. Create filtered map with only cells from the subset
        const subsetCellComponents = new Map<string, CellComponent<TExtraProps>>();
        subsetCells.forEach(cellKey => {
            const cellComponent = this.cellComponents.get(cellKey);
            if (cellComponent) {
                subsetCellComponents.set(cellKey, cellComponent);
            }
        });

        // 4. Apply selection generator function to the filtered subset
        const positions = selectionGenerator(subsetCellComponents);

        // 5. Apply intelligent selections to the generated positions, clearing existing selections first
        this.selectionHandler.clearSelections();
        this.selectionHandler.addIntelligentSelections(positions);
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
    applyBackgroundStyles(styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, BackgroundProperties][]): void {
        this.setProcessing('Applying background styles...', 'background-styles');

        try {
            this.colorHandler.applyBackgroundStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    // Batch tailwind styles via generator
    applyTailwindStyles(styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, TailwindProperties][]): void {
        this.setProcessing('Applying tailwind styles...', 'tailwind-styles');

        try {
            this.colorHandler.applyTailwindStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    // Reset all cell backgrounds to default
    resetAllBackgrounds(): void {
        this.setProcessing('Resetting all backgrounds...', 'reset-backgrounds');

        try {
            this.colorHandler.applyDefaultStyles('cell');
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
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
        this.setProcessing('Applying row header styles...', 'row-header-styles');

        try {
            this.colorHandler.applyRowHeaderBackgroundStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    applyColHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        this.setProcessing('Applying column header styles...', 'col-header-styles');

        try {
            this.colorHandler.applyColHeaderBackgroundStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    applyRowHeaderTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        this.setProcessing('Applying row header tailwind styles...', 'row-header-tailwind-styles');

        try {
            this.colorHandler.applyRowHeaderTailwindStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    applyColHeaderTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        this.setProcessing('Applying column header tailwind styles...', 'col-header-tailwind-styles');

        try {
            this.colorHandler.applyColHeaderTailwindStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    // Reset header styles
    resetHeaderStyles(): void {
        this.setProcessing('Resetting header styles...', 'reset-header-styles');

        try {
            this.colorHandler.applyDefaultStyles('row');
            this.colorHandler.applyDefaultStyles('col');
            this.colorHandler.applyDefaultStyles('corner');
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    // Reset all styles (cells and headers)
    resetAllStyles(): void {
        this.setProcessing('Resetting all styles...', 'reset-all-styles');

        try {
            this.colorHandler.resetAllStyles();
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
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
        this.setProcessing('Applying row header and cells styles...', 'row-header-cells-styles');

        try {
            this.colorHandler.applyRowHeaderAndCellsBackgroundStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    applyColHeaderAndCellsBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]
    ): void {
        this.setProcessing('Applying column header and cells styles...', 'col-header-cells-styles');

        try {
            this.colorHandler.applyColHeaderAndCellsBackgroundStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    applyRowHeaderAndCellsTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]
    ): void {
        this.setProcessing('Applying row header and cells tailwind styles...', 'row-header-cells-tailwind-styles');

        try {
            this.colorHandler.applyRowHeaderAndCellsTailwindStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    applyColHeaderAndCellsTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]
    ): void {
        this.setProcessing('Applying column header and cells tailwind styles...', 'col-header-cells-tailwind-styles');

        try {
            this.colorHandler.applyColHeaderAndCellsTailwindStyles(styleGenerator);
            // Update the visible components
            this.virtualizeHandler.onVisibleComponentsChanged?.(this.virtualizeHandler);
            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    // ==================== EXTRAPROPS UPDATE API ====================

    /**
     * Update all cell extraProps with new values
     * @param extraPropsMatrix 2D array matching grid dimensions
     */
    updateAllCellExtraProps(extraPropsMatrix: TExtraProps[][]): void {
        this.setProcessing('Updating cell properties...', 'cell-extraprops');

        try {
            if (!extraPropsMatrix || extraPropsMatrix.length === 0) {
                console.warn('[SmartSheetController] updateAllCellExtraProps: extraPropsMatrix is empty or undefined');
                this.clearProcessing();
                return;
            }

            // Validate dimensions
            const expectedRows = this.gridDimensions.maxRow + 1;
            const expectedCols = this.gridDimensions.maxCol + 1;

            if (extraPropsMatrix.length !== expectedRows) {
                console.warn(`[SmartSheetController] updateAllCellExtraProps: Expected ${expectedRows} rows, got ${extraPropsMatrix.length}`);
                this.clearProcessing();
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

            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    /**
     * Update all row header extraProps with new values
     * @param extraPropsArray Array matching number of rows
     */
    updateAllRowHeaderExtraProps(extraPropsArray: TRowHeaderProps[]): void {
        this.setProcessing('Updating row header properties...', 'row-header-extraprops');

        try {
            if (!extraPropsArray || extraPropsArray.length === 0) {
                console.warn('[SmartSheetController] updateAllRowHeaderExtraProps: extraPropsArray is empty or undefined');
                this.clearProcessing();
                return;
            }

            // Validate dimensions
            const expectedRows = this.gridDimensions.maxRow + 1;

            if (extraPropsArray.length !== expectedRows) {
                console.warn(`[SmartSheetController] updateAllRowHeaderExtraProps: Expected ${expectedRows} items, got ${extraPropsArray.length}`);
                this.clearProcessing();
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

            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
    }

    /**
     * Update all column header extraProps with new values
     * @param extraPropsArray Array matching number of columns
     */
    updateAllColHeaderExtraProps(extraPropsArray: TColHeaderProps[]): void {
        this.setProcessing('Updating column header properties...', 'col-header-extraprops');

        try {
            if (!extraPropsArray || extraPropsArray.length === 0) {
                console.warn('[SmartSheetController] updateAllColHeaderExtraProps: extraPropsArray is empty or undefined');
                this.clearProcessing();
                return;
            }

            // Validate dimensions
            const expectedCols = this.gridDimensions.maxCol + 1;

            if (extraPropsArray.length !== expectedCols) {
                console.warn(`[SmartSheetController] updateAllColHeaderExtraProps: Expected ${expectedCols} items, got ${extraPropsArray.length}`);
                this.clearProcessing();
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

            this.clearProcessing();
        } catch (error) {
            this.clearProcessing();
            throw error;
        }
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

    // ==================== UPDATE STATE MANAGEMENT ====================

    /**
     * Set processing state with a message and optional operation type
     * @param message - Message to display during processing
     * @param operation - Optional operation identifier
     * @param source - Source of the processing state ('internal' by default)
     */
    private setProcessing(message: string, operation?: string, source: 'internal' | 'external' = 'internal'): void {
        this.processingState = { isProcessing: true, message, operation, source };
        this.onProcessingStateChanged?.(this);
    }

    /**
     * Clear processing state
     */
    private clearProcessing(): void {
        this.processingState = { isProcessing: false, message: '', operation: undefined, source: undefined };
        this.onProcessingStateChanged?.(this);
    }

    /**
     * Get current processing state (public getter)
     * @returns Copy of current processing state
     */
    public getProcessingState(): ProcessingState {
        return { ...this.processingState };
    }

    // ==================== EXTERNAL PROCESSING CONTROL ====================

    /**
     * This section is in evaluation of replacing for the use of a Processing Handler
     * together with some sort of decorator or context manager
     */

    /**
     * Set external processing state (for parent component operations like fetches)
     * @param message - Message to display during processing
     * @param operation - Optional operation identifier
     */
    public setExternalProcessing(message: string, operation?: string): void {
        this.setProcessing(message, operation, 'external');
    }

    /**
     * Clear external processing state (we expose this one, just for symmetry)
     */
    public clearExternalProcessing(): void {
        this.clearProcessing();
    }

    // ==================== EXPORT DATA API ====================

    /**
     * This section defines methods that export data required from the parent component
     */

    /**
     * Export selected cells
     */

    public exportSelectedCells(): { [primaryHeader: string]: HeaderValue[] } {
        const selectedPositions = this.selectionHandler.getSelectedPositions();
        return this.dataHandler.translatePositionsToListedHeaders(selectedPositions);
    }

    /**
     * Export changed cells
     */
    public exportChangedCells(): { [primaryHeader: string]: HeaderValue[] } {
        const changedPositions = this.dataHandler.extractChangedCells();
        return this.dataHandler.translatePositionsToListedHeaders(changedPositions);
    }

    public exportSelectedRows(): string[] {
        const selectedRowIndices = this.selectionHandler.getSelectedRowHeaders();
        return this.dataHandler.translateIndicesToHeaderValues(selectedRowIndices, 'row');
    }

    public exportSelectedCols(): string[] {
        const selectedColIndices = this.selectionHandler.getSelectedColHeaders();
        return this.dataHandler.translateIndicesToHeaderValues(selectedColIndices, 'col');
    }

    /**
     * Export the changed cells with new values
     */
    public exportChangedCellsWithValues(): { [primaryHeader: string]: { [secondaryHeader: string]: CellValue } } {
        const changedPositions = this.dataHandler.extractChangedCells();
        return this.dataHandler.translatePositionsToData(changedPositions);
    }

    // ==================== CLEANUP ====================

    /**
     * Cleanup resources and event listeners
     */
    dispose(): void {
        // Ensure clipboard handlers are removed
        this.removeClipboardHandlers();
        // Deactivate navigation
        this.deactivateNavigation();
    }

}