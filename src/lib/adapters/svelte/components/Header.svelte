<script lang="ts" generics="TExtraProps = undefined">
    import type {
        HeaderPosition,
        HeaderValue,
    } from '../../../core/types/types.ts';

    // Props from parent
    export let value: HeaderValue | undefined = undefined;
    export let position: HeaderPosition;
    export let styling: string = '';
    export let tailwindStyling: string = '';
    export let instanceId: string;
    export let textOverflowMode: 'full' | 'truncated' = 'truncated';

</script>

<div
    style="grid-row: {position.headerType === 'row' ? position.index + 1 : 1};
        grid-column: {position.headerType === 'col' ? position.index + 1 : 1};"
    class="group flex items-center {position.headerType === 'col' ? 'justify-center' : ''}
        px-4 py-2 select-none relative"
    data-header-type={position.headerType}
    data-header-index={position.index}
    data-instance={instanceId}
>
    <div id="header-background-{instanceId}"
        class="absolute inset-0 w-full h-full z-[1] {tailwindStyling}"
        style={styling}
    />
    <!-- HOVER BACKGROUND -->
    <div class="absolute inset-0 w-full h-full group-hover:bg-sky-700/75 z-[2]"
    />

    <span class="z-[12] font-semibold"
        class:max-h-full={textOverflowMode === 'truncated'}
        class:max-w-full={textOverflowMode === 'truncated'}
        class:text-ellipsis={textOverflowMode === 'truncated'}
        class:overflow-hidden={textOverflowMode === 'truncated'}
        class:whitespace-pre-line={textOverflowMode === 'full'}
    >
        {value ?? ''}
    </span>
    <!-- Corner triangle specifically for corner header -->
    {#if position.headerType === 'corner'}
        <svg class="absolute bottom-1 right-1 w-4 h-4 z-[12] opacity-30 text-gray-500"
            viewBox="0 0 10 10"
            xmlns="http://www.w3.org/2000/svg">
            <path d="M 0 10 L 10 10 L 10 0 Z" fill="currentColor" />
        </svg>
    {/if}
</div>
