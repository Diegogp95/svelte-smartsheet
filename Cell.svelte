<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type {
        GridPosition,
        CellComponent,
        OnCellCreation,
        OnCellDestruction,
        CellMouseEvent,
        CellValue,
    } from './types';
    import { tick } from 'svelte';

    // Props from parent
    export let value: CellValue = '';
    export let position: GridPosition;
    export let onCellCreation: OnCellCreation | undefined = undefined;
    export let onCellDestruction: OnCellDestruction | undefined = undefined;

    // Internal state
    let selected = false;
    let element: HTMLElement;
    let editing = false;
    let inputElement: HTMLInputElement | null = null;
    // Intermediate variable to handler value changes by the controller
    let inputValue: CellValue = value;

    const dispatch = createEventDispatcher<{
        cellInteraction: CellMouseEvent,
        cellDoubleClick: CellMouseEvent,
        inputBlur: { event: FocusEvent, position: GridPosition },
    }>();

    // Implement CellComponent interface
    const cellComponent: CellComponent = {
        get position() { return position; },
        get element() { return element!; }, // Will be assigned in template
        get selected() { return selected; },
        get value() { return value; },
        get editing() { return editing; },
        get inputElement() { return inputElement!; },
        get inputValue() { return inputValue; },
        setSelected(newSelected: boolean) {
            selected = newSelected;
        },
        setValue(newValue: CellValue) {
            console.log(`[Cell ${position.row},${position.col}] setValue: ${newValue}`);
            value = newValue;
        },
        setEditing(newEditing: boolean) {
            console.log(`[Cell ${position.row},${position.col}] setEditing: ${newEditing}`);
            editing = newEditing;
        },
        setInputFocus() {
            tick().then(() => {
                if (inputElement) {
                    inputElement.focus();
                    inputElement.select();
                    console.log(`[Cell ${position.row},${position.col}] setInputFocus: Input focused (after tick).`);
                } else {
                    console.warn(`[Cell ${position.row},${position.col}] Input not available after tick.`);
                }
            });
        },
        // Maybe useful later
        setInputValue(value: CellValue) {
            inputValue = value;
        },
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
        if (inputElement) {
            // If the input element is rendered, prevent dispatching event
            event.stopPropagation();
            return;
        }
        if (event.detail === 2) {
            return;
        }

        dispatch('cellInteraction', {
            type,
            position,
            selected,
            value,
            mouseEvent: event
        });
    }

    function handleDoubleClick(event: MouseEvent) {
        if (inputElement) {
            // If the input element is rendered, prevent dispatching event
            event.stopPropagation();
            return;
        }

        dispatch('cellDoubleClick', {
            type: 'dblclick',
            position,
            selected,
            value,
            mouseEvent: event
        });
    }

    function handleInputBlur(event: FocusEvent) {
        dispatch('inputBlur', { event, position });
    }

</script>

<div
    bind:this={element}
    class="border border-tertiaryOnBg px-2 py-1 cursor-pointer select-none transition-colors
        duration-200 w-full h-full flex items-center {selected ? 'bg-[rgb(255,127,80)]' : 'bg-tertiaryBg'}"
    on:mousedown={(e) => handleCellMouseInteraction('mousedown', e)}
    on:mouseenter={(e) => handleCellMouseInteraction('mouseenter', e)}
    on:mouseup={(e) => handleCellMouseInteraction('mouseup', e)}
    on:dblclick={handleDoubleClick}
    data-row={position.row}
    data-col={position.col}
>
    {#if editing}
        <input
            type="text"
            bind:value={inputValue}
            bind:this={inputElement}
            class="w-full h-full bg-transparent outline-none"
            on:blur={handleInputBlur}
            on:keydown={(event) => {event.stopPropagation();}}
        />
    {:else}
        <span
        >
            {value}
        </span>
    {/if}
</div>