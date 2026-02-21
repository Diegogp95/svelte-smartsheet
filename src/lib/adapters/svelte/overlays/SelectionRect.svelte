<script lang="ts">
    export let gridArea: { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
</script>
<div
    class="ss-selection-rect"
    style="
        grid-row: {gridArea.rowStart} / {gridArea.rowEnd};
        grid-column: {gridArea.colStart} / {gridArea.colEnd};
    "
></div>

<style>
    .ss-selection-rect {
        border: 2px dashed var(--ss-selection-border, rgb(0, 145, 88));
        background-color: var(--ss-selection-bg, rgba(207, 162, 111, 0.4));
        transition: all 150ms;
        position: relative;
        pointer-events: none;
        z-index: 2;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5);
    }
</style>
