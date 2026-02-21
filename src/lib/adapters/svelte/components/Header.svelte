<script lang="ts" generics="TExtraProps = undefined">
    import type {
        HeaderPosition,
        HeaderValue,
    } from '../../../core/types/types.ts';

    // Props from parent
    export let value: HeaderValue | undefined = undefined;
    export let position: HeaderPosition;
    export let styling: string = '';        // inline style string for dynamic bg/color from ColorHandler
    export let cssClass: string = '';       // extra CSS class(es) injected by the consumer (replaces tailwindStyling)
    export let instanceId: string;
    export let textOverflowMode: 'full' | 'truncated' = 'truncated';

</script>

<div
    style="grid-row: {position.headerType === 'row' ? position.index + 1 : 1};
           grid-column: {position.headerType === 'col' ? position.index + 1 : 1};"
    class="ss-header"
    class:ss-header--col={position.headerType === 'col'}
    data-header-type={position.headerType}
    data-header-index={position.index}
    data-instance={instanceId}
>
    <div id="header-background-{instanceId}"
        class="ss-layer {cssClass}"
        style={styling}
    ></div>
    <div class="ss-header-hover" ></div>

    <span
        class="ss-header-text"
        class:ss-header-text--truncated={textOverflowMode === 'truncated'}
        class:ss-header-text--full={textOverflowMode === 'full'}
    >
        {value ?? ''}
    </span>

    {#if position.headerType === 'corner'}
        <svg
            class="ss-header-corner-icon"
            viewBox="0 0 10 10"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            <path d="M 0 10 L 10 10 L 10 0 Z" fill="currentColor" />
        </svg>
    {/if}
</div>

<style>
    .ss-header {
        display: flex;
        align-items: center;
        padding: 0.5rem 1rem;
        user-select: none;
        position: relative;
        width: 100%;
        height: 100%;
        background-color: var(--ss-header-bg, #f3f4f6);
        color: var(--ss-header-text, #374151);
        font-family: var(--ss-font-family, ui-sans-serif, system-ui, sans-serif);
    }

    .ss-header--col {
        justify-content: center;
    }

    /* .ss-layer positioning from base.css; z-index scoped here */
    .ss-header :global(.ss-layer) {
        z-index: 1;
    }

    .ss-header-hover {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        z-index: 2;
        background-color: transparent;
        transition: background-color 150ms;
    }

    .ss-header:hover .ss-header-hover {
        background-color: var(--ss-header-hover-bg, rgba(14, 165, 233, 0.45));
    }

    .ss-header-text {
        z-index: 12;
        font-weight: var(--ss-header-font-weight, 600);
    }

    .ss-header-text--truncated {
        max-height: 100%;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .ss-header-text--full {
        white-space: pre-line;
    }

    .ss-header-corner-icon {
        position: absolute;
        bottom: 0.25rem;
        right: 0.25rem;
        width: 1rem;
        height: 1rem;
        z-index: 12;
        opacity: 0.3;
        color: var(--ss-corner-icon-color, #9ca3af);
    }
</style>
