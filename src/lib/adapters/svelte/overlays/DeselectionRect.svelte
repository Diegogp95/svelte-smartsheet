<script lang="ts">
    export let gridArea: { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
</script>
<div
    class="ss-deselection-rect"
    style="
        grid-row: {gridArea.rowStart} / {gridArea.rowEnd};
        grid-column: {gridArea.colStart} / {gridArea.colEnd};
    "
></div>

<style>
    .ss-deselection-rect {
        border: 2px solid var(--ss-deselection-border, rgb(130, 0, 12));
        background-color: var(--ss-deselection-bg, rgba(130, 0, 12, 0.3));
        transition: all 150ms;
        position: relative;
        pointer-events: none;
        z-index: 3;
    }
</style>
