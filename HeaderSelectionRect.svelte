<script lang="ts">
    export let headerGridArea: { rowStart: number, rowEnd: number, colStart: number, colEnd: number };
    export let type: 'row' | 'col';
    export let active: boolean = false;
</script>
<div
    class="transition-all duration-150 relative
        pointer-events-none z-[2]
        {type === 'row' ? 'border-r-4 border-green-900' : 'border-b-4 border-green-900'}
        "
    style="
        grid-row: {headerGridArea.rowStart} / {headerGridArea.rowEnd};
        grid-column: {headerGridArea.colStart} / {headerGridArea.colEnd};
  "
>

</div>

<style>

</style>