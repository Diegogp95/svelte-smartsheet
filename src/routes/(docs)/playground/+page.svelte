<script lang="ts">
    import SmartSheet from '$lib/adapters/svelte/SmartSheet.svelte';
    import type { HeaderValue } from '$lib/core/types/types';
    import ApiControls from './ApiControls.svelte';

    type Theme = 'light' | 'dark' | 'tech' | 'glow' | 'neon';
    let theme: Theme = 'tech';

    const themes: Theme[] = ['light', 'dark', 'tech', 'glow', 'neon'];

    let sheet: SmartSheet;

    const columnHeaders: HeaderValue[] = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    const rowHeaders: HeaderValue[] = [
        'North', 'South', 'East', 'West',
        'Online', 'Retail', 'Wholesale', 'Export',
    ];

    const gridData = [
        [12400, 11800, 14200, 15600, 17100, 16800, 18300, 17900, 16400, 15200, 13800, 19200],
        [9800,  10200, 11400, 12800, 13500, 14100, 13700, 14500, 12900, 11700, 10400, 15600],
        [7600,  8100,  9300,  10200, 11400, 10900, 12100, 11800, 10600, 9800,  8700,  13400],
        [6200,  6800,  7900,  8700,  9600,  9200,  10400, 10100, 9100,  8300,  7400,  11200],
        [22100, 23400, 25600, 27800, 30200, 29400, 32100, 31500, 28900, 26700, 24100, 38400],
        [18300, 17900, 19800, 21400, 23100, 22600, 24500, 23800, 21900, 20200, 18600, 29800],
        [14700, 15200, 16800, 18300, 19900, 19400, 21200, 20700, 19100, 17600, 15900, 24600],
        [8900,  9400,  10700, 11800, 13100, 12700, 14200, 13800, 12400, 11300, 10100, 16800],
    ];
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
