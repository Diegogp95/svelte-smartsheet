<script lang="ts">
    export let gridArea: { rowStart: number; rowEnd: number; colStart: number; colEnd: number };
    export let active: boolean = false;
</script>
<div
  class="border-4 border-plusBg bg-slate-700/20 transition-all duration-150 relative
    pointer-events-none"
  style="
    grid-row: {gridArea.rowStart} / {gridArea.rowEnd};
    grid-column: {gridArea.colStart} / {gridArea.colEnd};
  "
></div>
