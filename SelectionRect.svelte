<script lang="ts">
    export let gridArea: { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
    export let active: boolean = false;
</script>
<div
  class="border-4 border-plusBg bg-[rgb(255,127,80,0.8)] transition-all duration-150 relative
    pointer-events-none z-20"
  style="
    grid-row: {gridArea.rowStart} / {gridArea.rowEnd};
    grid-column: {gridArea.colStart} / {gridArea.colEnd};
  "
></div>
