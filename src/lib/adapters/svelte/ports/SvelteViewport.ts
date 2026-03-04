import type { ViewportPort, ScrollState, ScrollCommand } from '../../../core/ports/ViewportPort.ts';

/**
 * Svelte implementation of ViewportPort.
 *
 * Holds references to two DOM elements that together represent the viewport:
 *
 *   - tableContainer:    the outer scroll container (provides scroll offsets
 *                        and visible dimensions)
 *   - mainGridContainer: the inner content element (provides total scrollable
 *                        dimensions, used to cap page-down / page-right)
 *
 * Both are provided post-mount via setters, because they only exist after
 * the Svelte component has been mounted to the DOM.
 */
export class SvelteViewport implements ViewportPort {
    private tableContainer: HTMLDivElement | null = null;
    private mainGridContainer: HTMLDivElement | null = null;

    setTableContainer(container: HTMLDivElement): void {
        this.tableContainer = container;
    }

    setMainGridContainer(container: HTMLDivElement): void {
        this.mainGridContainer = container;
    }

    getScrollState(): ScrollState | null {
        if (!this.tableContainer) return null;

        return {
            scrollTop: this.tableContainer.scrollTop,
            scrollLeft: this.tableContainer.scrollLeft,
            viewportHeight: this.tableContainer.clientHeight,
            viewportWidth: this.tableContainer.clientWidth,
            contentHeight: this.mainGridContainer?.clientHeight ?? 0,
            contentWidth: this.mainGridContainer?.clientWidth ?? 0,
        };
    }

    scrollTo(command: ScrollCommand): void {
        if (!this.tableContainer) return;

        this.tableContainer.scrollTo({
            top: Math.max(0, command.top),
            left: Math.max(0, command.left),
            behavior: command.behavior,
        });
    }

    focusContainer(): void {
        this.tableContainer?.focus();
    }

    getTableContainerRect(): DOMRect | null {
        return this.tableContainer?.getBoundingClientRect() ?? null;
    }
}
