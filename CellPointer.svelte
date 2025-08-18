<script lang="ts">
    export let position: { row: number; col: number };
</script>

<!-- Pointer that overlays the corresponding cell -->
<div
    class="pointer-events-none border-4 border-sheetPointerBorder bg-slate-700/50
        shadow-lg transition-all duration-150 relative z-[4]"
    style="
        grid-row: {position.row + 1};
        grid-column: {position.col + 1};
        width: 100%;
        height: 100%;
    "
    data-pointer-row={position.row}
    data-pointer-col={position.col}
>
    <!-- Small indicator square in the top-left corner -->
    <div
        class="absolute top-0 left-0 bg-sheetPointerBorder w-1.5 h-1.5"
        style="z-index: 31;"
    >
    </div>
</div>
