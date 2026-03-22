<script lang="ts">
    import SmartSheet from '$lib/adapters/svelte/SmartSheet.svelte';
    import type { HeaderValue } from '$lib/core/types/types';
    import ApiControls from './ApiControls.svelte';

    type Theme = 'light' | 'dark' | 'tech' | 'glow' | 'neon';
    let theme: Theme = 'tech';

    const themes: Theme[] = ['light', 'dark', 'tech', 'glow', 'neon'];

    let sheet: SmartSheet;

    // 50 columns: Q1-Y5 quarters + months Jan-Dec repeated across 5 years
    const columnHeaders: HeaderValue[] = [
        'Jan-21','Feb-21','Mar-21','Apr-21','May-21','Jun-21','Jul-21','Aug-21','Sep-21','Oct-21',
        'Nov-21','Dec-21','Jan-22','Feb-22','Mar-22','Apr-22','May-22','Jun-22','Jul-22','Aug-22',
        'Sep-22','Oct-22','Nov-22','Dec-22','Jan-23','Feb-23','Mar-23','Apr-23','May-23','Jun-23',
        'Jul-23','Aug-23','Sep-23','Oct-23','Nov-23','Dec-23','Jan-24','Feb-24','Mar-24','Apr-24',
        'May-24','Jun-24','Jul-24','Aug-24','Sep-24','Oct-24','Nov-24','Dec-24','Jan-25','Feb-25',
    ];

    // 40 rows: 8 regions × 5 product lines
    const rowHeaders: HeaderValue[] = [
        'North-Elec','North-App','North-Cloth','North-Food','North-Tech',
        'South-Elec','South-App','South-Cloth','South-Food','South-Tech',
        'East-Elec', 'East-App', 'East-Cloth', 'East-Food', 'East-Tech',
        'West-Elec', 'West-App', 'West-Cloth', 'West-Food', 'West-Tech',
        'Online-Elec','Online-App','Online-Cloth','Online-Food','Online-Tech',
        'Retail-Elec','Retail-App','Retail-Cloth','Retail-Food','Retail-Tech',
        'WS-Elec',   'WS-App',   'WS-Cloth',   'WS-Food',   'WS-Tech',
        'Exp-Elec',  'Exp-App',  'Exp-Cloth',  'Exp-Food',  'Exp-Tech',
    ];

    // Generate 40×50 grid with seeded pseudo-random values
    function makeGrid(rows: number, cols: number): number[][] {
        const grid: number[][] = [];
        for (let r = 0; r < rows; r++) {
            const row: number[] = [];
            for (let c = 0; c < cols; c++) {
                // simple deterministic formula to get believable sales numbers
                const base = 5000 + (r * 317 + c * 211) % 30000;
                const trend = Math.floor(c * 12.5);
                row.push(base + trend);
            }
            grid.push(row);
        }
        return grid;
    }

    const gridData = makeGrid(40, 50);
</script>

<div class="playground">
    <div class="playground__header">
        <div class="playground__title">
            <h1>Playground</h1>
            <p>Live demo — interact with the grid, switch themes, and try the API controls below.</p>
        </div>
        <div class="playground__controls">
            <div class="control-group">
                <span class="control-label">Theme</span>
                <div class="button-row">
                    {#each themes as t}
                        <button
                            class="pill"
                            class:pill--active={theme === t}
                            on:click={() => (theme = t)}
                        >{t}</button>
                    {/each}
                </div>
            </div>
        </div>
    </div>

    <div class="playground__hints">
        <span class="hint">Click and drag to select</span>
        <span class="hint">Dclick/Enter/Type to edit</span>
        <span class="hint">Click and drag header to select row/col</span>
        <span class="hint">Arrow keys to navigate</span>
        <span class="hint">Ctrl+Arrow keys to jump</span>
        <span class="hint">Shift+Arrow keys to select</span>
        <span class="hint">Supr to delete</span>
        <span class="hint">Ctrl+Z/Ctrl+Y to undo/redo</span>
        <span class="hint">Ctrl+scroll to zoom</span>
    </div>

    <!-- API Controls -->
    <ApiControls {sheet} />

    <div class="playground__sheet">
        <SmartSheet
            bind:this={sheet}
            {gridData}
            {columnHeaders}
            {rowHeaders}
            rowsTitle="Region"
            {theme}
            fontSize="0.85rem"
            minCellWidth="5.5rem"
        />
    </div>
</div>

<style>
    .playground {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .playground__header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 1.5rem;
        flex-wrap: wrap;
    }

    .playground__title h1 {
        margin: 0 0 0.3rem;
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--layout-text);
    }

    .playground__title p {
        margin: 0;
        font-size: 0.83rem;
        color: var(--layout-text-muted);
    }

    .playground__controls {
        display: flex;
        gap: 1.5rem;
        flex-wrap: wrap;
        align-items: flex-start;
    }

    .control-group {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .control-label {
        font-size: 0.72rem;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--layout-text-muted);
    }

    .button-row {
        display: flex;
        gap: 0.3rem;
        flex-wrap: wrap;
    }

    .pill {
        padding: 0.25rem 0.7rem;
        border-radius: 99px;
        border: 1px solid var(--layout-border);
        background: transparent;
        color: var(--layout-text-muted);
        font-size: 0.78rem;
        cursor: pointer;
        transition: color 0.15s, background 0.15s, border-color 0.15s;
        font-family: inherit;
    }
    .pill:hover {
        color: var(--layout-text);
        border-color: var(--layout-accent);
    }
    .pill--active {
        background: var(--layout-accent-glow);
        border-color: var(--layout-accent);
        color: var(--layout-accent);
        font-weight: 500;
    }

    .playground__hints {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .hint {
        font-size: 0.73rem;
        color: var(--layout-text-muted);
        background: var(--layout-surface);
        border: 1px solid var(--layout-border);
        border-radius: 4px;
        padding: 0.2rem 0.6rem;
    }

    .playground__sheet {
        flex: 1;
        height: 500px;
        padding-bottom: 1.5rem;
    }

</style>
