<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type {
        GridPosition,
        CellComponent,
        OnCellCreation,
        OnCellDestruction,
        CellMouseEvent,
    } from './types';

    // Props from parent
    export let value: string | number = '';
    export let position: GridPosition;
    export let onCellCreation: OnCellCreation | undefined = undefined;
    export let onCellDestruction: OnCellDestruction | undefined = undefined;

    // Internal state
    let selected = false;
    let element: HTMLElement;

    const dispatch = createEventDispatcher<{
        cellInteraction: CellMouseEvent
    }>();

    // Implement CellComponent interface
    const cellComponent: CellComponent = {
        get position() { return position; },
        get element() { return element!; }, // Will be assigned in template
        get selected() { return selected; },
        get value() { return value; },
        setSelected(newSelected: boolean) {
            selected = newSelected;
        }
    };

    // Register with parent on mount
    onMount(() => {
        onCellCreation?.(cellComponent);

        // Cleanup on destroy
        return () => {
            onCellDestruction?.(cellComponent);
        };
    });

    function handleCellMouseInteraction(
        type: 'mousedown' | 'mouseenter' | 'mouseup', event: MouseEvent) {
        dispatch('cellInteraction', {
            type,
            position,
            selected,
            value,
            mouseEvent: event
        });
    }

</script>

<div
    bind:this={element}
    class="border border-tertiaryOnBg px-2 py-1 cursor-pointer select-none transition-colors
        duration-200 w-full h-full flex items-center {selected ? 'bg-[rgb(255,127,80)]' : 'bg-tertiaryBg'}"
    on:mousedown={(e) => handleCellMouseInteraction('mousedown', e)}
    on:mouseenter={(e) => handleCellMouseInteraction('mouseenter', e)}
    on:mouseup={(e) => handleCellMouseInteraction('mouseup', e)}
    data-row={position.row}
    data-col={position.col}
>
    {value}
</div>