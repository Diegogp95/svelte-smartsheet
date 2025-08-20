<script lang="ts" generics="TExtraProps = undefined">
    import Cell from './Cell.svelte';
    import CellBackground from './CellBackground.svelte';
    import CellPointer from './CellPointer.svelte';
    import Header from './Header.svelte';
    import NavigationOverlay from './NavigationOverlay.svelte';
    import SmartSheetController from './SmartSheetController';
    import { Selection } from './SelectionHandler';
    import type { SelectionChangedCallback } from './SelectionHandler';
    import type { PointerPositionCallback } from './NavigationHandler';
    import type {
        GridPosition,
        CellMouseEvent,
        CellValue,
        CellComponent,
        HeaderComponent,
        HeaderMouseEvent,
    } from './types';
    import SelectionRect from './SelectionRect.svelte';
    import DeselectionRect from './DeselectionRect.svelte';
    import HeaderBackground from './HeaderBackground.svelte';

    // Data
    export let gridData: (CellValue | undefined)[][];
    export let extraPropsMatrix: (TExtraProps | undefined)[][] | undefined = undefined;

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

    // Create controller with grid dimensions
    let controller = new SmartSheetController<TExtraProps>({
        maxRow: gridData.length - 1,
        maxCol: (gridData[0]?.length || 1) - 1
    }, subscribeToSelections, subscribeToPointerPosition, subscribeToDeselection);
    let tableContainer: HTMLDivElement;
    let columnsHeaderContainer: HTMLDivElement;
    let rowsHeaderContainer: HTMLDivElement;

    // Reactive states managed by controller
    let navigationMode = false;

    // Update container reference when available
    $: if (tableContainer) {
        controller.setTableContainer(tableContainer);
    }

    // Update header container references when available
    $: if (columnsHeaderContainer) {
        controller.setColumnsHeaderContainer(columnsHeaderContainer);
    }

    $: if (rowsHeaderContainer) {
        controller.setRowsHeaderContainer(rowsHeaderContainer);
    }

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

    // Handle keyboard navigation
    function handleKeyDown(event: KeyboardEvent) {
        controller.handleKeyDown(event);
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

    // PUBLIC API - Methods exposed for external control
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
        controller.setCellTailwindBackgroundColor(position, [bg]);
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

</script>

<div class="smart-sheet relative">
    <!-- Scroll container for large tables -->
    <div
        bind:this={tableContainer}
        class="overflow-auto max-h-96 max-w-full border border-tertiaryOnBg bg-tertiaryBg relative outline-none"
        tabindex="-1"
        on:focusout={handleFocusOut}
        on:keydown={handleKeyDown}
    >
        <!-- Parent grid with subgrid support -->
        <div
            class="parent-grid"
            style="
                display: grid;
                grid-template-columns: auto repeat({gridData[0]?.length || 1}, auto);
                grid-template-rows: auto repeat({gridData.length}, auto);
                gap: 0;
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
            >
                <div class="flex z-20" style="grid-row: 1; grid-column: 1;">
                    <Header
                        position={{ headerType: 'corner', index: 0 }}
                        value={''}
                        onHeaderCreation={(header) => controller.registerHeader(header)}
                        onHeaderDestruction={(header) => controller.unregisterHeader(header)}
                    />
                </div>
                <div class="flex z-10" style="grid-row: 1; grid-column: 1;">
                    <HeaderBackground
                        position={{ headerType: 'corner', index: 0 }}
                        onBackgroundCreation={(bg) => controller.registerHeaderBackground(bg)}
                        onBackgroundDestruction={(bg) => controller.unregisterHeaderBackground(bg)}
                    />
                </div>
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
            >
                {#each gridData[0] || [] as _, colIndex}
                    <div class="flex z-20" style="grid-row: 1; grid-column: {colIndex + 1};">
                        <Header
                            position={{ headerType: 'col', index: colIndex }}
                            onHeaderCreation={(header) => controller.registerHeader(header)}
                            onHeaderDestruction={(header) => controller.unregisterHeader(header)}
                            on:headerInteraction={handleMouseEvent}
                        />
                    </div>
                    <div class="flex z-10" style="grid-row: 1; grid-column: {colIndex + 1};">
                        <HeaderBackground
                            position={{ headerType: 'col', index: colIndex }}
                            onBackgroundCreation={(bg) => controller.registerHeaderBackground(bg)}
                            onBackgroundDestruction={(bg) => controller.unregisterHeaderBackground(bg)}
                        />
                    </div>
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
            >
                {#each gridData as _, rowIndex}
                    <div class="flex z-20" style="grid-row: {rowIndex + 1}; grid-column: 1;">
                        <Header
                            position={{ headerType: 'row', index: rowIndex }}
                            value={undefined}
                            onHeaderCreation={(header) => controller.registerHeader(header)}
                            onHeaderDestruction={(header) => controller.unregisterHeader(header)}
                            on:headerInteraction={handleMouseEvent}
                        />
                    </div>
                    <div class="flex z-10" style="grid-row: {rowIndex + 1}; grid-column: 1;">
                        <HeaderBackground
                            position={{ headerType: 'row', index: rowIndex }}
                            onBackgroundCreation={(bg) => controller.registerHeaderBackground(bg)}
                            onBackgroundDestruction={(bg) => controller.unregisterHeaderBackground(bg)}
                        />
                    </div>
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
                class="main-grid text-tertiaryOnBg"
                style="
                    display: grid;
                    grid-column: 2 / -1;
                    grid-row: 2 / -1;
                    grid-template-columns: subgrid;
                    grid-template-rows: subgrid;
                    gap: 0;
                "
            >
                {#each gridData as row, rowIndex}
                    {#each row as cellValue, colIndex}
                        <div class="flex z-[5]" style="grid-row: {rowIndex + 1}; grid-column: {colIndex + 1};">
                            <Cell
                                value={cellValue}
                                position={{ row: rowIndex, col: colIndex }}
                                extraProps={extraPropsMatrix?.[rowIndex]?.[colIndex]}
                                onCellCreation={(cell) => controller.registerCell(cell)}
                                onCellDestruction={(cell) => controller.unregisterCell(cell)}
                                on:cellInteraction={handleMouseEvent}
                                on:cellDoubleClick={handleMouseEvent}
                                on:inputBlur={handleCellInputBlur}
                                on:inputKeyCommit={handleCellInputKeyCommand}
                                on:inputKeyCancel={handleCellInputKeyCommand}
                            />
                        </div>
                    {/each}
                {/each}

                <!-- Background components for styling (lower priority than selections and pointer) -->
                {#each gridData as row, rowIndex}
                    {#each row as cellValue, colIndex}
                        <div class="flex z-[1]" style="grid-row: {rowIndex + 1}; grid-column: {colIndex + 1};">
                            <!-- Background component for each cell -->
                            <CellBackground
                                position={{ row: rowIndex, col: colIndex }}
                                onBackgroundCreation={(bg) => controller.registerBackground(bg)}
                                onBackgroundDestruction={(bg) => controller.unregisterBackground(bg)}
                            />
                        </div>
                    {/each}
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

    <!-- Navigation overlay OUTSIDE scroll container -->
    <NavigationOverlay
        visible={!navigationMode}
        on:activate={handleNavigationActivate}
    />
</div>