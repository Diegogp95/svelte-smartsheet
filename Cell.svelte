<script lang="ts">
    export let value: string | number = '';
    export let position: { row: number; col: number };
    export let selected: boolean = false;
    
    import { createEventDispatcher } from 'svelte';
    
    const dispatch = createEventDispatcher<{
        cellClick: { position: { row: number; col: number }; selected: boolean; value: string | number };
    }>();
    
    function handleClick() {
        // Don't change local state, just dispatch event
        dispatch('cellClick', { position, selected, value });
    }
    $:{
        selected;
        console.log(`Cell at ${position.row}-${position.col}, selected: ${selected}:`, {
            value,
            position
        });
    }
</script>

<div 
    class="border border-tertiaryOnBg px-2 py-1 cursor-pointer select-none transition-colors duration-200 w-full h-full flex items-center {selected ? 'bg-[rgb(255,127,80)]' : 'bg-tertiaryBg'}"
    on:click={handleClick}
    data-row={position.row}
    data-col={position.col}
>
    {value}
</div>