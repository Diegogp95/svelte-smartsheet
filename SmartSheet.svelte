<script lang="ts" generics="TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined">
    import Cell from './Cell.svelte';
    import InputCell from './InputCell.svelte';
    import InputHeader from './InputHeader.svelte';
    import CellPointer from './CellPointer.svelte';
    import Header from './Header.svelte';
    import NavigationOverlay from './NavigationOverlay.svelte';
    import ProcessingOverlay from './ProcessingOverlay.svelte';
    import SmartSheetController from './SmartSheetController';
    import { Selection, HeaderSelection } from './SelectionHandler';
    import type { SelectionChangedCallback } from './SelectionHandler';
    import type { PointerPositionCallback } from './NavigationHandler';
    import type { VisibleComponentsCallback } from './VirtualizeHandler';
    import type { EditingStateCallback } from './DataHandler';
    import type { ProcessingStateCallback } from './SmartSheetController';
    import type {
        GridDimensions,
        GridPosition,
        CellMouseEvent,
        CellValue,
        CellComponent,
        HeaderComponent,
        HeaderMouseEvent,
        HeaderPosition,
        HeaderValue,
        VisibleComponents,
        FlashOptions,
        BackgroundProperties,
        TailwindProperties,
        EditingState,
        ProcessingState,
        NumberFormatOptions,
    } from './types';
    import SelectionRect from './SelectionRect.svelte';
    import DeselectionRect from './DeselectionRect.svelte';
    import { tick } from 'svelte';
    import DimensionScanner from './DimensionScanner.svelte';
    import HeaderSelectionRect from './HeaderSelectionRect.svelte';
    import HeaderDeselectionRect from './HeaderDeselectionRect.svelte';

    // Data
    export let gridData: (CellValue | undefined)[][];
    export let extraPropsMatrix: TExtraProps[][] | undefined = undefined;
    export let rowHeaderExtraProps: TRowHeaderProps[] | undefined = undefined;
    export let colHeaderExtraProps: TColHeaderProps[] | undefined = undefined;

    // Header configuration
    export let columnHeaders: HeaderValue[] | undefined = undefined;
    export let rowHeaders: HeaderValue[] | undefined = undefined;
    export let rowsTitle: string = ''; // Title for the row headers column
    export let headersReadOnly: boolean = true;

    // Configuration
    export let fontSize: string = '1rem'; // Default font size for cells and headers
    export let minCellWidth: string = '6rem'; // Minimum cell width (px or rem)
    export let minCellHeight: string = '3rem'; // Minimum cell height (px or rem)
    export let styleMode: 'style' | 'tailwind' = 'style'; // Choose between inline styles or Tailwind CSS classes
    export let numberFormat: NumberFormatOptions = { decimalPlaces: 3 }; // Number formatting configuration

    // Scan phase
    let gridDimensions: GridDimensions = { maxRow: gridData.length - 1, maxCol: (gridData[0]?.length || 1) - 1 };
    let scanning: boolean = true;
    let rowHeights: number[] = [];
    let colWidths: number[] = [];

    // Selections array to render, will be subscribed to controller's selections by a callback
    let selections: Selection[] = [];
    let headerSelectionsRows: HeaderSelection[] = [];
    let headerSelectionsCols: HeaderSelection[] = [];
    let derivedCellSelections: Selection[] = []; // Cell selections derived from header selections
    // Callback to get selections from controller
    const subscribeToSelections: SelectionChangedCallback = (handler) => {
        selections = handler.getSelections();
        headerSelectionsRows = handler.getHeaderSelectionsRows();
        headerSelectionsCols = handler.getHeaderSelectionsCols();
        derivedCellSelections = handler.getDerivedCellSelections();
    };
    // Pointer position variable to be subscribed to controller updates
    let pointerPosition: GridPosition = { row: 0, col: 0 };
    // Callback to update pointer position from controller
    const subscribeToPointerPosition: PointerPositionCallback = (handler) => {
        pointerPosition = handler.getCurrentPosition();
    };

    let deSelection: Selection | null = null;
    let headerDeselectionRow: HeaderSelection | null = null;
    let headerDeselectionCol: HeaderSelection | null = null;
    // Callback to get deselection area from controller
    const subscribeToDeselection: SelectionChangedCallback = (handler) => {
        const headerDeselection = handler.getHeaderDeselection();
        if (headerDeselection) {
            if (headerDeselection.getDirection() === 'row') {
                headerDeselectionRow = headerDeselection;
                headerDeselectionCol = null;
                // Asign the inter selection to the cell deselection
                deSelection = headerDeselection.getCellSelection();
            } else if (headerDeselection.getDirection() === 'col') {
                headerDeselectionCol = headerDeselection;
                headerDeselectionRow = null;
                // Asign the inter selection to the cell deselection
                deSelection = headerDeselection.getCellSelection();
            }
        } else {
            headerDeselectionRow = null;
            headerDeselectionCol = null;
            deSelection = handler.getDeselection();
        }
    };

    // EDITING STATE: Centralized editing state managed by DataHandler
    let currentEditingState: EditingState<TExtraProps, TRowHeaderProps, TColHeaderProps> | null = null;
    // Callback to get editing state from DataHandler
    const subscribeToEditingState: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> = (handler) => {
        currentEditingState = handler.getCurrentEditingState() || null;
    };

    // PROCESSING STATE: Centralized processing state managed by SmartSheetController
    let currentProcessingState: ProcessingState = { isProcessing: false, message: '', operation: undefined };
    // Callback to get processing state from SmartSheetController
    const subscribeToProcessingState: ProcessingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> = (handler) => {
        currentProcessingState = handler.getProcessingState();
    };

    // VIRTUALIZATION: Visible components and render area state managed by VirtualizeHandler
    let visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps> = {
        cells: [],
        rowHeaders: [],
        colHeaders: [],
        cornerHeader: undefined
    };

    // Callback to get visible components from VirtualizeHandler
    const subscribeToVisibleComponents: VisibleComponentsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> = (handler) => {
        visibleComponents = handler.getVisibleComponents();
    };

    // Create controller with grid dimensions
    let controller = new SmartSheetController<TExtraProps, TRowHeaderProps, TColHeaderProps>(
        {
            maxRow: gridData.length - 1,
            maxCol: (gridData[0]?.length || 1) - 1
        }, gridData as CellValue[][], rowHeaders, columnHeaders, rowsTitle,
        extraPropsMatrix, rowHeaderExtraProps, colHeaderExtraProps, styleMode, headersReadOnly,
        subscribeToSelections, subscribeToPointerPosition, subscribeToDeselection,
        subscribeToVisibleComponents, undefined, subscribeToEditingState, subscribeToProcessingState,
    );

    let tableContainer: HTMLDivElement;
    let columnsHeaderContainer: HTMLDivElement;
    let rowsHeaderContainer: HTMLDivElement;
    let mainGridContainer: HTMLDivElement;
    let Element: HTMLDivElement;

    // Reactive states managed by controller
    let navigationMode = false;

    // Unified mouse event handler
    function handleMouseEvent(event: CustomEvent<CellMouseEvent | HeaderMouseEvent>) {
        if (!navigationMode) {
            handleNavigationActivate();
        }
        controller.handleMouseEvent(event);
    }

    // Cell input blur handler
    function handleInputBlur(event: CustomEvent<{ event: FocusEvent, position: GridPosition }>) {
        // Notify controller about input blur
        controller.handleInputBlur();
        // Blur in a cell must trigger blur in the table container
        if (tableContainer) {
            handleFocusOut(event.detail.event);
        }
    }

    // Activate navigation mode
    function handleNavigationActivate() {
        navigationMode = controller.activateNavigation();
    }

    function handleFocusOut(event: FocusEvent) {
      const related = event.relatedTarget as HTMLElement | null;
        // If focus moved outside the table container, deactivate navigation mode
        // This keeps the navigation mode active if the focus moves within the table (e.g., to a cell input)
        if (!related || !tableContainer.contains(related)) {
            navigationMode = controller.deactivateNavigation();
        }
    }

    // Handle cell input keydown events
    function handleInputKeyCommand(e: CustomEvent<{ event: KeyboardEvent, position: GridPosition | HeaderPosition }> ) {
        const { event: keyboardEvent, position } = e.detail;
        // Notify controller about input key command
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === 'Tab') {
            controller.handleInputCommit(keyboardEvent);
        } else if (keyboardEvent.key === 'Escape') {
            controller.handleInputCancel(keyboardEvent);
        }
        // Ensure focus is on the table container after input key command
        if (tableContainer) {
            tableContainer.focus();
        }
    }

    // =============================================================================================
    // ===================== PUBLIC API - Methods exposed for external control =====================
    // =============================================================================================

    export function selectPositions(positions: GridPosition[]) {
        controller.selectPositions(positions);
    }

    export function selectHeaders(headerType: 'row' | 'col', indices: number[]) {
        controller.selectHeaders(headerType, indices);
    }

    // Selection APIs that take functions aware of cell structure
    export function applySelections(selectionGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[]) {
        controller.applySelections(selectionGenerator);
    }

    export function applyHeaderSelections(
        headerType: 'row' | 'col',
        selectionGenerator: (
            headers: Map<string, TRowHeaderProps | TColHeaderProps>
        ) => number[]
    ) {
        controller.applyHeaderSelections(headerType, selectionGenerator);
    }

    export function applySelectionsToHeaderSubset(selectionGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[]) {
        controller.applySelectionsToHeaderSubset(selectionGenerator);
    }

    // Navigation APIs that take functions aware of cell structure
    export function navigateToFirst(cellMatcher: (cell: CellComponent<TExtraProps>) => boolean) {
        return controller.navigateToFirst(cellMatcher);
    }

    export function navigateToNext(cellMatcher: (cell: CellComponent<TExtraProps>) => boolean) {
        return controller.navigateToNext(cellMatcher);
    }

    export function navigateToPosition(position: GridPosition) {
        return controller.navigateToPosition(position);
    }

    export function getGridDimensions() {
        return controller.getGridDimensions();
    }

    export function getAllPositions() {
        return controller.getAllPositions();
    }

    export function clearSelection() {
        controller.selectPositions([]);
    }

    export function colorizeCell(position: GridPosition, color: string) {
        controller.setCellBackgroundColor(position, color);
    }

    export function colorizeCellTailwind(position: GridPosition, bg: string) {
        controller.setCellTailwindBackgroundColor(position, bg);
    }

    // Batch styling helpers exposed
    export function applyBackgroundStyles(styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, BackgroundProperties][]) {
        controller.applyBackgroundStyles(styleGenerator);
    }

    export function applyTailwindStyles(styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, TailwindProperties][]) {
        controller.applyTailwindStyles(styleGenerator);
    }

    // Headers styling APIs

    export function colorizeHeader(type: 'row' | 'col', index: number, color: string) {
        controller.setHeaderBackgroundColor(type, index, color);
    }

    // Data imputation APIs
    export function imputeValues(imputations: [GridPosition, CellValue][]) {
        return controller.imputeValues(imputations);
    }

    export function applyImputations(imputationGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, CellValue][]): GridPosition[] {
        return controller.applyImputations(imputationGenerator);
    }

    export function resetAllBackgrounds(): void {
        controller.resetAllBackgrounds();
    }

    export function resetAllStyles(): void {
        controller.resetAllStyles();
    }

    // Header + Row/Column styling APIs
    export function styleRowHeaderAndCells(row: number, headerProps: any, cellProps: any): void {
        controller.styleRowHeaderAndCells(row, headerProps, cellProps);
    }

    export function styleColHeaderAndCells(col: number, headerProps: any, cellProps: any): void {
        controller.styleColHeaderAndCells(col, headerProps, cellProps);
    }

    export function styleRowHeaderAndCellsTailwind(row: number, headerProps: any, cellProps: any): void {
        controller.styleRowHeaderAndCellsTailwind(row, headerProps, cellProps);
    }

    export function styleColHeaderAndCellsTailwind(col: number, headerProps: any, cellProps: any): void {
        controller.styleColHeaderAndCellsTailwind(col, headerProps, cellProps);
    }

    // Batch header + cells styling APIs
    export function applyRowHeaderAndCellsBackgroundStyles(styleGenerator: (headers: Map<string,
    HeaderComponent<TRowHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]): void {
        controller.applyRowHeaderAndCellsBackgroundStyles(styleGenerator);
    }

    export function applyColHeaderAndCellsBackgroundStyles(styleGenerator: (headers: Map<string,
    HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]): void {
        controller.applyColHeaderAndCellsBackgroundStyles(styleGenerator);
    }

    export function applyRowHeaderAndCellsTailwindStyles(styleGenerator: (headers: Map<string,
    HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]): void {
        controller.applyRowHeaderAndCellsTailwindStyles(styleGenerator);
    }

    export function applyColHeaderAndCellsTailwindStyles(styleGenerator: (headers: Map<string,
    HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]): void {
        controller.applyColHeaderAndCellsTailwindStyles(styleGenerator);
    }

    // Flash effect APIs
    export function flashCells(positions: GridPosition[], options?: FlashOptions) {
        controller.flashCells(positions, options);
    }

    export function flashHeaders(positions: HeaderPosition[], options?: FlashOptions) {
        controller.flashHeaders(positions, options);
    }

    // ========================================================================
    // ======================= EXPORT DATA API ================================
    // ========================================================================

    export function exportSelectedCells(): { [primaryHeader: string]: HeaderValue[] } {
        return controller.exportSelectedCells();
    }

    export function extractChangedCells(): { [primaryHeader: string]: HeaderValue[] } {
        return controller.exportChangedCells();
    }

    export function extractSelectedRows(): string[] {
        return controller.exportSelectedRows();
    }

    export function extractSelectedCols(): string[] {
        return controller.exportSelectedCols();
    }

    export function extractChangedCellsWithValues(): { [primaryHeader: string]: { [secondaryHeader: string]: CellValue } } {
        return controller.exportChangedCellsWithValues();
    }

    // ======================= EXTRAPROPS UPDATE API =======================

    /**
     * Update all cell extraProps with new values
     * The matrix must match the current grid dimensions
     */
    export function updateAllCellExtraProps(extraPropsMatrix: TExtraProps[][]) {
        controller.updateAllCellExtraProps(extraPropsMatrix);
    }

    /**
     * Update all row header extraProps with new values
     * The array must match the current number of rows
     */
    export function updateAllRowHeaderExtraProps(extraPropsArray: TRowHeaderProps[]) {
        controller.updateAllRowHeaderExtraProps(extraPropsArray);
    }

    /**
     * Update all column header extraProps with new values
     * The array must match the current number of columns
     */
    export function updateAllColHeaderExtraProps(extraPropsArray: TColHeaderProps[]) {
        controller.updateAllColHeaderExtraProps(extraPropsArray);
    }

    /**
     * Check if a specific property exists in extraProps schema
     * @param type Type of component to check ('cell', 'rowHeader', 'colHeader')
     * @param property Property name to check
     * @returns true if property exists in the schema
     */
    export function hasExtraProperty(type: 'cell' | 'rowHeader' | 'colHeader', property: string): boolean {
        return controller.hasExtraProperty(type, property);
    }

    /**
     * Get all known properties in extraProps schema for a component type
     * @param type Type of component ('cell', 'rowHeader', 'colHeader')
     * @returns Set of property names
     */
    export function getExtraPropertiesSchema(type: 'cell' | 'rowHeader' | 'colHeader'): Set<string> {
        return controller.getExtraPropertiesSchema(type);
    }

    // ======================= EXTERNAL PROCESSING CONTROL =======================

    /**
     * Set external processing state (for parent component operations like fetches)
     * @param message Message to display during processing
     * @param operation Optional operation identifier
     */
    export function setExternalProcessing(message: string, operation?: string): void {
        controller.setExternalProcessing(message, operation);
    }

    /**
     * Clear external processing state
     */
    export function clearExternalProcessing(): void {
        controller.clearExternalProcessing();
    }

    /**
     * Get current processing state
     * @returns Copy of current processing state
     */
    export function getProcessingState(): ProcessingState {
        return controller.getProcessingState();
    }

    // ======================= SETUP PHASE =======================
    // processed cells and headers
    let cellComponents: Map<string, CellComponent<TExtraProps>> = controller.getCellComponents();
    let colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>> = controller.getColHeaderComponents();
    let rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>> = controller.getRowHeaderComponents();
    let cornerHeaderComponent: HeaderComponent = controller.getCornerHeaderComponent();

    function initializeVirtualizerOnTableMount(event: CustomEvent<{ rowHeights: number[], colWidths: number[] }>) {
        rowHeights = event.detail.rowHeights;
        colWidths = event.detail.colWidths;
        scanning = false;

        // Initialize VirtualizeHandler now that dimensions are available
        // We need to wait for the next tick to ensure tableContainer is available
        // We also need to bind the tableContainer and the columns/rows header containers
        tick().then(() => {
            if (tableContainer) {
                controller.initializeVirtualization(
                    tableContainer,
                    rowHeights,
                    colWidths,
                );
                controller.setUpNavigator(tableContainer, rowHeights, colWidths);
                controller.setColumnsHeaderContainer(columnsHeaderContainer);
                controller.setRowsHeaderContainer(rowsHeaderContainer);
                controller.setMainGridContainer(mainGridContainer);
            }
        });
    }

</script>

<style>
    .active-state {
        box-shadow:
            0 0 0 3px rgba(59, 130, 246, 0.9),   /* borde sólido */
            0 0 10px 4px rgba(59, 130, 246, 0.25); /* halo más claro */
    }
</style>

{#if scanning}
    <!-- Phase to scan dimensions -->
    <DimensionScanner
        {gridDimensions}
        {cellComponents}
        {colHeaderComponents}
        {rowHeaderComponents}
        {cornerHeaderComponent}
        {rowsTitle}
        {fontSize}
        {minCellWidth}
        {minCellHeight}
        {numberFormat}
        instanceId={controller.getInstanceId()}
        on:done={initializeVirtualizerOnTableMount}
    />
{:else}

<div class="h-full w-full max-h-full relative">
    <!-- Scroll container for large tables -->
    <div
        bind:this={tableContainer}
        class="relative max-h-full max-w-full border border-tertiaryOnBg
            bg-tertiaryBg outline-none text-tertiaryOnBg
            overflow-auto overscroll-contain"
        tabindex="-1"
        class:active-state={navigationMode}
        on:focusout={handleFocusOut}
        on:keydown={(e) => controller.handleKeyDown(e)}
        on:scroll={(e) => controller.handleVirtualizationScroll()}
        style="font-size: {fontSize}; overflow-anchor: none;"
    >
        <!-- Parent grid with subgrid support -->
        <div
            class="parent-grid"
            style="
                display: grid;
                grid-template-columns: {colWidths.map(w => w + 'px').join(' ')};
                grid-template-rows: {rowHeights.map(h => h + 'px').join(' ')};
                gap: 0;
                width: {colWidths.reduce((sum, w) => sum + w, 0)}px;
                height: {rowHeights.reduce((sum, h) => sum + h, 0)}px;
            "
        >
            <!-- Top-Left Corner -->
            <div
                class="corner-header sticky top-0 left-0 z-10 bg-tertiaryBg"
                style="
                    display: grid;
                    grid-column: 1;
                    grid-row: 1;
                    grid-template-columns: subgrid;
                "
                on:mousedown={(e) => controller.handleCornerHeaderMouseEvent(e, 'mousedown')}
                on:contextmenu={(e) => controller.handleCornerHeaderMouseEvent(e, 'contextmenu')}
                on:auxclick={(e) => e.button === 1 && controller.handleCornerHeaderMouseEvent(e, 'middleclick')}
            >
            {#if visibleComponents.cornerHeader}
                <Header
                    position={visibleComponents.cornerHeader.position}
                    value={visibleComponents.cornerHeader.value}
                    styling={visibleComponents.cornerHeader.styles.styling}
                    tailwindStyling={visibleComponents.cornerHeader.styles.tailwindStyling}
                    instanceId={controller.getInstanceId()}
                />
            {/if}
            </div>

            <!-- Columns Headers -->
            <div
                bind:this={columnsHeaderContainer}
                class="columns-headers sticky top-0 z-[6] bg-tertiaryBg"
                style="
                    display: grid;
                    grid-column: 2 / -1;
                    grid-row: 1;
                    grid-template-columns: subgrid;
                "
                on:mousedown={(e) => controller.handleColHeaderMouseEvent(e, 'mousedown')}
                on:mouseenter={(e) => controller.handleColHeaderMouseEvent(e, 'mouseenter')}
                on:mouseup={(e) => controller.handleColHeaderMouseEvent(e, 'mouseup')}
                on:dblclick={(e) => controller.handleColHeaderMouseEvent(e, 'dblclick')}
                on:contextmenu={(e) => controller.handleColHeaderMouseEvent(e, 'contextmenu')}
                on:auxclick={(e) => e.button === 1 && controller.handleColHeaderMouseEvent(e, 'middleclick')}
                on:mousemove={(e) => controller.handleUnifiedMouseMove(e, 'colHeaders')}
                on:mouseleave={() => controller.handleContainerMouseLeave('colHeaders')}
            >
                <!-- Render InputHeader if editing a column header -->
                {#if currentEditingState && currentEditingState.type === 'header' && currentEditingState.position && 'headerType' in currentEditingState.position && currentEditingState.position.headerType === 'col'}
                    <InputHeader
                        position={currentEditingState.position}
                        styling={currentEditingState.component.styles.styling}
                        tailwindStyling={currentEditingState.component.styles.tailwindStyling}
                        instanceId={controller.getInstanceId()}
                        on:inputBlur={handleInputBlur}
                        on:inputKeyCommit={handleInputKeyCommand}
                        on:inputKeyCancel={handleInputKeyCommand}
                    />
                {/if}
                <!-- Render visible column headers from VirtualizeHandler -->
                {#each visibleComponents.colHeaders as headerComponent}
                    <!-- Only render if the header is not being edited -->
                    {#if !(currentEditingState && currentEditingState.type === 'header' &&
                           currentEditingState.position && 'headerType' in currentEditingState.position &&
                           currentEditingState.position.headerType === 'col' &&
                           headerComponent.position.index === currentEditingState.position.index)}
                        <Header
                            position={headerComponent.position}
                            value={headerComponent.value}
                            styling={headerComponent.styles.styling}
                            tailwindStyling={headerComponent.styles.tailwindStyling}
                            instanceId={controller.getInstanceId()}
                        />
                    {/if}
                {/each}

                <!-- Render column header selections -->
                {#each headerSelectionsCols as selection}
                    <HeaderSelectionRect
                        headerGridArea={{...selection.getHeaderGridArea()}}
                        type="col"
                    />
                {/each}

                <!-- Render column header deselection if exists -->
                {#if headerDeselectionCol}
                    <HeaderDeselectionRect
                        headerGridArea={{...headerDeselectionCol.getHeaderGridArea()}}
                        type="col"
                    />
                {/if}

            </div>

            <!-- Rows Headers -->
            <div
                bind:this={rowsHeaderContainer}
                class="rows-headers text-center sticky left-0 z-[6] bg-tertiaryBg"
                style="
                    display: grid;
                    grid-column: 1;
                    grid-row: 2 / -1;
                    grid-template-rows: subgrid;
                "
                on:mousedown={(e) => controller.handleRowHeaderMouseEvent(e, 'mousedown')}
                on:mouseenter={(e) => controller.handleRowHeaderMouseEvent(e, 'mouseenter')}
                on:mouseup={(e) => controller.handleRowHeaderMouseEvent(e, 'mouseup')}
                on:dblclick={(e) => controller.handleRowHeaderMouseEvent(e, 'dblclick')}
                on:contextmenu={(e) => controller.handleRowHeaderMouseEvent(e, 'contextmenu')}
                on:auxclick={(e) => e.button === 1 && controller.handleRowHeaderMouseEvent(e, 'middleclick')}
                on:mousemove={(e) => controller.handleUnifiedMouseMove(e, 'rowHeaders')}
                on:mouseleave={() => controller.handleContainerMouseLeave('rowHeaders')}
            >
                <!-- Render InputHeader if editing a row header -->
                {#if currentEditingState && currentEditingState.type === 'header' && currentEditingState.position && 'headerType' in currentEditingState.position && currentEditingState.position.headerType === 'row'}
                    <InputHeader
                        position={currentEditingState.position}
                        styling={currentEditingState.component.styles.styling}
                        tailwindStyling={currentEditingState.component.styles.tailwindStyling}
                        instanceId={controller.getInstanceId()}
                        on:inputBlur={handleInputBlur}
                        on:inputKeyCommit={handleInputKeyCommand}
                        on:inputKeyCancel={handleInputKeyCommand}
                    />
                {/if}
                <!-- Render visible row headers from VirtualizeHandler -->
                {#each visibleComponents.rowHeaders as headerComponent}
                    <!-- Only render if the header is not being edited -->
                    {#if !(currentEditingState && currentEditingState.type === 'header' &&
                           currentEditingState.position && 'headerType' in currentEditingState.position &&
                           currentEditingState.position.headerType === 'row' &&
                           headerComponent.position.index === currentEditingState.position.index)}
                        <Header
                            position={headerComponent.position}
                            value={headerComponent.value}
                            styling={headerComponent.styles.styling}
                            tailwindStyling={headerComponent.styles.tailwindStyling}
                            instanceId={controller.getInstanceId()}
                        />
                    {/if}
                {/each}

                <!-- Render row header selections -->
                {#each headerSelectionsRows as selection}
                    <HeaderSelectionRect
                        headerGridArea={{...selection.getHeaderGridArea()}}
                        type="row"
                    />
                {/each}

                <!-- Render row header deselection if exists -->
                {#if headerDeselectionRow}
                    <HeaderDeselectionRect
                        headerGridArea={{...headerDeselectionRow.getHeaderGridArea()}}
                        type="row"
                    />
                {/if}

            </div>

            <!-- Corner Header (top-left sticky intersection) -->
            <div
                class="corner-header sticky top-0 left-0 z-60 bg-tertiaryBg border-r border-b border-tertiaryOnBg"
                style="
                    grid-column: 1;
                    grid-row: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                "
            >
                <!-- Corner content can be added here if needed -->
            </div>

            <!-- Main grid as subgrid (tu grid actual sin cambios) -->
            <div
                bind:this={mainGridContainer}
                class="main-grid"
                style="
                    display: grid;
                    grid-column: 2 / -1;
                    grid-row: 2 / -1;
                    grid-template-columns: subgrid;
                    grid-template-rows: subgrid;
                    gap: 0;
                "
                on:mousedown={(e) => controller.handleMainGridMouseEvent(e, 'mousedown')}
                on:mouseenter={(e) => controller.handleMainGridMouseEvent(e, 'mouseenter')}
                on:mouseup={(e) => controller.handleMainGridMouseEvent(e, 'mouseup')}
                on:dblclick={(e) => controller.handleMainGridMouseEvent(e, 'dblclick')}
                on:contextmenu={(e) => controller.handleMainGridMouseEvent(e, 'contextmenu')}
                on:auxclick={(e) => e.button === 1 && controller.handleMainGridMouseEvent(e, 'middleclick')}
                on:mousemove={(e) => controller.handleUnifiedMouseMove(e, 'main')}
                on:mouseleave={() => controller.handleContainerMouseLeave('main')}
            >
                <!-- Render InputCell if existing -->
                {#if currentEditingState && currentEditingState.type === 'cell' && currentEditingState.position && 'row' in currentEditingState.position}
                    <InputCell
                        position={currentEditingState.position}
                        styling={currentEditingState.component.styles.styling}
                        tailwindStyling={currentEditingState.component.styles.tailwindStyling}
                        instanceId={controller.getInstanceId()}
                        on:inputBlur={handleInputBlur}
                        on:inputKeyCommit={handleInputKeyCommand}
                        on:inputKeyCancel={handleInputKeyCommand}
                    />
                {/if}
                <!-- Render visible cells from VirtualizeHandler -->
                {#each visibleComponents.cells as cellComponent}
                    <!-- Only render if the cell is not being edited -->
                    {#if !(currentEditingState && currentEditingState.type === 'cell' &&
                           currentEditingState.position && 'row' in currentEditingState.position &&
                           cellComponent.position.row === currentEditingState.position.row &&
                           cellComponent.position.col === currentEditingState.position.col)}
                        <Cell
                            position={cellComponent.position}
                            value={cellComponent.value}
                            styling={cellComponent.styles.styling}
                            tailwindStyling={cellComponent.styles.tailwindStyling}
                            instanceId={controller.getInstanceId()}
                            numberFormat={numberFormat}
                        />
                    {/if}
                {/each}

                <!-- Overlaid pointer -->
                <CellPointer
                    position={pointerPosition}
                />

                <!-- Render selections -->
                {#each selections as selection}
                    <SelectionRect
                        gridArea={{...selection.getGridArea()}}
                    />
                {/each}

                <!-- Render derived cell selections from header selections -->
                {#each derivedCellSelections as selection}
                    <SelectionRect
                        gridArea={{...selection.getGridArea()}}
                    />
                {/each}

                <!-- Render deselection area -->
                {#if deSelection}
                    <DeselectionRect
                        gridArea={{...deSelection.getGridArea()}}
                    />
                {/if}
            </div>
        </div>
    </div>

    <!-- Navigation overlay -->
    <NavigationOverlay
        visible={!navigationMode}
        on:activate={handleNavigationActivate}
    />

    <!-- Processing overlay -->
    {#if currentProcessingState.isProcessing}
        <ProcessingOverlay message={currentProcessingState.message} />
    {/if}

</div>
{/if}