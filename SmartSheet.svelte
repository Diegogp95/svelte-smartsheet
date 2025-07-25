<script lang="ts">
    import Cell from './Cell.svelte';
    import CellPointer from './CellPointer.svelte';
    import NavigationOverlay from './NavigationOverlay.svelte';
    import { SmartSheetNavigation, type GridPosition, type NavigationState } from './navigationHandlers';

    // Test data with many columns
    let gridData = [
        ['Name', 'Age', 'City', 'Salary', 'Department', 'Position', 'Start Date', 'Manager', 'Phone', 'Email', 'Country', 'Experience', 'Skills', 'Rating', 'Bonus', 'Benefits', 'Status', 'Projects', 'Hours', 'Performance'],
        ['Alice', 25, 'Madrid', 45000, 'Engineering', 'Developer', '2023-01-15', 'John Smith', '+34-123-456', 'alice@company.com', 'Spain', '2 years', 'JavaScript', 4.5, 5000, 'Health+Dental', 'Active', 3, 40, 'Excellent'],
        ['Bob', 30, 'Barcelona', 52000, 'Marketing', 'Manager', '2022-03-20', 'Jane Doe', '+34-987-654', 'bob@company.com', 'Spain', '5 years', 'Analytics', 4.2, 7000, 'Full Package', 'Active', 5, 45, 'Good'],
        ['Carol', 28, 'Valencia', 48000, 'Design', 'UX Designer', '2023-06-10', 'Mike Johnson', '+34-555-777', 'carol@company.com', 'Spain', '3 years', 'Figma', 4.8, 4500, 'Health Only', 'Active', 2, 38, 'Outstanding'],
        ['David', 35, 'Sevilla', 55000, 'Sales', 'Director', '2021-08-30', 'Sarah Wilson', '+34-111-222', 'david@company.com', 'Spain', '8 years', 'CRM', 4.0, 8000, 'Premium', 'On Leave', 7, 42, 'Good'],
        ['Emma', 27, 'Bilbao', 46000, 'Engineering', 'Frontend', '2023-02-28', 'John Smith', '+34-333-444', 'emma@company.com', 'Spain', '2.5 years', 'React', 4.6, 5500, 'Health+Dental', 'Active', 4, 40, 'Excellent'],
        ['Frank', 32, 'Granada', 51000, 'Operations', 'Analyst', '2022-11-15', 'Lisa Brown', '+34-666-888', 'frank@company.com', 'Spain', '6 years', 'SQL', 4.3, 6000, 'Full Package', 'Active', 3, 41, 'Good'],
        ['Grace', 29, 'Alicante', 49000, 'HR', 'Specialist', '2023-04-05', 'Tom Garcia', '+34-777-999', 'grace@company.com', 'Spain', '4 years', 'Recruiting', 4.7, 4800, 'Health+Vision', 'Active', 2, 39, 'Very Good']
    ];

    // Navigation instance
    let navigation = new SmartSheetNavigation(gridData);
    let tableContainer: HTMLDivElement;
    let pointerVisible = true;

    // Reactive states derived from navigation
    $: navigationState = navigation.getState();
    $: pointerPosition = navigationState.pointerPosition;
    $: navigationMode = navigationState.navigationMode;
    $: selectedCells = navigationState.selectedCells; // Extract for reactivity
    $: {
        console.log('Navigation state updated:', {
            navigationMode,
            pointerPosition,
            selectedCells: Array.from(navigationState.selectedCells)
        });
    }

    // Reactive function that updates automatically
    $: isCellSelected = (row: number, col: number) => {
        return navigationMode && selectedCells.has(`${row}-${col}`);
    };

    // Update container reference when available
    $: if (tableContainer) {
        navigation.setTableContainer(tableContainer);
    }

    // Cell event handler
    function handleCellClick(event: CustomEvent) {
        const { position, selected, value } = event.detail;

        // Activate navigation if not active
        if (!navigationMode) {
            handleNavigationActivate();
        }

        // Move pointer to clicked cell
        const newState = navigation.moveToPosition(position);
        if (newState) {
            navigationState = newState;
        }

        console.log(`Cell clicked at ${position.row}-${position.col}:`, {
            value,
            selected,
            position
        });
    }

    // Activate navigation mode
    function handleNavigationActivate() {
        const newState = navigation.activateNavigation();
        // Force reactive update
        navigationState = newState;
    }

    // Handle focus loss
    function handleBlur() {
        const newState = navigation.deactivateNavigation();
        // Force reactive update
        navigationState = newState;
    }

    // Handle keyboard navigation
    function handleKeyDown(event: KeyboardEvent) {
        const newState = navigation.handleKeyDown(event);
        if (newState) {
            // Force reactive update
            navigationState = newState;
        }
    }
</script>

<div class="smart-sheet relative">
    <!-- Scroll container for large tables -->
    <div
        bind:this={tableContainer}
        class="overflow-auto max-h-96 max-w-full border border-tertiaryOnBg bg-tertiaryBg relative outline-none"
        tabindex="-1"
        on:blur={handleBlur}
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
                            selected={isCellSelected(rowIndex, colIndex)}
                            on:cellClick={handleCellClick}
                        />
                    </div>
                {/each}
            {/each}

            <!-- Overlaid pointer -->
            <CellPointer
                position={pointerPosition} 
            />
        </div>
    </div>

    <!-- Navigation overlay OUTSIDE scroll container -->
    <NavigationOverlay
        visible={!navigationMode}
        on:activate={handleNavigationActivate}
    />
</div>