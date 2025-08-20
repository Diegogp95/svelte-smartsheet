<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type {
        HeaderPosition,
        HeaderComponent,
        OnHeaderCreation,
        OnHeaderDestruction,
        HeaderMouseEvent,
        HeaderValue,
        FlashOptions,
        FlashColor,
    } from './types';
    import { tick } from 'svelte';
    import {
        generateColumnLabel,
        getFlashColors,
    } from './utils';

    // Visual props
    export let minWidth: string = '3rem';
    export let minHeight: string = '2.5rem';

    // Props from parent
    export let value: HeaderValue | undefined = undefined;
    export let position: HeaderPosition;
    export let readOnly: boolean = true; // Headers are typically read-only
    export let onHeaderCreation: OnHeaderCreation | undefined = undefined;
    export let onHeaderDestruction: OnHeaderDestruction | undefined = undefined;

    // Internal state
    let selected = false;
    let element: HTMLElement;
    let editing = false;
    let inputElement: HTMLInputElement | null = null;
    // Intermediate variable to handle value change by the controller
    let inputValue: HeaderValue = value ?? '';

    const dispatch = createEventDispatcher<{
        headerInteraction: HeaderMouseEvent,
        headerDoubleClick: HeaderMouseEvent,
        inputBlur: { event: FocusEvent, position: HeaderPosition },
        inputKeyCommit: { event: KeyboardEvent, position: HeaderPosition },
        inputKeyCancel: { event: KeyboardEvent, position: HeaderPosition },
    }>();

    // Implement HeaderComponent interface
    const headerComponent: HeaderComponent = {
        get position() { return position; },
        get element() { return element!; }, // Will be assigned in template
        get selected() { return selected; },
        get value() { return value ?? ''; },
        get editing() { return editing; },
        get inputElement() { return inputElement!; },
        get inputValue() { return inputValue; },
        get readOnly() { return readOnly; },
        setSelected(newSelected: boolean) {
            selected = newSelected;
        },
        setValue(newValue: HeaderValue) {
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
        setInputValue(newInputValue: HeaderValue) {
            inputValue = newInputValue;
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

                element.classList.add('header-flash');

                // Remove class after animation completes
                setTimeout(() => {
                    element.classList.remove('header-flash');
                }, duration);
            }
        }
    };

    function defaultHeaderValueAssignment() {
        if (position.headerType === 'row') {
            return position.index + 1;
        } else {
            // Generate column labels: A, B, C, ..., Z, AA, AB, AC, ..., AZ, BA, BB, ...
            return generateColumnLabel(position.index);
        }
    }

    // Register with parent on mount
    onMount(() => {
        if (value === undefined) {
            value = defaultHeaderValueAssignment();
        }
        onHeaderCreation?.(headerComponent);

        // Cleanup on destroy
        return () => {
            onHeaderDestruction?.(headerComponent);
        };
    });

    function handleHeaderMouseInteraction(
        type: 'mousedown' | 'mouseenter' | 'mouseup', event: MouseEvent) {
        if (inputElement) {
            // If the input element is rendered, prevent dispatching event
            event.stopPropagation();
            return;
        }
        if (event.detail === 2) {
            return;
        }

        dispatch('headerInteraction', {
            type,
            position,
            selected,
            value: value ?? '',
            mouseEvent: event
        });
    }

    function handleDoubleClick(event: MouseEvent) {
        if (inputElement || readOnly) {
            // If the input element is rendered, prevent dispatching event
            event.stopPropagation();
            return;
        }

        dispatch('headerDoubleClick', {
            type: 'dblclick',
            position,
            selected,
            value: value ?? '',
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
    class="
        flex items-center {position.headerType === 'col' ? 'justify-center' : ''}
        w-full h-full
        px-2 py-1
        {selected ? 'bg-slate-400' : ''}
        text-gray-700 font-semibold
        cursor-pointer select-none
        transition-colors duration-200
        {selected ? (position.headerType === 'col' ? 'border-b-4 border-green-800' :
            'border-r-4 border-green-800') : ''}
    "
    on:mousedown={(e) => handleHeaderMouseInteraction('mousedown', e)}
    on:mouseenter={(e) => handleHeaderMouseInteraction('mouseenter', e)}
    on:mouseup={(e) => handleHeaderMouseInteraction('mouseup', e)}
    on:dblclick={handleDoubleClick}
    data-header-type={position.headerType}
    data-header-index={position.index}
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
    :global(.header-flash) {
        animation: header-flash-anim var(--flash-duration, 800ms) ease-out;
    }

    @keyframes header-flash-anim {
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
