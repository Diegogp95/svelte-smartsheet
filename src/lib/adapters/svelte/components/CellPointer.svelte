<script lang="ts">
    export let position: { row: number; col: number };
</script>

<!-- Pointer that overlays the corresponding cell -->
<div
    id="cell-pointer"
    class="ss-pointer"
    style="grid-row: {position.row + 1}; grid-column: {position.col + 1};"
    data-pointer-row={position.row}
    data-pointer-col={position.col}
>
    <!-- Small indicator square in the bottom-right corner -->
    <div class="ss-pointer-corner"></div>
</div>

<style>
    .ss-pointer {
        pointer-events: none;
        border: 4px solid var(--ss-pointer-border, #2563eb);
        background-color: var(--ss-pointer-bg, rgba(30, 64, 175, 0.15));
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3),
                    0 4px 6px -4px rgba(0, 0, 0, 0.2);
        transition: all 150ms;
        position: relative;
        z-index: 4;
        width: 100%;
        height: 100%;
    }

    .ss-pointer-corner {
        position: absolute;
        bottom: -1px;
        right: -1px;
        width: 0.375rem; /* ~6px */
        height: 0.375rem;
        background-color: var(--ss-pointer-border, #2563eb);
        z-index: 31;
    }
</style>
