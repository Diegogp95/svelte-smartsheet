<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type {
        GridPosition,
    } from '../../../core/types/types.ts';

    // Props from parent
    export let position: GridPosition;
    export let styling: string = '';        // inline style string for dynamic bg/color from DataHandler
    export let cssClass: string = '';       // extra CSS class(es) injected by the consumer (replaces tailwindStyling)
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
    style="grid-row: {position.row + 1}; grid-column: {position.col + 1};"
    class="ss-input-cell"
    data-row={position.row}
    data-col={position.col}
    data-instance={instanceId}
>
    <div id="cell-background-{instanceId}"
        class="ss-layer {cssClass}"
        style={styling}
    ></div>
    <input
        id="cell-input-{instanceId}"
        class="ss-input-cell__input"
        type="text"
        data-row={position.row}
        data-col={position.col}
        on:blur={handleInputBlur}
        on:keydown={handleInputKeydown}
    />
</div>

<style>
    .ss-input-cell {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        position: relative;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        user-select: none;
        transition: background-color 200ms;
        background-color: var(--ss-cell-bg, #ffffff);
        color: var(--ss-cell-text, #111827);
        font-family: var(--ss-font-family, ui-sans-serif, system-ui, sans-serif);
    }

    .ss-input-cell :global(.ss-layer) {
        z-index: 1;
    }

    .ss-input-cell__input {
        z-index: 5;
        width: 100%;
        height: 100%;
        background: transparent;
        border: none;
        outline: none;
        padding: 0;
        margin: 0;
        color: var(--ss-input-text, #111827);
        font-size: inherit;
        font-family: inherit;
    }
</style>
