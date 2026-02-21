<script lang="ts">
    export let headerGridArea: { rowStart: number, rowEnd: number, colStart: number, colEnd: number };
    export let type: 'row' | 'col';
</script>
<div
    class="transition-all duration-150 relative
        pointer-events-none z-[2]
        bg-[rgba(134,239,172,0.4)]
        border-green-900 border-2
        "
    style="
        grid-row: {headerGridArea.rowStart} / {headerGridArea.rowEnd};
        grid-column: {headerGridArea.colStart} / {headerGridArea.colEnd};
  "
>

</div>
