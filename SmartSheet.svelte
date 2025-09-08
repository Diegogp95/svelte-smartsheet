<script lang="ts" generics="TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined">
    import Cell from './Cell.svelte';
    import InputCell from './InputCell.svelte';
    import CellPointer from './CellPointer.svelte';
    import Header from './Header.svelte';
    import NavigationOverlay from './NavigationOverlay.svelte';
    import SmartSheetController from './SmartSheetController';
    import { Selection } from './SelectionHandler';
    import type { SelectionChangedCallback } from './SelectionHandler';
    import type { PointerPositionCallback } from './NavigationHandler';
    import type { VisibleComponentsCallback } from './VirtualizeHandler';
    import type { EditingStateCallback } from './DataHandler';
    import type {
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
    } from './types';
    import SelectionRect from './SelectionRect.svelte';
    import DeselectionRect from './DeselectionRect.svelte';
    import { tick } from 'svelte';
    import DimensionScanner from './DimensionScanner.svelte';

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
    export let styleMode: 'style' | 'tailwind' = 'style'; // Choose between inline styles or Tailwind CSS classes

    // Scan phase
    let scanning: boolean = true;
    let rowHeights: number[] = [];
    let colWidths: number[] = [];

    // Selections array to render, will be subscribed to controller's selections by a callback
    let selections: Selection[] = [];
    // Callback to get selections from controller
    const subscribeToSelections: SelectionChangedCallback = (handler) => {
        selections = handler.getSelections();
    };
    // Pointer position variable to be subscribed to controller updates
    let pointerPosition: GridPosition = { row: 0, col: 0 };
    // Callback to update pointer position from controller
    const subscribeToPointerPosition: PointerPositionCallback = (handler) => {
        pointerPosition = handler.getCurrentPosition();
    };

    let deSelection: Selection | null = null;
    // Callback to get deselection area from controller
    const subscribeToDeselection: SelectionChangedCallback = (handler) => {
        deSelection = handler.getDeselection();
    };

    // EDITING STATE: Centralized editing state managed by DataHandler
    let currentEditingPosition: GridPosition | null = null;
    let currentEditingCell: CellComponent<TExtraProps> | null = null;
    // Callback to get editing state from DataHandler
    const subscribeToEditingState: EditingStateCallback = (handler) => {
        currentEditingPosition = handler.getCurrentEditingPosition();
        currentEditingCell = handler.getCurrentEditingCell();
//        console.log('currentEditingCell', currentEditingCell);
//        console.log('currentEditingPosition', currentEditingPosition);
//        console.log('currentEditingInputValue', currentEditingInputValue);
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
    let controller = new SmartSheetController<TExtraProps, TRowHeaderProps, TColHeaderProps>({
        maxRow: gridData.length - 1,
        maxCol: (gridData[0]?.length || 1) - 1
    }, gridData as CellValue[][], rowHeaders, columnHeaders, rowsTitle,
    extraPropsMatrix, rowHeaderExtraProps, colHeaderExtraProps, styleMode,
    subscribeToSelections, subscribeToPointerPosition, subscribeToDeselection,
    subscribeToVisibleComponents, undefined, subscribeToEditingState);

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
    function handleCellInputBlur(event: CustomEvent<{ event: FocusEvent, position: GridPosition }>) {
        const { position } = event.detail;
        // Notify controller about input blur
        controller.handleInputBlur(position);
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
    function handleCellInputKeyCommand(e: CustomEvent<{ event: KeyboardEvent, position: GridPosition }>) {
        const { event: keyboardEvent, position } = e.detail;
        // Notify controller about input key command
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === 'Tab') {
            controller.handleCellInputCommit(position, keyboardEvent);
        } else if (keyboardEvent.key === 'Escape') {
            controller.handleCellInputCancel(position, keyboardEvent);
        }
        // Ensure focus is on the table container after input key command
        if (tableContainer) {
            tableContainer.focus();
        }
    }

    // Header input blur handler
    function handleHeaderInputBlur(event: CustomEvent<{ event: FocusEvent, position: HeaderPosition }>) {
        const { position } = event.detail;
        // Notify controller about header input blur
        controller.handleHeaderInputBlur(position);
        // Blur in a header must trigger blur in the table container
        if (tableContainer) {
            handleFocusOut(event.detail.event);
        }
    }

    // Handle header input keydown events
    function handleHeaderInputKeyCommand(e: CustomEvent<{ event: KeyboardEvent, position: HeaderPosition }>) {
        const { event: keyboardEvent, position } = e.detail;
        // Notify controller about header input key command
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === 'Tab') {
            controller.handleHeaderInputCommit(position, keyboardEvent);
        } else if (keyboardEvent.key === 'Escape') {
            controller.handleHeaderInputCancel(position, keyboardEvent);
        }
        // Ensure focus is on the table container after header input key command
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
    export function applyBackgroundStyles(styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, any][]) {
        controller.applyBackgroundStyles(styleGenerator as any);
    }

    export function applyTailwindStyles(styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, any][]) {
        controller.applyTailwindStyles(styleGenerator as any);
    }

    // Selection APIs that take functions aware of cell structure
    export function applySelections(selectionGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[]) {
        controller.applySelections(selectionGenerator as any);
    }

    // Navigation APIs that take functions aware of cell structure
    export function navigateToFirst(cellMatcher: (cell: CellComponent<TExtraProps>) => boolean) {
        return controller.navigateToFirst(cellMatcher as any);
    }

    export function navigateToNext(cellMatcher: (cell: CellComponent<TExtraProps>) => boolean) {
        return controller.navigateToNext(cellMatcher as any);
    }

    // Data imputation APIs
    export function imputeValues(imputations: [GridPosition, any][]) {
        return controller.imputeValues(imputations as any);
    }

    export function applyImputations(imputationGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, any][]): GridPosition[] {
        return controller.applyImputations(imputationGenerator as any);
    }

    export function resetAllBackgrounds(): void {
        controller.resetAllBackgrounds();
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
        controller.applyRowHeaderAndCellsBackgroundStyles(styleGenerator as any);
    }

    export function applyColHeaderAndCellsBackgroundStyles(styleGenerator: (headers: Map<string,
    HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]): void {
        controller.applyColHeaderAndCellsBackgroundStyles(styleGenerator as any);
    }

    export function applyRowHeaderAndCellsTailwindStyles(styleGenerator: (headers: Map<string,
    HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]): void {
        controller.applyRowHeaderAndCellsTailwindStyles(styleGenerator as any);
    }

    export function applyColHeaderAndCellsTailwindStyles(styleGenerator: (headers: Map<string,
    HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]): void {
        controller.applyColHeaderAndCellsTailwindStyles(styleGenerator as any);
    }

    // Flash effect APIs
    export function flashCells(positions: GridPosition[], options?: FlashOptions) {
        controller.flashCells(positions, options);
    }

    export function flashHeaders(positions: HeaderPosition[], options?: FlashOptions) {
        controller.flashHeaders(positions, options);
    }

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
        {gridData}
        {columnHeaders}
        {rowHeaders}
        {rowsTitle}
        {fontSize}
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
                on:contextmenu={(e) => controller.handleColHeaderMouseEvent(e, 'contextmenu')}
                on:auxclick={(e) => e.button === 1 && controller.handleColHeaderMouseEvent(e, 'middleclick')}
                on:mousemove={(e) => controller.handleUnifiedMouseMove(e, 'colHeaders')}
                on:mouseleave={() => controller.handleContainerMouseLeave('colHeaders')}
            >
                {#each visibleComponents.colHeaders as headerComponent}
                    <Header
                        position={headerComponent.position}
                        value={headerComponent.value}
                        styling={headerComponent.styles.styling}
                        tailwindStyling={headerComponent.styles.tailwindStyling}
                    />
                {/each}
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
                on:contextmenu={(e) => controller.handleRowHeaderMouseEvent(e, 'contextmenu')}
                on:auxclick={(e) => e.button === 1 && controller.handleRowHeaderMouseEvent(e, 'middleclick')}
                on:mousemove={(e) => controller.handleUnifiedMouseMove(e, 'rowHeaders')}
                on:mouseleave={() => controller.handleContainerMouseLeave('rowHeaders')}
            >
                {#each visibleComponents.rowHeaders as headerComponent}
                    <Header
                        position={headerComponent.position}
                        value={headerComponent.value}
                        styling={headerComponent.styles.styling}
                        tailwindStyling={headerComponent.styles.tailwindStyling}
                    />
                {/each}
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
                {#if currentEditingPosition && currentEditingCell}
                    <InputCell
                        position={currentEditingPosition}
                        styling={currentEditingCell.styles.styling}
                        tailwindStyling={currentEditingCell.styles.tailwindStyling}
                        on:inputBlur={handleCellInputBlur}
                        on:inputKeyCommit={handleCellInputKeyCommand}
                        on:inputKeyCancel={handleCellInputKeyCommand}
                    />
                {/if}
                <!-- Render visible cells from VirtualizeHandler -->
                {#each visibleComponents.cells as cellComponent}
                    <!-- Only render if the cell is not being edited -->
                    {#if !(currentEditingPosition && currentEditingPosition.row === cellComponent.position.row
                        && currentEditingPosition.col === cellComponent.position.col)}
                        <Cell
                            position={cellComponent.position}
                            value={cellComponent.value}
                            styling={cellComponent.styles.styling}
                            tailwindStyling={cellComponent.styles.tailwindStyling}
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
                        active={selection.isActiveSelection()}
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

</div>
{/if}