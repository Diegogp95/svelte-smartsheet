<script lang="ts">
    export let headerGridArea: { rowStart: number, rowEnd: number, colStart: number, colEnd: number };
    export let type: 'row' | 'col';
</script>
<div
    class="ss-header-sel-rect"
    style="
        grid-row: {headerGridArea.rowStart} / {headerGridArea.rowEnd};
        grid-column: {headerGridArea.colStart} / {headerGridArea.colEnd};
    "
></div>

<style>
    .ss-header-sel-rect {
        transition: all 150ms;
        position: relative;
        pointer-events: none;
        z-index: 2;
        background-color: var(--ss-header-sel-bg, rgba(134, 239, 172, 0.4));
        border: 2px solid var(--ss-header-sel-border, #14532d);
    }
</style>
