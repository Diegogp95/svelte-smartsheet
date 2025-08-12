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
    <!-- Invisible overlay that covers the entire table -->
    <div 
        class="absolute inset-0 z-[100] cursor-pointer flex items-center justify-center transition-all
            duration-500 {showTooltip ? 'bg-tertiaryOnBg' : ''}"
        style="opacity: {showTooltip ? '0.4' : '0'}"
        on:click={handleClick}
        on:mouseenter={handleMouseEnter}
        on:mouseleave={handleMouseLeave}
        role="button"
        tabindex="0"
        aria-label="Click to navigate"
    >
        {#if showTooltip}
            <!-- Centered text that appears on hover -->
            <div class="text-tertiaryBg text-7xl font-bold pointer-events-none select-none font-serif
                tracking-widest">
                Click to navigate
            </div>
        {/if}
    </div>
{/if}
