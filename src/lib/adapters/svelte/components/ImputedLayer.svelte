<script lang="ts">
	import type { GridPosition, HeaderPosition } from '../../../core/types/types.ts';

    export let position: GridPosition | HeaderPosition;
    // Explicit type parameter
    export let type: 'cell' | 'row-header' | 'col-header';

    // Calculate grid positioning based on type
    let gridRow: number;
    let gridCol: number;

    if (type === 'cell') {
        const cellPos = position as GridPosition;
        gridRow = cellPos.row + 1;
        gridCol = cellPos.col + 1;
    } else if (type === 'row-header') {
        const headerPos = position as HeaderPosition;
        gridRow = headerPos.index + 1;
        gridCol = 1;
    } else {
        const headerPos = position as HeaderPosition;
        gridRow = 1;
        gridCol = headerPos.index + 1;
    }

</script>

<div
    class="ss-imputed"
    style="grid-row: {gridRow}; grid-column: {gridCol};"
    data-imputed={type}
></div>

<style>
    .ss-imputed {
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 3;
        background: repeating-linear-gradient(
            45deg,
            var(--ss-imputed-stripe-a, rgba(30, 64, 175, 0.25)),
            var(--ss-imputed-stripe-a, rgba(30, 64, 175, 0.25)) 1px,
            var(--ss-imputed-stripe-b, rgba(37, 99, 235, 0.35)) 1px,
            var(--ss-imputed-stripe-b, rgba(37, 99, 235, 0.35)) 2px,
            transparent 2px,
            transparent 10px
        );
        border: 1px solid var(--ss-imputed-border, rgba(30, 64, 175, 0.4));
        border-radius: 1px;
        box-shadow: inset 0 0 0 1px var(--ss-imputed-stripe-b, rgba(37, 99, 235, 0.2));
    }
</style>