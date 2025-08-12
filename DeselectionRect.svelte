<script lang="ts">
    export let gridArea: { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
</script>
<div
  class="border-4 border-minusBg bg-stone-700/20 transition-all duration-150 relative
    pointer-events-none z-[25]"
  style="
    grid-row: {gridArea.rowStart} / {gridArea.rowEnd};
    grid-column: {gridArea.colStart} / {gridArea.colEnd};
  "
></div>
