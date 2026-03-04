import { tick } from 'svelte';
import type { InputActivationPort } from '../../../core/ports/InputActivationPort.ts';

/**
 * Svelte implementation of InputActivationPort.
 *
 * Uses Svelte's tick() to wait for the reactivity cycle to complete before
 * querying the DOM for the input element rendered by InputCell / InputHeader components.
 * Builds the selector from the instance ID so multiple grids on the same page remain isolated.
 */
export class SvelteInputActivation implements InputActivationPort {
    private readonly instanceId: string;
    private activeInput: HTMLInputElement | null = null;

    constructor(instanceId: string) {
        this.instanceId = instanceId;
    }

    async activateInput(componentType: 'cell' | 'header', initialValue: string): Promise<void> {
        // Wait for Svelte to finish applying its reactive updates before touching the DOM
        await tick();

        const selector = componentType === 'cell'
            ? `#cell-input-${this.instanceId}`
            : `#header-input-${this.instanceId}`;

        const element = document.querySelector(selector);
        if (element instanceof HTMLInputElement) {
            this.activeInput = element;
            this.activeInput.value = initialValue;
            this.activeInput.focus();
            this.activeInput.select();
        }
    }

    getInputValue(): string | null {
        return this.activeInput?.value ?? null;
    }

    deactivateInput(): void {
        this.activeInput = null;
    }
}
