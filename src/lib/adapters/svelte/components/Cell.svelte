<script lang="ts">
    import type {
        GridPosition,
        CellValue,
        NumberDisplayOptions,
    } from '../../../core/types/types.ts';

    // Props from parent
    export let position: GridPosition;
    export let value: CellValue;
    export let styling: string = '';        // inline style string for dynamic bg/color from ColorHandler
    export let cssClass: string = '';       // extra CSS class(es) injected by the consumer (replaces tailwindStyling)
    export let instanceId: string;
    export let textOverflowMode: 'full' | 'truncated' = 'truncated';
    export let numberDisplayOptions: NumberDisplayOptions = { decimalPlaces: 3 };
    /*
        'full' mode: text wraps and shows all content, expanding cell height as needed
        'truncated' mode: text is truncated with ellipsis if it overflows cell width, single line only
        full mode is useful for scanning phase, when we want to measure the apropiate heights and widths
        for rows and columns, then switch to truncated for the actual display, when we have the
        initial dimensions set.
    */

    // Helper function to format numbers according to the configuration
    function formatNumber(value: CellValue, options: NumberDisplayOptions): string {
        // If value is not a number, return as string
        if (typeof value !== 'number') {
            return value?.toString() ?? '';
        }

        const { decimalPlaces = 2, thousandsSeparator = false, locale = 'en-US' } = options;

        // Check if it's an integer (no decimal part)
        const isInteger = Number.isInteger(value);

        // Use toLocaleString if we need thousands separator or non-default locale
        if (thousandsSeparator || locale !== 'en-US') {
            return value.toLocaleString(locale, {
                minimumFractionDigits: 0, // Never force decimal places
                maximumFractionDigits: decimalPlaces
            });
        }

        // For integers, don't force decimal places
        if (isInteger) {
            return value.toString();
        }

        // For decimals, format and remove trailing zeros
        const formatted = value.toFixed(decimalPlaces);
        return parseFloat(formatted).toString();
    }

</script>

<div
    style="grid-row: {position.row + 1}; grid-column: {position.col + 1};"
    class="ss-cell"
    data-row={position.row}
    data-col={position.col}
    data-instance={instanceId}
>
    <div id="cell-background-{instanceId}"
        class="ss-layer {cssClass}"
        style={styling}
    ></div>
    <span
        class="ss-cell-text"
        class:ss-cell-text--truncated={textOverflowMode === 'truncated'}
        class:ss-cell-text--full={textOverflowMode === 'full'}
    >
        {formatNumber(value, numberDisplayOptions)}
    </span>
</div>

<style>
    .ss-cell {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        position: relative;
        padding: 0.25rem 0.5rem;
        user-select: none;
        transition: background-color 200ms;
        background-color: var(--ss-cell-bg, #ffffff);
        color: var(--ss-cell-text, #111827);
        font-family: var(--ss-font-family, ui-sans-serif, system-ui, sans-serif);
    }

    /* .ss-layer positioning is defined globally in base.css; z-index is added here */
    .ss-cell :global(.ss-layer) {
        z-index: 1;
    }

    .ss-cell-text {
        z-index: 5;
    }

    .ss-cell-text--truncated {
        height: 100%;
        width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .ss-cell-text--full {
        white-space: pre-line;
    }
</style>
