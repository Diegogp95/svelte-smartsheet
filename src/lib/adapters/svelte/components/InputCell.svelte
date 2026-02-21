<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type {
        GridPosition,
    } from '../../../core/types/types.ts';

    // Props from parent
    export let position: GridPosition;
    export let styling: string = '';
    export let tailwindStyling: string = '';
    export let instanceId: string;

    const dispatch = createEventDispatcher();

    function handleInputBlur(event: FocusEvent) {
        dispatch('inputBlur', { event, position });
    }

    function handleInputKeydown(event: KeyboardEvent) {
        event.stopPropagation();
        if (['Enter', 'Tab'].includes(event.key)) {
            event.preventDefault();
            dispatch('inputKeyCommit', { event, position });
        } else if (event.key === 'Escape') {
            event.preventDefault();
            dispatch('inputKeyCancel', { event, position });
        }
    }

</script>

<div
    style=" grid-row: {position.row + 1}; grid-column: {position.col + 1};"
    class="px-2 py-1 cursor-pointer select-none transition-colors
        duration-200 w-full h-full flex items-center relative"
    data-row={position.row}
    data-col={position.col}
    data-instance={instanceId}
>
    <div id="cell-background-{instanceId}"
        class="absolute inset-0 w-full h-full z-[1] {tailwindStyling}"
        style={styling}
    />
    <input
        id="cell-input-{instanceId}"
        class="z-[5] w-full h-full bg-transparent border-none outline-none p-0 m-0"
        type="text"
        data-row={position.row}
        data-col={position.col}
        on:blur={handleInputBlur}
        on:keydown={handleInputKeydown}
    />
</div>
