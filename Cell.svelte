<script lang="ts">
    import type {
        GridPosition,
        CellValue,
    } from './types';

    // Props from parent
    export let position: GridPosition;
    export let value: CellValue;
    export let styling: string = '';
    export let tailwindStyling: string = '';
    export let instanceId: string;
    export let textOverflowMode: 'full' | 'truncated' = 'truncated';
    /*
        'full' mode: text wraps and shows all content, expanding cell height as needed
        'truncated' mode: text is truncated with ellipsis if it overflows cell width, single line only
        full mode is useful for scanning phase, when we want to measure the apropiate heights and widths
        for rows and columns, then switch to truncated for the actual display, when we have the
        initial dimensions set.
    */

</script>

<div
    style=" grid-row: {position.row + 1}; grid-column: {position.col + 1};"
    class="px-2 py-1 cursor-pointer select-none transition-colors
        duration-200 w-full h-full flex items-center relative"
    data-row={position.row}
    data-col={position.col}
    data-instance={instanceId}
>
    <div id="cell-background-{instanceId}"
        class="absolute inset-0 w-full h-full z-[1] {tailwindStyling}"
        style={styling}
    />
    <span class="z-[5]"
        class:h-full={textOverflowMode === 'truncated'}
        class:w-full={textOverflowMode === 'truncated'}
        class:text-ellipsis={textOverflowMode === 'truncated'}
        class:overflow-hidden={textOverflowMode === 'truncated'}
        class:whitespace-pre-line={textOverflowMode === 'full'}
    >
        {value ?? ''}
    </span>
</div>
