<script lang="ts">
    import type {
        GridPosition,
        CellBackgroundComponent,
        OnBackgroundCreation,
        OnBackgroundDestruction,
        BackgroundProperties,
        TailwindProperties,
    } from './types';
    import { onMount } from 'svelte';

    // Props from parent
    export let position: GridPosition;
    export let onBackgroundCreation: OnBackgroundCreation | undefined = undefined;
    export let onBackgroundDestruction: OnBackgroundDestruction | undefined = undefined;

    // Internal state
    let element: HTMLElement;
    let backgroundProperties: BackgroundProperties = {
        'background-color': undefined,
        'border-color': undefined,
        'border-width': undefined,
        'border-style': undefined,
        'border-radius': undefined,
        'opacity': undefined,
    };
    let tailwindProperties: TailwindProperties = {
        'bg': undefined,
        'border': undefined,
        'rounded': undefined,
        'opacity': undefined,
    };

    // Strings to apply style and tailwind classes
    let backgroundClass: string = '';
    let tailwindClasses: string = '';

    /*
     ** This component implements support for direct css styling and tailwind classes,
     ** but class variables take priority over tailwind classes, so we advice to use them separately.
    */

    // Implement CellBackgroundComponent interface
    const backgroundComponent: CellBackgroundComponent = {
        get position() { return position; },
        get element() { return element!; },
        get backgroundProperties() { return backgroundProperties; },
        get tailwindProperties() { return tailwindProperties; },
        setBackgroundProperties(props: BackgroundProperties) {
            // Only update existing properties; do not add new ones
            for (const key in backgroundProperties) {
                if (Object.prototype.hasOwnProperty.call(props, key)) {
                    const newValue = props[key as keyof BackgroundProperties];
                    backgroundProperties[key as keyof BackgroundProperties] = newValue as any;
                }
            }
        },
        setTailwindProperties(props: TailwindProperties) {
            for (const key in tailwindProperties) {
                if (Object.prototype.hasOwnProperty.call(props, key)) {
                    const newValue = props[key as keyof TailwindProperties];
                    tailwindProperties[key as keyof TailwindProperties] = newValue as any;
                }
            }
        },
        applyBackgroundProperties() {
            if (element) {
                backgroundClass = Object.entries(backgroundProperties)
                    .map(([key, value]) => {
                        if (value !== undefined) {
                            return `${key}: ${value};`;
                        }
                        return '';
                    })
                    .join(' ');
            }
        },
        applyTailwindProperties() {
            if (element) {
                tailwindClasses = Object.entries(tailwindProperties)
                    .flatMap(([prefix, values]: [string, string[] | number | undefined]) => {
                        if (Array.isArray(values)) {
                            return values.map(value => `${prefix}-${value}`);
                        } else if (typeof values === 'number' || typeof values === 'string') {
                            return [`${prefix}-${values}`];
                        }
                        return [];
                    })
                    .join(' ');
            }
        },
        clearBackgroundProperties() {
            backgroundProperties = {
                'background-color': undefined,
                'border-color': undefined,
                'border-width': undefined,
                'border-style': undefined,
                'border-radius': undefined,
                'opacity': undefined,
            };
            tailwindClasses = '';
            this.applyBackgroundProperties();
        },
        clearTailwindProperties() {
            tailwindProperties = {
                'bg': undefined,
                'border': undefined,
                'rounded': undefined,
                'opacity': undefined,
            };
            this.applyTailwindProperties();
        },
    }

    // Register with parent on mount
    onMount(() => {
        onBackgroundCreation?.(backgroundComponent);
        backgroundComponent.applyBackgroundProperties();

        // Cleanup on destroy
        return () => {
            onBackgroundDestruction?.(backgroundComponent);
        };
    });

</script>

<div
    bind:this={element}
    class="w-full h-full cell-background inset-0 pointer-events-none {tailwindClasses}
        transition-all duration-200 ease-in-out
        border border-slate-500"
    style="{backgroundClass}"
    data-row={position.row}
    data-col={position.col}
></div>
