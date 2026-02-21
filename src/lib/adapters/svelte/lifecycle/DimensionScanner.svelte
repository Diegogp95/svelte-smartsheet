<script lang="ts">
  	import { onMount, createEventDispatcher } from 'svelte';
  	import type {
        GridDimensions,
		CellValue,
		HeaderValue,
        CellComponent,
        HeaderComponent,
        NumberDisplayOptions,
  	} from '../../../core/types/types.ts';
  	import Cell from '../components/Cell.svelte';
  	import Header from '../components/Header.svelte';
    import { tick } from 'svelte';


    // Here we don't care about types, we just want to measure the dimensions of the rendered components.
    // We get the grid components as maps since they are processed and stored that way in the controller.
    // We care for for styling and rows/columns labels assigned by the controller.
  	// We convert them to 2D arrays for easier rendering in the grid, may be optimized later.
    export let gridDimensions: GridDimensions;
  	export let cellComponents: Map<string, CellComponent<any>>;
  	export let colHeaderComponents: Map<string, HeaderComponent<any>>;
  	export let rowHeaderComponents: Map<string, HeaderComponent<any>>;
    export let cornerHeaderComponent: HeaderComponent<any>;
    export let rowsTitle: string = '';
    export let fontSize: string;
    export let instanceId: string;
    export let minCellWidth: string = '5rem'; // Minimum cell width (supports px or rem)
    export let minCellHeight: string = '2.5rem'; // Minimum cell height (supports px or rem)
    export let numberDisplayOptions: NumberDisplayOptions = { decimalPlaces: 3 }; // Number formatting configuration

    function convertMapTo2DArray(cellMap: Map<string, CellComponent<any>>): CellComponent<any>[][] {
        const cells2D: CellComponent<any>[][] = [];

        for (const [key, cellComponent] of cellMap) {
            const [rowStr, colStr] = key.split('-');
            const row = parseInt(rowStr);
            const col = parseInt(colStr);

            // Initialize row if it doesn't exist
            if (!cells2D[row]) {
                cells2D[row] = [];
            }

            // Assign cell to its position
            cells2D[row][col] = cellComponent;
        }

        return cells2D;
    }

    let cells2D = convertMapTo2DArray(cellComponents);

    let columnHeaders: HeaderComponent<any>[] = Array.from(colHeaderComponents.values());
    let rowHeaders: HeaderComponent<any>[] = Array.from(rowHeaderComponents.values());

    let rowIndex: number = 0;

    // Parse dimension string and convert to pixels
    function parseToPixels(dimensionStr: string): number {
        const value = parseFloat(dimensionStr);

        if (dimensionStr.endsWith('rem')) {
            // Convert rem to pixels
            return value * parseFloat(getComputedStyle(document.documentElement).fontSize);
        } else if (dimensionStr.endsWith('px')) {
            // Already in pixels
            return value;
        } else {
            // Assume pixels if no unit specified
            return value;
        }
    }

  	const dispatch = createEventDispatcher();

  	// Scan dimensions on mount
  	onMount(() => {

        // Initialize with minimum dimensions
        let rowHeights: number[] = [];
        let colWidths: number[] = [];

        // Set minimum dimensions for all rows and columns
        const minWidthPx = parseToPixels(minCellWidth);
        const minHeightPx = parseToPixels(minCellHeight);

        // Initialize corner and headers with minimums
        rowHeights[0] = minHeightPx;  // Corner header height
        colWidths[0] = minWidthPx;    // Corner header width

        // Initialize all column widths with minimum
        for (let i = 1; i <= gridDimensions.maxCol + 1; i++) {
            colWidths[i] = minWidthPx;
        }

        // Initialize all row heights with minimum
        for (let i = 1; i <= gridDimensions.maxRow + 1; i++) {
            rowHeights[i] = minHeightPx;
        }

        function compareAndUpdateDimensions(index: number) {
            // Scan and add row heights. Since we are only measuring the first row, we can use a fixed index.
            const rowHeaderElement = document.querySelector(`[data-header-type="row"][data-header-index="0"][data-instance="${instanceId}"]`);
            if (rowHeaderElement instanceof HTMLElement) {
                rowHeights[index+1] = Math.max(rowHeights[index+1] || minHeightPx, rowHeaderElement.offsetHeight);
                const newWidth = rowHeaderElement.offsetWidth + 4; // Add 4px extra width
                if (newWidth > (colWidths[0] || minWidthPx)) {
                    colWidths[0] = newWidth;
                }
            }
            // Scan and compare/update column widths. Scan the headers
            columnHeaders.forEach((header, colIndex) => {
                const headerElement = document.querySelector(`[data-header-type="col"][data-header-index="${colIndex}"][data-instance="${instanceId}"]`);
                if (headerElement instanceof HTMLElement) {
                    colWidths[colIndex+1] = Math.max(colWidths[colIndex+1] || minWidthPx, headerElement.offsetWidth + 4); // Add 4px extra width
                }
            });
        }

        // First measure the corner header dimensions (using minimums as base)
        const cornerHeaderElement = document.querySelector(`[data-header-type="corner"][data-header-index="0"][data-instance="${instanceId}"]`);
        if (cornerHeaderElement instanceof HTMLElement) {
            rowHeights[0] = Math.max(rowHeights[0], cornerHeaderElement.offsetHeight);
            colWidths[0] = Math.max(colWidths[0], cornerHeaderElement.offsetWidth + 4); // Add 4px extra width
        }
        // Measure the column headers dimensions (using minimums as base)
        columnHeaders.forEach((header, colIndex) => {
            const headerElement = document.querySelector(`[data-header-type="col"][data-header-index="${colIndex}"][data-instance="${instanceId}"]`);
            if (headerElement instanceof HTMLElement) {
                colWidths[colIndex+1] = Math.max(colWidths[colIndex+1], headerElement.offsetWidth + 4); // Add 4px extra width
                rowHeights[0] = Math.max(rowHeights[0], headerElement.offsetHeight);
            }
        });

        async function scanRowsSequentially() {
            for (let i = 0; i < gridDimensions.maxRow + 1; i++) {
                // First ensure DOM is updated with current rowIndex
                await tick(); // Wait for DOM to update
                compareAndUpdateDimensions(rowIndex); // Measure the CURRENT row
                if (rowIndex >= gridDimensions.maxRow) {
                    break;
                }
                rowIndex++;
            }
            // Dispatch dimensions info when done scanning
            dispatch('done', { rowHeights, colWidths });
        }
        scanRowsSequentially();
  	});
</script>

<!-- Renders an invisible grid for scanning the dimensions -->
<div class="ss-scanner">
	<div class="ss-scanner__scroll"
		tabindex="-1"
        style="font-size: {fontSize};"
		>
        <div
            class="parent-grid"
            style="
                display: grid;
                grid-template-columns: auto repeat({gridDimensions.maxCol + 1}, auto);
                grid-template-rows: auto repeat(2, auto);
                gap: 0;
            "
        >
            <!-- Top-Left Corner -->
            <div
                class="ss-scanner__corner"
                style="
                    display: grid;
                    grid-column: 1;
                    grid-row: 1;
                    grid-template-columns: subgrid;
                "
            >
                <Header
                    position={{ headerType: 'corner', index: 0 }}
                    value={rowsTitle}
                    styling={cornerHeaderComponent.styles.styling}
                    cssClass={cornerHeaderComponent.styles.tailwindStyling}
                    instanceId={instanceId}
                    textOverflowMode="full"
                />
            </div>

            <!-- Columns Headers -->
            <div
                class="ss-scanner__col-headers"
                style="
                    display: grid;
                    grid-column: 2 / -1;
                    grid-row: 1;
                    grid-template-columns: subgrid;
                "
            >
                {#each columnHeaders as header, colIndex}
                    <Header
                        position={header.position}
                        value={header.value}
                        styling={header.styles.styling}
                        cssClass={header.styles.tailwindStyling}
                        instanceId={instanceId}
                        textOverflowMode="full"
                    />
                {/each}
            </div>

            <!-- Rows Headers -->
            <div
                class="ss-scanner__row-headers"
                style="
                    display: grid;
                    grid-column: 1;
                    grid-row: 2;
                    grid-template-rows: subgrid;
                "
            >
                <Header
                    position={{ headerType: 'row', index: 0 }}
                    value={rowHeaders[rowIndex].value}
                    styling={rowHeaders[rowIndex].styles.styling}
                    cssClass={rowHeaders[rowIndex].styles.tailwindStyling}
                    instanceId={instanceId}
                    textOverflowMode="full"
                />
            </div>

            <!-- Cells -->
            <div
                class="ss-scanner__cells"
                style="
                    display: grid;
                    grid-column: 2 / -1;
                    grid-row: 2;
                    grid-template-columns: subgrid;
                    grid-template-rows: subgrid;
                    gap: 0;
                "
            >
                {#each cells2D[rowIndex] as cell, colIndex}
                    <Cell
                        position={{ row: 0, col: colIndex }}
                        value={cell.value}
                        styling={cell.styles.styling}
                        cssClass={cell.styles.tailwindStyling}
                        instanceId={instanceId}
                        textOverflowMode="full"
                        numberDisplayOptions={numberDisplayOptions}
                    />
                {/each}
            </div>

		</div>
	</div>
</div>

<style>
    .ss-scanner {
        height: 100%;
        width: 100%;
        position: relative;
    }

    .ss-scanner__scroll {
        position: relative;
        overflow: auto;
        max-height: 100%;
        max-width: 100%;
        border: 1px solid var(--ss-border-color, #d1d5db);
        outline: none;
        overscroll-behavior: contain;
    }

    .ss-scanner__corner {
        position: sticky;
        top: 0;
        left: 0;
        z-index: 10;
        background-color: var(--ss-header-bg, #f3f4f6);
    }

    .ss-scanner__col-headers {
        position: sticky;
        top: 0;
        z-index: 6;
        background-color: var(--ss-header-bg, #f3f4f6);
    }

    .ss-scanner__row-headers {
        text-align: center;
        position: sticky;
        left: 0;
        z-index: 6;
        background-color: var(--ss-header-bg, #f3f4f6);
    }

    .ss-scanner__cells {
        color: var(--ss-cell-text, #111827);
    }
</style>
