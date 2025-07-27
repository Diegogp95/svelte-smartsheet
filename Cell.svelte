<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { GridPosition, CellComponent, RegisterCellFunction, UnregisterCellFunction } from './types';

    // Props from parent
    export let value: string | number = '';
    export let position: GridPosition;
    export let registerCell: RegisterCellFunction | undefined = undefined;
    export let unregisterCell: UnregisterCellFunction | undefined = undefined;

    // Internal state
    let selected = false;
    let element: HTMLElement;

    const dispatch = createEventDispatcher<{
        cellClick: { position: GridPosition; selected: boolean; value: string | number };
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
        registerCell?.(cellComponent);

        // Cleanup on destroy
        return () => {
            unregisterCell?.(position);
        };
    });

    function handleClick() {
        // Only dispatch event to parent - let parent handle all logic
        dispatch('cellClick', { position, selected, value });
    }
</script>

<div
    bind:this={element}
    class="border border-tertiaryOnBg px-2 py-1 cursor-pointer select-none transition-colors duration-200 w-full h-full flex items-center {selected ? 'bg-[rgb(255,127,80)]' : 'bg-tertiaryBg'}"
    on:click={handleClick}
    data-row={position.row}
    data-col={position.col}
>
    {value}
</div>