<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type {
        HeaderPosition,
    } from './types';

    // Props from parent
    export let position: HeaderPosition;
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
    style="grid-row: {position.headerType === 'row' ? position.index + 1 : 1};
        grid-column: {position.headerType === 'col' ? position.index + 1 : 1};"
    class="flex items-center {position.headerType === 'col' ? 'justify-center' : ''}
        px-4 py-2 cursor-pointer select-none relative"
    data-header-type={position.headerType}
    data-header-index={position.index}
    data-instance={instanceId}
>
    <div id="header-background-{instanceId}"
        class="absolute inset-0 w-full h-full z-[1] {tailwindStyling}"
        style={styling}
    />
    <input
        id="header-input-{instanceId}"
        class="z-[12] w-full bg-transparent border-none outline-none p-0 m-0 
               font-semibold text-center"
        type="text"
        data-header-type={position.headerType}
        data-header-index={position.index}
        on:blur={handleInputBlur}
        on:keydown={handleInputKeydown}
    />
</div>
