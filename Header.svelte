<script lang="ts" generics="TExtraProps = undefined">
    import type {
        HeaderPosition,
        HeaderValue,
    } from './types';

    // Props from parent
    export let value: HeaderValue | undefined = undefined;
    export let position: HeaderPosition;
    export let styling: string = '';
    export let tailwindStyling: string = '';

</script>

<div
    style="grid-row: {position.headerType === 'row' ? position.index + 1 : 1};
        grid-column: {position.headerType === 'col' ? position.index + 1 : 1};"
    class="flex items-center {position.headerType === 'col' ? 'justify-center' : ''}
        px-4 py-2 cursor-pointer select-none relative"
    data-header-type={position.headerType}
    data-header-index={position.index}
>
    <div id="header-background"
        class="absolute inset-0 w-full h-full z-[1] {tailwindStyling}"
        style={styling}
    />
    <span class="z-[12] font-semibold">
        {value ?? ''}
    </span>
</div>
