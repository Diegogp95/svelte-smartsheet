import type { FlashEffectPort, FlashTarget, FlashCallOptions } from '../../../core/ports/FlashEffectPort.ts';
import { getFlashColors } from '../utils/flashColors.ts';

/**
 * Svelte implementation of FlashEffectPort.
 *
 * Uses data-attributes stamped on rendered elements by the Svelte cell/header
 * components to locate the correct DOM node, then applies CSS custom properties
 * and the 'flash' CSS class to trigger the animation.
 *
 * The instanceId is required to scope queries to this specific SmartSheet
 * instance when multiple instances are mounted on the same page.
 */
export class SvelteFlashEffect implements FlashEffectPort {
    constructor(private readonly instanceId: string) {}

    flash(target: FlashTarget, options: FlashCallOptions): void {
        const { primary, secondary } = getFlashColors(options.color);

        let containerSelector: string;
        let backgroundId: string;

        if (target.type === 'cell') {
            containerSelector = `div[data-row='${target.row}'][data-col='${target.col}'][data-instance='${this.instanceId}']`;
            backgroundId = `#cell-background-${this.instanceId}`;
        } else {
            containerSelector = `div[data-header-type='${target.headerType}'][data-header-index='${target.index}'][data-instance='${this.instanceId}']`;
            backgroundId = `#header-background-${this.instanceId}`;
        }

        const renderedEl = document.querySelector(containerSelector);
        const backgroundElement = renderedEl?.querySelector(backgroundId) as HTMLElement | null;

        if (!backgroundElement) return;

        backgroundElement.style.setProperty('--flash-primary-color', primary);
        backgroundElement.style.setProperty('--flash-secondary-color', secondary);
        backgroundElement.style.setProperty('--flash-duration', `${options.duration}ms`);
        backgroundElement.classList.add('flash');
        setTimeout(() => {
            backgroundElement.classList.remove('flash');
        }, options.duration);
    }
}
