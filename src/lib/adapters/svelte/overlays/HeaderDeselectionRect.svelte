<script lang="ts">
    export let headerGridArea: { rowStart: number, rowEnd: number, colStart: number, colEnd: number };
    export let type: 'row' | 'col';
</script>
<div
    class="transition-all duration-150 relative bg-[rgb(130,0,12,0.3)]
        pointer-events-none z-[3]
        border-2 border-minusBg
        "
    style="
        grid-row: {headerGridArea.rowStart} / {headerGridArea.rowEnd};
        grid-column: {headerGridArea.colStart} / {headerGridArea.colEnd};
  "
>

</div>
