<script lang="ts">
    import type SmartSheet from '$lib/adapters/svelte/SmartSheet.svelte';
	import type { GridPosition, CellValue } from '$lib/core/types/types.ts';

    export let sheet: SmartSheet;

    type ApiTab = 'imputation' | 'styling' | 'navigation' | 'selection' | 'export';
    let activeTab: ApiTab = 'imputation';

    // Imputation
	let imputeType: 'number' | 'string' = 'number';
    let imputeFrom: string | number = '';
    let imputeTo: string | number = '';
	let operationType: 'double' | 'halve' = 'double';
	let operationTarget: 'row' | 'col' = 'row';
	let operationIndex = '';

    // Styling
    let styleCell_row  = '';
    let styleCell_col  = '';
    let styleCell_bg   = '#3b82f6';
    let styleHdr_type: 'row' | 'col' = 'row';
    let styleHdr_index = '';
    let styleHdr_color = '#3b82f6';
	// Number range styling
	let styleRange_min: number | '' = '';
	let styleRange_max: number | '' = '';
	let styleRange_bg = '#3b82f6';
	// Header + cells background
	let styleHdrAndCells_type: 'row' | 'col' = 'row';
	let styleHdrAndCells_index = '';
	let styleHdrAndCells_headerBg = '#3b82f6';
	let styleHdrAndCells_cellBg = '#bfdbfe';

    // Navigation
	let navFirst_min: number | '' = '';
	let navFirst_max: number | '' = '';
	let navNext_min: number | '' = '';
	let navNext_max: number | '' = '';
	let navPos_row = '';
	let navPos_col = '';

    // Selection
    let selPos_input   = '';
    let selHdr_type: 'row' | 'col' = 'row';
    let selHdr_indices = '';
	// Select Range
	let selRange_min: number | '' = '';
	let selRange_max: number | '' = '';
	// Export Selection
	let selExport_format: 'index' | 'header' = 'index';

	// Export
	let exportWithValues = false;

</script>

<div class="api">

    <!-- Header: label + tabs -->
    <div class="api__header">
        <span class="api__label">API Controls	--	examples</span>
        <div class="api__tabs">
            {#each (['imputation', 'styling', 'navigation', 'selection', 'export'] as ApiTab[]) as tab}
                <button
                    class="tab"
                    class:tab--active={activeTab === tab}
                    on:click={() => (activeTab = tab)}
                >{tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
            {/each}
        </div>
    </div>

    <!-- Scrollable card area -->
    <div class="api__content">

        {#if activeTab === 'imputation'}
            <div class="cards">

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Impute Values</span>
                        <span class="card__desc">Replace all occurrences of a value across the grid.</span>
                    </div>
                    <div class="card__controls">
						<label class="ctrl-label">Type<select class="ctrl-select" bind:value={imputeType}><option value="number">Number</option><option value="string">String</option></select></label>
						{#if imputeType === 'number'}
							<label class="ctrl-label">From<input class="ctrl-input" type="number" bind:value={imputeFrom} placeholder="e.g. 0" /></label>
							<label class="ctrl-label">To<input class="ctrl-input" type="number" bind:value={imputeTo} placeholder="e.g. 42" /></label>
						{:else}
							<label class="ctrl-label">From<input class="ctrl-input" type="text" bind:value={imputeFrom} placeholder="e.g. foo" /></label>
							<label class="ctrl-label">To<input class="ctrl-input" type="text" bind:value={imputeTo} placeholder="e.g. bar" /></label>
						{/if}
                    </div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.applyImputations(
								(cells) => {
									const out: [GridPosition, CellValue][] = [];
									for (const cell of cells.values()) {
										if (cell.value === imputeFrom) {
											out.push([cell.position, imputeTo]);
										}
									}
									return out;
								}
							)
						}
					}>
						Apply
					</button>
                </div>

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Double or halve</span>
                        <span class="card__desc">Double or halve the values in all numeric cells of a row or column.</span>
                    </div>
                    <div class="card__controls">
						<label class="ctrl-label">Type<select class="ctrl-select" bind:value={operationTarget}><option value="row">Row</option><option value="col">Col</option></select></label>
						<label class="ctrl-label">Index<input class="ctrl-input ctrl-input--sm" type="number" min="0" bind:value={operationIndex} placeholder="0" /></label>
						<label class="ctrl-label">Operation<select class="ctrl-select" bind:value={operationType}><option value="double">Double</option><option value="halve">Halve</option></select></label>
					</div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.applyImputations(
								(cells) => {
									const out: [GridPosition, CellValue][] = [];
									for (const cell of cells.values()) {
										if (operationTarget === 'row' && cell.position.row === Number(operationIndex) && typeof cell.value === 'number') {
											out.push([cell.position, operationType === 'double' ? cell.value * 2 : cell.value / 2]);
										} else if (operationTarget === 'col' && cell.position.col === Number(operationIndex) && typeof cell.value === 'number') {
											out.push([cell.position, operationType === 'double' ? cell.value * 2 : cell.value / 2]);
										}
									}
									return out;
								}
							)
						}
					}>
						Apply
					</button>
                </div>

            </div>

        {:else if activeTab === 'styling'}
            <div class="cards">

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Colorize Cell</span>
                        <span class="card__desc">Set the background color of a specific cell.</span>
                    </div>
                    <div class="card__controls">
                        <label class="ctrl-label">Row<input class="ctrl-input ctrl-input--sm" type="number" min="0" bind:value={styleCell_row} placeholder="0" /></label>
                        <label class="ctrl-label">Col<input class="ctrl-input ctrl-input--sm" type="number" min="0" bind:value={styleCell_col} placeholder="0" /></label>
                        <label class="ctrl-label">Color<input class="ctrl-input ctrl-input--color" type="color" bind:value={styleCell_bg} /></label>
                    </div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.colorizeCell({ row: Number(styleCell_row), col: Number(styleCell_col) }, styleCell_bg );
						}
					}>
						Apply
					</button>
                </div>

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Colorize Header</span>
                        <span class="card__desc">Set the background color of a row or column header.</span>
                    </div>
                    <div class="card__controls">
                        <label class="ctrl-label">Type<select class="ctrl-select" bind:value={styleHdr_type}><option value="row">Row</option><option value="col">Col</option></select></label>
                        <label class="ctrl-label">Index<input class="ctrl-input ctrl-input--sm" type="number" min="0" bind:value={styleHdr_index} placeholder="0" /></label>
                        <label class="ctrl-label">Color<input class="ctrl-input ctrl-input--color" type="color" bind:value={styleHdr_color} /></label>
                    </div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.colorizeHeader(styleHdr_type, Number(styleHdr_index), styleHdr_color);
						}
					}>
						Apply
					</button>
                </div>

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Style Header and Cells</span>
                        <span class="card__desc">Apply colors to a full row or column and its header.</span>
                    </div>
                    <div class="card__controls">
						<label class="ctrl-label">Type<select class="ctrl-select" bind:value={styleHdrAndCells_type}><option value="row">Row</option><option value="col">Col</option></select></label>
						<label class="ctrl-label">Index<input class="ctrl-input ctrl-input--sm" type="number" min="0" bind:value={styleHdrAndCells_index} placeholder="0" /></label>
						<label class="ctrl-label">Header Color<input class="ctrl-input ctrl-input--color" type="color" bind:value={styleHdrAndCells_headerBg} /></label>
						<label class="ctrl-label">Cell Color<input class="ctrl-input ctrl-input--color" type="color" bind:value={styleHdrAndCells_cellBg} /></label>
                    </div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							if (styleHdrAndCells_type === 'row') {
								console.log('styleRowHeaderAndCells', Number(styleHdrAndCells_index), styleHdrAndCells_headerBg, styleHdrAndCells_cellBg);
								sheet.styleRowHeaderAndCells(
									Number(styleHdrAndCells_index),
									{ 'background-color': styleHdrAndCells_headerBg },
									{ 'background-color': styleHdrAndCells_cellBg }
								);
							} else {
								sheet.styleColHeaderAndCells(
									Number(styleHdrAndCells_index),
									{ 'background-color': styleHdrAndCells_headerBg },
									{ 'background-color': styleHdrAndCells_cellBg }
								);
							}
						}
					}>
						Apply
					</button>
                </div>

				<div class="card">
					<div class="card__head">
						<span class="card__title">Style Range</span>
						<span class="card__desc">Apply a background color to all cells with values in a specified numeric range.</span>
					</div>
					<div class="card__controls">
						<label class="ctrl-label">Min<input class="ctrl-input" type="number" bind:value={styleRange_min} placeholder="e.g. 0" /></label>
						<label class="ctrl-label">Max<input class="ctrl-input" type="number" bind:value={styleRange_max} placeholder="e.g. 100" /></label>
						<label class="ctrl-label">Color<input class="ctrl-input ctrl-input--color" type="color" bind:value={styleRange_bg} /></label>
					</div>
					<button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.applyBackgroundStyles(
								(cells) => {
									const out: [GridPosition, { 'background-color': string }][] = [];
									for (const cell of cells.values()) {
										if (typeof cell.value === 'number' && cell.value >= Number(styleRange_min) && cell.value <= Number(styleRange_max)) {
											out.push([cell.position, { 'background-color': styleRange_bg }]);
										}
									}
									return out;
								},
							);
						}
					}>
						Apply
					</button>
				</div>

                <div class="card card--danger">
                    <div class="card__head">
                        <span class="card__title">Reset All Styles</span>
                        <span class="card__desc">Remove all custom styles and return to default appearance.</span>
                    </div>
                    <div class="card__controls"></div>
                    <button class="card__apply card__apply--danger" on:click={
						() => {
							if (!sheet) return;
							sheet.resetAllStyles();
						}
					}>
						Apply
					</button>
                </div>

            </div>

        {:else if activeTab === 'navigation'}
            <div class="cards">

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Navigate to First</span>
                        <span class="card__desc">Move the pointer to the first cell that matches the specified criteria.</span>
                    </div>
                    <div class="card__controls">
						<label class="ctrl-label">Min<input class="ctrl-input" type="number" bind:value={navFirst_min} placeholder="e.g. 0" /></label>
						<label class="ctrl-label">Max<input class="ctrl-input" type="number" bind:value={navFirst_max} placeholder="e.g. 100" /></label>
					</div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.navigateToFirst(
								(cell) => {
									if (typeof cell.value === 'number' && cell.value >= Number(navFirst_min) && cell.value <= Number(navFirst_max)) {
										return true;
									}
									return false;
								},
							);
						}
					}>
						Apply
					</button>
                </div>

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Navigate to Next</span>
                        <span class="card__desc">Move the pointer to the next cell that matches the specified criteria.</span>
                    </div>
                    <div class="card__controls">
						<label class="ctrl-label">Min<input class="ctrl-input" type="number" bind:value={navNext_min} placeholder="e.g. 0" /></label>
						<label class="ctrl-label">Max<input class="ctrl-input" type="number" bind:value={navNext_max} placeholder="e.g. 100" /></label>
					</div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.navigateToNext(
								(cell) => {
									if (typeof cell.value === 'number' && cell.value >= Number(navNext_min) && cell.value <= Number(navNext_max)) {
										return true;
									}
									return false;
								},
							);
						}
					}>
						Apply
					</button>
                </div>

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Navigate to Position</span>
                        <span class="card__desc">Move the pointer to a specific row and column.</span>
                    </div>
                    <div class="card__controls">
                        <label class="ctrl-label">Row<input class="ctrl-input ctrl-input--sm" type="number" min="0" bind:value={navPos_row} placeholder="0" /></label>
                        <label class="ctrl-label">Col<input class="ctrl-input ctrl-input--sm" type="number" min="0" bind:value={navPos_col} placeholder="0" /></label>
                    </div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.navigateToPosition({ row: Number(navPos_row), col: Number(navPos_col) });
						}
					}>
						Apply
					</button>
                </div>

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Get Pointer Position</span>
                        <span class="card__desc">Read and open a dialog with the current pointer coordinates.</span>
                    </div>
                    <div class="card__controls"></div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							const pos = sheet.getPointerPosition();
							alert(`Current pointer position:\nRow: ${pos.row}\nCol: ${pos.col}`);
						}
					}>
						Apply
					</button>
                </div>

            </div>

        {:else if activeTab === 'selection'}
            <div class="cards">

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Select Positions</span>
                        <span class="card__desc">Programmatically select cells at specified positions.</span>
                    </div>
                    <div class="card__controls">
                        <label class="ctrl-label">Positions<input class="ctrl-input" bind:value={selPos_input} placeholder="e.g. 0,0 1,2 3,4" /></label>
                    </div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							const positions = selPos_input.split(' ').map(posStr => {
								const [row, col] = posStr.split(',').map(Number);
								return { row, col };
							});
							sheet.selectPositions(positions);
						}
					}>
						Apply
					</button>
                </div>

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Select Headers</span>
                        <span class="card__desc">Select one or more row or column headers.</span>
                    </div>
                    <div class="card__controls">
                        <label class="ctrl-label">Type<select class="ctrl-select" bind:value={selHdr_type}><option value="row">Row</option><option value="col">Col</option></select></label>
                        <label class="ctrl-label">Indices<input class="ctrl-input" bind:value={selHdr_indices} placeholder="e.g. 0 1 2" /></label>
                    </div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							const indices = selHdr_indices.split(' ').map(Number);
							sheet.selectHeaders(selHdr_type, indices);
						}
					}>
						Apply
					</button>
                </div>

                <div class="card">
                    <div class="card__head">
                        <span class="card__title">Select Range</span>
                        <span class="card__desc">Select cells within a specified numeric range.</span>
                    </div>
                    <div class="card__controls">
                        <label class="ctrl-label">Min<input class="ctrl-input" type="number" bind:value={selRange_min} placeholder="e.g. 0" /></label>
                        <label class="ctrl-label">Max<input class="ctrl-input" type="number" bind:value={selRange_max} placeholder="e.g. 100" /></label>
                    </div>
                    <button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							sheet.applySelections(
								(cells) => {
									const out: GridPosition[] = [];
									for (const cell of cells.values()) {
										if (typeof cell.value === 'number' && cell.value >= Number(selRange_min) && cell.value <= Number(selRange_max)) {
											out.push(cell.position);
										}
									}
									return out;
								},
							);
						}
					}>
						Apply
					</button>
                </div>

				<div class="card">
					<div class="card__head">
						<span class="card__title">Get Selected Cells</span>
						<span class="card__desc">Read and open a dialog with the currently selected cells.</span>
					</div>
					<div class="card__controls">
						<label class="ctrl-label">Format<select class="ctrl-select" bind:value={selExport_format}><option value="index">By Index</option><option value="header">By Header</option></select></label>
					</div>
					<button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							if (selExport_format === 'index') {
								const selectedCells: Set<string> = sheet.getSelectedCells();
								let message = 'Selected Cells (by index):\n\n';
								for (const cellId of selectedCells) {
									message += `${cellId}\n`;
								}
								alert(message);
							} else {
								const selectedCells = sheet.exportSelectedCells();
								let message = 'Selected Cells:\n\n';
								for (const [header, values] of Object.entries(selectedCells)) {
									message += `${header}:\n  ${values.join('\n  ')}\n\n`;
								}
								alert(message);
							}
						}
					}>
						Apply
					</button>
				</div>

                <div class="card card--danger">
                    <div class="card__head">
                        <span class="card__title">Clear Selection</span>
                        <span class="card__desc">Deselect all currently selected cells and headers.</span>
                    </div>
                    <div class="card__controls"></div>
                    <button class="card__apply card__apply--danger" on:click={() => { console.log('clearSelection'); sheet?.clearSelection(); }}>Apply</button>
                </div>

            </div>
		{:else if activeTab === 'export'}
			<div class="cards">

				<div class="card">
					<div class="card__head">
						<span class="card__title">Export Changed Cells</span>
						<span class="card__desc">Export all cells that have been changed since construction.</span>
					</div>
					<div class="card__controls">
						<label class="ctrl-label ctrl-label--row">Include Values<input class="ctrl-checkbox" type="checkbox" bind:checked={exportWithValues} /></label>
					</div>
					<button class="card__apply" on:click={
						() => {
							if (!sheet) return;
							if (!exportWithValues) {
								const changedCells = sheet.extractChangedCells();
								let message = 'Changed Cells:\n\n';
								for (const [header, values] of Object.entries(changedCells)) {
									message += `${header}:\n  ${values.join('\n  ')}\n\n`;
								}
								alert(message);
							} else {
								const changedCellsWithValues = sheet.extractChangedCellsWithValues();
								let message = 'Changed Cells with Values:\n\n';
								for (const [primaryHeader, cells] of Object.entries(changedCellsWithValues)) {
									message += `${primaryHeader}:\n`;
									for (const [secondaryHeader, value] of Object.entries(cells)) {
										message += `  ${secondaryHeader}: ${value}\n`;
									}
									message += '\n';
								}
								alert(message);
							}
						}
					}>
						Apply
					</button>
				</div>

			</div>
        {/if}

    </div>
</div>

<style>
    .api {
        display: flex;
        flex-direction: column;
        height: 320px;
        background: var(--layout-surface);
        border: 1px solid var(--layout-border);
        border-radius: 8px;
        overflow: hidden;
    }

    /* ── Header ── */
    .api__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.55rem 1rem 0;
        flex-shrink: 0;
    }

    .api__label {
        font-size: 0.7rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--layout-text-muted);
    }

    /* ── Tabs ── */
    .api__tabs {
        display: flex;
        border-bottom: 1px solid var(--layout-border);
        overflow-x: auto;
        scrollbar-width: none;
    }
    .api__tabs::-webkit-scrollbar { display: none; }

    .tab {
        padding: 0.35rem 0.85rem;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--layout-text-muted);
        font-size: 0.78rem;
        font-family: inherit;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
        margin-bottom: -1px;
        white-space: nowrap;
    }
    .tab:hover { color: var(--layout-text); }
    .tab--active {
        color: var(--layout-accent);
        border-bottom-color: var(--layout-accent);
        font-weight: 500;
    }

    /* ── Scrollable content ── */
    .api__content {
        overflow-y: auto;
        flex: 1;
        padding: 0.75rem 1rem;
    }

    /* ── Card grid ── */
    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
        gap: 0.65rem;
        align-content: start;
    }

    /* ── Card ── */
    .card {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        background: var(--layout-bg);
        border: 1px solid var(--layout-border);
        border-radius: 6px;
        padding: 0.7rem 0.8rem;
    }
    .card--danger {
        border-color: rgba(248, 113, 113, 0.25);
    }

    .card__head {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
    }
    .card__title {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--layout-text);
    }
    .card__desc {
        font-size: 0.68rem;
        color: var(--layout-text-muted);
        line-height: 1.4;
    }

    /* ── Controls inside a card ── */
    .card__controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.5rem;
        flex: 1;
    }

    .ctrl-label {
        display: flex;
        flex-direction: column;
        gap: 0.18rem;
        font-size: 0.65rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--layout-text-muted);
    }

    .ctrl-label--row {
        flex-direction: row;
        align-items: center;
        gap: 0.45rem;
    }

    .ctrl-checkbox {
        width: 0.95rem;
        height: 0.95rem;
        accent-color: var(--layout-accent);
        cursor: pointer;
        flex-shrink: 0;
    }

    .ctrl-input {
        padding: 0.28rem 0.45rem;
        background: var(--layout-surface);
        border: 1px solid var(--layout-border);
        border-radius: 4px;
        color: var(--layout-text);
        font-size: 0.76rem;
        font-family: inherit;
        width: 100%;
        min-width: 0;
        outline: none;
        transition: border-color 0.15s;
    }
    .ctrl-input:focus { border-color: var(--layout-accent); }
    .ctrl-input--sm { width: 4rem; }
    .ctrl-input--color {
        width: 2.4rem;
        height: 1.75rem;
        padding: 0.1rem 0.12rem;
        cursor: pointer;
        border-radius: 3px;
    }

    .ctrl-select {
        padding: 0.28rem 0.4rem;
        background: var(--layout-surface);
        border: 1px solid var(--layout-border);
        border-radius: 4px;
        color: var(--layout-text);
        font-size: 0.76rem;
        font-family: inherit;
        cursor: pointer;
        outline: none;
    }
    .ctrl-select:focus { border-color: var(--layout-accent); }

    /* ── Apply button ── */
    .card__apply {
        align-self: flex-end;
        padding: 0.32rem 1rem;
        border-radius: 5px;
        border: 1px solid var(--layout-accent);
        background: var(--layout-accent-glow);
        color: var(--layout-accent);
        font-size: 0.74rem;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
        letter-spacing: 0.03em;
    }
    .card__apply:hover {
        background: var(--layout-accent);
        color: var(--layout-bg);
    }
    .card__apply--danger {
        border-color: rgba(248, 113, 113, 0.45);
        background: rgba(248, 113, 113, 0.07);
        color: #f87171;
    }
    .card__apply--danger:hover {
        background: #f87171;
        color: #1a0000;
    }

    /* ── Mobile ── */
    @media (max-width: 640px) {
        .api { height: auto; }
        .api__header { flex-direction: column; align-items: flex-start; gap: 0.4rem; }
        .api__tabs { width: 100%; }
        .api__content { overflow-y: visible; }
        .cards { grid-template-columns: 1fr; }
    }
</style>
