<script lang="ts">
    export let gridArea: { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
    export let active: boolean = false;
</script>
<div
    class="border-2 border-dashed border-[rgb(0,145,88,1.0)] bg-[rgba(207,162,111,0.8)] transition-all duration-150 relative
        pointer-events-none z-[2] shadow-md shadow-black"
    style="
        grid-row: {gridArea.rowStart} / {gridArea.rowEnd};
        grid-column: {gridArea.colStart} / {gridArea.colEnd};
  "
>

</div>

<style>

</style>