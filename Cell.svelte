<script lang="ts" generics="TExtraProps = undefined">
    import { createEventDispatcher, onMount } from 'svelte';
    import type {
        GridPosition,
        CellComponent,
        OnCellCreation,
        OnCellDestruction,
        CellMouseEvent,
        CellValue,
        FlashOptions,
        FlashColor,
    } from './types';
    import { tick } from 'svelte';
    import { getFlashColors } from './utils';

    // Visual props
    export let minWidth: string = '5rem';
    export let minHeight: string = '2.5rem';

    // Props from parent
    export let value: CellValue = '';
    export let position: GridPosition;
    // extraProps: simplified type - just TExtraProps directly
    export let extraProps: TExtraProps = undefined as TExtraProps;
    export let onCellCreation: OnCellCreation<TExtraProps> | undefined = undefined;
    export let onCellDestruction: OnCellDestruction<TExtraProps> | undefined = undefined;

    // Internal state
    let selected = false;
    let element: HTMLElement;
    let editing = false;
    let inputElement: HTMLInputElement | null = null;
    // Intermediate variable to handle value change by the controller
    let inputValue: CellValue = value;

    const dispatch = createEventDispatcher<{
        cellInteraction: CellMouseEvent,
        cellDoubleClick: CellMouseEvent,
        inputBlur: { event: FocusEvent, position: GridPosition },
        inputKeyCommit: { event: KeyboardEvent, position: GridPosition },
        inputKeyCancel: { event: KeyboardEvent, position: GridPosition },
    }>();

    // Implement CellComponent interface
    const cellComponent: CellComponent<TExtraProps> = {
        get position() { return position; },
        get element() { return element!; }, // Will be assigned in template
        get selected() { return selected; },
        get value() { return value; },
        get editing() { return editing; },
        get inputElement() { return inputElement!; },
        get inputValue() { return inputValue; },
        get extraProps() { return extraProps; }, // Simplified: no more casting needed
        setSelected(newSelected: boolean) {
            selected = newSelected;
        },
        setValue(newValue: CellValue) {
            value = newValue;
        },
        setEditing(newEditing: boolean) {
            editing = newEditing;
        },
        setInputFocus() {
            tick().then(() => {
                if (inputElement) {
                    inputElement.focus();
                    inputElement.select();
                }
            });
        },
        // Maybe useful later
        setInputValue(newInputValue: CellValue) {
            inputValue = newInputValue;
        },
        setExtraProps(props: TExtraProps) {
            extraProps = props; // Simplified: no more casting needed
        },
        triggerFlash(options?: FlashOptions) {
            const color = options?.color || 'blue';
            const duration = options?.duration || 600;

            if (element) {
                const colors = getFlashColors(color);

                // Set CSS custom properties for the animation
                element.style.setProperty('--flash-primary-color', colors.primary);
                element.style.setProperty('--flash-secondary-color', colors.secondary);
                element.style.setProperty('--flash-duration', `${duration}ms`);

                element.classList.add('cell-changed-flash');

                // Remove class after animation completes
                setTimeout(() => {
                    element.classList.remove('cell-changed-flash');
                }, duration);
            }
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
    bind:this={element}
    style="min-width: {minWidth}; min-height: {minHeight};"
    class="px-2 py-1 cursor-pointer select-none transition-colors
        duration-200 w-full h-full flex items-center"
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
            on:keydown={handleInputKeydown}
        />
    {:else}
        <span
        >
            {value ?? ''}
        </span>
    {/if}
</div>

<style>
    /* Flash animation for value changes */
    :global(.cell-changed-flash) {
        animation: cell-flash var(--flash-duration, 800ms) ease-out;
    }

    @keyframes cell-flash {
        0% {
            background-color: var(--flash-primary-color, rgba(59, 130, 246, 0.3));
            box-shadow: 0 0 8px var(--flash-secondary-color, rgba(59, 130, 246, 0.6));
        }
        50% {
            background-color: var(--flash-secondary-color, rgba(59, 130, 246, 0.5));
            box-shadow: 0 0 12px var(--flash-secondary-color, rgba(59, 130, 246, 0.8));
        }
        100% {
            background-color: transparent;
            box-shadow: none;
        }
    }
</style>