<script lang="ts">
    export let headerGridArea: { rowStart: number, rowEnd: number, colStart: number, colEnd: number };
    export let type: 'row' | 'col';
</script>
<div
    class="ss-header-desel-rect"
    style="
        grid-row: {headerGridArea.rowStart} / {headerGridArea.rowEnd};
        grid-column: {headerGridArea.colStart} / {headerGridArea.colEnd};
    "
></div>

<style>
    .ss-header-desel-rect {
        transition: all 150ms;
        position: relative;
        pointer-events: none;
        z-index: 3;
        background-color: var(--ss-deselection-bg, rgba(130, 0, 12, 0.3));
        border: 2px solid var(--ss-deselection-border, rgb(130, 0, 12));
    }
</style>
