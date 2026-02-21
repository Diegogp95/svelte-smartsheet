<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type {
        HeaderPosition,
    } from '../../../core/types/types.ts';

    // Props from parent
    export let position: HeaderPosition;
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
    style="grid-row: {position.headerType === 'row' ? position.index + 1 : 1};
           grid-column: {position.headerType === 'col' ? position.index + 1 : 1};"
    class="ss-input-header"
    class:ss-input-header--col={position.headerType === 'col'}
    data-header-type={position.headerType}
    data-header-index={position.index}
    data-instance={instanceId}
>
    <div id="header-background-{instanceId}"
        class="ss-layer {cssClass}"
        style={styling}
    ></div>
    <input
        id="header-input-{instanceId}"
        class="ss-input-header__input"
        type="text"
        data-header-type={position.headerType}
        data-header-index={position.index}
        on:blur={handleInputBlur}
        on:keydown={handleInputKeydown}
    />
</div>

<style>
    .ss-input-header {
        display: flex;
        align-items: center;
        padding: 0.5rem 1rem;
        cursor: pointer;
        user-select: none;
        position: relative;
        width: 100%;
        height: 100%;
        background-color: var(--ss-header-bg, #f3f4f6);
        color: var(--ss-header-text, #374151);
        font-family: var(--ss-font-family, ui-sans-serif, system-ui, sans-serif);
    }

    .ss-input-header--col {
        justify-content: center;
    }

    .ss-input-header :global(.ss-layer) {
        z-index: 1;
    }

    .ss-input-header__input {
        z-index: 12;
        width: 100%;
        background: transparent;
        border: none;
        outline: none;
        padding: 0;
        margin: 0;
        font-weight: var(--ss-header-font-weight, 600);
        text-align: center;
        color: var(--ss-header-text, #374151);
        font-size: inherit;
        font-family: inherit;
    }
</style>
