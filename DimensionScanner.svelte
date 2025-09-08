<script lang="ts">
  	import { onMount, createEventDispatcher } from 'svelte';
  	import type {
		CellValue,
		HeaderValue,
  	} from './types';
  	import Cell from './Cell.svelte';
  	import Header from './Header.svelte';
    import { tick } from 'svelte';


  	export let gridData: CellValue[][];
  	export let columnHeaders: HeaderValue[];
  	export let rowHeaders: HeaderValue[];
  	export let rowsTitle: string = '';
    export let fontSize: string;

    let rowIndex: number = 0;

  	const dispatch = createEventDispatcher();

  	// Scan dimensions on mount
  	onMount(() => {

        let rowHeights: number[] = [];
        let colWidths: number[] = [];

        function compareAndUpdateDimensions(index: number) {
            // Scan and add row heights. Since we are only measuring the first row, we can use a fixed index.
            const rowHeaderElement = document.querySelector(`[data-header-type="row"][data-header-index="0"]`);
            if (rowHeaderElement instanceof HTMLElement) {
                rowHeights[index+1] = Math.max(rowHeights[index+1] || 0, rowHeaderElement.offsetHeight);
                const newWidth = rowHeaderElement.offsetWidth;
                if (newWidth > (colWidths[0] || 0)) {
                    colWidths[0] = newWidth;
                }
            }
            // Scan and compare/update column widths. Scan the headers
            columnHeaders.forEach((header, colIndex) => {
                const headerElement = document.querySelector(`[data-header-type="col"][data-header-index="${colIndex}"]`);
                if (headerElement instanceof HTMLElement) {
                    colWidths[colIndex+1] = Math.max(colWidths[colIndex+1] || 0, headerElement.offsetWidth);
                }
            });
        }

        // First add the rows title dimensions (corner header)
        const cornerHeaderElement = document.querySelector('[data-header-type="corner"][data-header-index="0"]');
        if (cornerHeaderElement instanceof HTMLElement) {
            rowHeights[0] = cornerHeaderElement.offsetHeight;
            colWidths[0] = cornerHeaderElement.offsetWidth;
        }
        // Measure the column headers dimensions
        columnHeaders.forEach((header, colIndex) => {
            const headerElement = document.querySelector(`[data-header-type="col"][data-header-index="${colIndex}"]`);
            if (headerElement instanceof HTMLElement) {
                colWidths[colIndex+1] = headerElement.offsetWidth;
                rowHeights[0] = headerElement.offsetHeight;
            }
        });

        async function scanRowsSequentially() {
            for (let i = 0; i < gridData.length; i++) {
                compareAndUpdateDimensions(rowIndex);
                await tick(); // Wait for DOM to update
                if (rowIndex >= gridData.length - 1) {
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
<div class="h-full w-full relative">
	<div class="relative overflow-auto max-h-full max-w-full border outline-none overscroll-contain"
		tabindex="-1"
        style="font-size: {fontSize};"
		>
        <div
            class="parent-grid"
            style="
                display: grid;
                grid-template-columns: auto repeat({(gridData[0]?.length) || 1}, auto);
                grid-template-rows: auto repeat(2, auto);
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
                <Header
                    position={{ headerType: 'corner', index: 0 }}
                    value={rowsTitle}
                />
            </div>

            <!-- Columns Headers -->
            <div
                class="columns-headers sticky top-0 z-[6] bg-tertiaryBg"
                style="
                    display: grid;
                    grid-column: 2 / -1;
                    grid-row: 1;
                    grid-template-columns: subgrid;
                "
            >
                {#each columnHeaders as header, colIndex}
                    <Header
                        position={{ headerType: 'col', index: colIndex }}
                        value={header}
                    />
                {/each}
            </div>

            <!-- Rows Headers -->
            <div
                class="rows-headers text-center sticky left-0 z-[6] bg-tertiaryBg"
                style="
                    display: grid;
                    grid-column: 1;
                    grid-row: 2;
                    grid-template-rows: subgrid;
                "
            >
                <Header
                    position={{ headerType: 'row', index: 0 }}
                    value={rowHeaders?.[rowIndex]}
                />
            </div>

            <!-- Cells -->
            <div
                class="main-grid text-tertiaryOnBg"
                style="
                    display: grid;
                    grid-column: 2 / -1;
                    grid-row: 2;
                    grid-template-columns: subgrid;
                    grid-template-rows: subgrid;
                    gap: 0;
                "
            >
                {#each gridData[rowIndex] as cellValue, colIndex}
                    <Cell
                        position={{ row: 0, col: colIndex }}
                        value={cellValue}
                    />
                {/each}
            </div>

		</div>
	</div>
</div>
