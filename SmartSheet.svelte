<script lang="ts">
    import Cell from './Cell.svelte';
    import CellPointer from './CellPointer.svelte';
    import NavigationOverlay from './NavigationOverlay.svelte';
    import SmartSheetController from './SmartSheetController';
    import { Selection } from './SelectionHandler';
    import type { SelectionChangedCallback } from './SelectionHandler';
    import type { PointerPositionCallback } from './NavigationHandler';
    import type {
        GridPosition,
        CellMouseEvent,
    } from './types';
    import SelectionRect from './SelectionRect.svelte';
    import DeselectionRect from './DeselectionRect.svelte';
    import { onMount } from 'svelte';

    // Test data with many columns
    let gridData = [
        ['Name', 'Age', 'City', 'Salary', 'Department', 'Position', 'Start Date', 'Manager', 'Phone', 'Email', 'Country', 'Experience', 'Skills', 'Rating', 'Bonus', 'Benefits', 'Status', 'Projects', 'Hours', 'Performance'],
        ['Alice', 25, 'Madrid', 45000, 'Engineering', 'Developer', '2023-01-15', 'John Smith', '+34-123-456', 'alice@company.com', 'Spain', '2 years', 'JavaScript', 4.5, 5000, 'Health+Dental', 'Active', 3, 40, 'Excellent'],
        ['Bob', 30, 'Barcelona', 52000, 'Marketing', 'Manager', '2022-03-20', 'Jane Doe', '+34-987-654', 'bob@company.com', 'Spain', undefined, undefined, undefined, 7000, undefined, 'Active', 5, 45, 'Good'],
        ['Carol', 28, 'Valencia', 48000, 'Design', 'UX Designer', '2023-06-10', 'Mike Johnson', '+34-555-777', 'carol@company.com', 'Spain', '3 years', 'Figma', 4.8, 4500, 'Health Only', undefined, 2, 38, 'Outstanding'],
        ['David', 35, 'Sevilla', 55000, 'Sales', 'Director', '2021-08-30', 'Sarah Wilson', '+34-111-222', 'david@company.com', 'Spain', '8 years', 'CRM', 4.0, 8000, 'Premium', 'On Leave', 7, 42, 'Good'],
        ['Emma', 27, 'Bilbao', 46000, 'Engineering', 'Frontend', '2023-02-28', 'John Smith', '+34-333-444', 'emma@company.com', 'Spain', '2.5 years', 'React', 4.6, 5500, 'Health+Dental', 'Active', 4, 40, 'Excellent'],
        ['Frank', 32, 'Granada', 51000, 'Operations', 'Analyst', '2022-11-15', 'Lisa Brown', '+34-666-888', 'frank@company.com', 'Spain', '6 years', 'SQL', 4.3, 6000, 'Full Package', 'Active', 3, 41, 'Good'],
        ['Grace', 29, 'Alicante', 49000, 'HR', 'Specialist', '2023-04-05', 'Tom Garcia', '+34-777-999', 'grace@company.com', 'Spain', '4 years', 'Recruiting', 4.7, 4800, 'Health+Vision', 'Active', 2, 39, 'Very Good']
    ];

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
    let controller = new SmartSheetController({
        maxRow: gridData.length - 1,
        maxCol: (gridData[0]?.length || 1) - 1
    }, subscribeToSelections, subscribeToPointerPosition, subscribeToDeselection);
    let tableContainer: HTMLDivElement;

    // Reactive states managed by controller
    let navigationMode = false;

    // Update container reference when available
    $: if (tableContainer) {
        controller.setTableContainer(tableContainer);
    }

    // Cell mouse event handler
    function handleCellMouseEvent(event: CustomEvent<CellMouseEvent>) {
        if (!navigationMode) {
            handleNavigationActivate();
        }
        controller.handleMouseEvent(event.detail);
    }

    // Cell input blur handler
    function handleCellInputBlur(event: CustomEvent<{ event: FocusEvent, position: GridPosition }>) {
        const { position } = event.detail;
        console.log(`[SmartSheet] Cell input blurred at position (${position.row}, ${position.col})`);
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
        if (!related || !tableContainer.contains(related)) {
            console.log('[tableContainer] Real blur: focus left table');
            navigationMode = controller.deactivateNavigation();
        } else {
            console.log('[tableContainer] Ignored blur: focus moved within');
        }
    }

    // Handle keyboard navigation
    function handleKeyDown(event: KeyboardEvent) {
        controller.handleKeyDown(event);
    }

    // PUBLIC API - Methods exposed for external control
    export function selectPositions(positions: GridPosition[]) {
        controller.selectPositions(positions);
    }

    export function addToSelection(positions: GridPosition[]) {
        controller.addToSelection(positions);
    }

    export function removeFromSelection(positions: GridPosition[]) {
        controller.removeFromSelection(positions);
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


    // logging for debugging of focus
//    onMount(() => {
//        tableContainer?.addEventListener('focus', () => console.log('[tableContainer] FOCUS'), true);
//        tableContainer?.addEventListener('blur', () => console.log('[tableContainer] BLUR'), true);
//        tableContainer?.addEventListener('mousedown', () => console.log('[tableContainer] MOUSEDOWN'), true);
//        tableContainer?.addEventListener('mouseup', () => console.log('[tableContainer] MOUSEUP'), true);
//        tableContainer?.addEventListener('click', () => console.log('[tableContainer] CLICK'), true);
//        tableContainer?.addEventListener('dblclick', () => console.log('[tableContainer] DBLCLICK'), true);
//    });
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
        <!-- Grid of cells with auto-sizing -->
        <div class="grid gap-0 text-tertiaryOnBg" style="grid-template-columns: repeat({gridData[0]?.length || 1}, auto); display: grid;">
            {#each gridData as row, rowIndex}
                {#each row as cellValue, colIndex}
                    <div class="flex" style="grid-row: {rowIndex + 1}; grid-column: {colIndex + 1};">
                        <Cell
                            value={cellValue}
                            position={{ row: rowIndex, col: colIndex }}
                            onCellCreation={(cell) => controller.registerCell(cell)}
                            onCellDestruction={(cell) => controller.unregisterCell(cell)}
                            on:cellInteraction={handleCellMouseEvent}
                            on:cellDoubleClick={handleCellMouseEvent}
                            on:inputBlur={handleCellInputBlur}
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

    <!-- Navigation overlay OUTSIDE scroll container -->
    <NavigationOverlay
        visible={!navigationMode}
        on:activate={handleNavigationActivate}
    />
</div>