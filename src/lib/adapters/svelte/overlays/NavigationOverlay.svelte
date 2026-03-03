<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let visible: boolean = true;
    export let tableContainer: HTMLDivElement | undefined = undefined;
    
    const dispatch = createEventDispatcher<{
        activate: void;
    }>();
    
    let showTooltip = false;
    
    // Reset tooltip visibility when overlay is not visible
    $: if (!visible) {
        showTooltip = false;
    }
    
    function handleClick() {
        dispatch('activate');
    }
    
    function handleMouseEnter() {
        showTooltip = true;
    }
    
    function handleMouseLeave() {
        showTooltip = false;
    }
</script>

{#if visible}
    <div
        class="ss-nav-overlay"
        class:ss-nav-overlay--active={showTooltip}
        style="opacity: {showTooltip ? '0.4' : '0'}"
        on:click={handleClick}
        on:mouseenter={handleMouseEnter}
        on:mouseleave={handleMouseLeave}
        role="button"
        tabindex="0"
        aria-label="Click to navigate"
        on:keydown={() => {}}
    >
        {#if showTooltip}
            <div class="ss-nav-overlay__text">Click to navigate</div>
        {/if}
    </div>
{/if}

<style>
    .ss-nav-overlay {
        position: absolute;
        inset: 0;
        z-index: 30;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 500ms;
    }

    .ss-nav-overlay--active {
        background-color: var(--ss-nav-overlay-bg, #111827);
    }

    .ss-nav-overlay__text {
        color: var(--ss-nav-overlay-text, #ffffff);
        font-size: clamp(1.25rem, 8cqw, 4.5rem);
        font-weight: 700;
        pointer-events: none;
        user-select: none;
        font-family: serif;
        letter-spacing: 0.1em;
        text-align: center;
        max-width: 90%;
        word-break: break-word;
    }
</style>
