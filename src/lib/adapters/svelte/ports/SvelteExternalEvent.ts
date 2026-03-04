import type { ExternalEventPort } from '../../../core/ports/ExternalEventPort.ts';

/**
 * Svelte implementation of ExternalEventPort.
 *
 * Manages event listener registration against real DOM elements.
 * The table container is provided post-mount via setTableContainer(),
 * because it only exists after the Svelte component has been mounted to the DOM.
 *
 * Internal handler references are kept to allow exact-reference removeEventListener calls.
 */
export class SvelteExternalEvent implements ExternalEventPort {
    private tableContainer: HTMLDivElement | null = null;

    // Stored references needed for removeEventListener exact-match
    private mouseEnterHandler: ((event: MouseEvent) => void) | null = null;
    private mouseLeaveHandler: ((event: MouseEvent) => void) | null = null;
    private documentMouseMoveHandler: ((event: MouseEvent) => void) | null = null;

    setTableContainer(container: HTMLDivElement): void {
        this.tableContainer = container;
    }

    registerTableListeners(
        onMouseEnter: (event: MouseEvent) => void,
        onMouseLeave: (event: MouseEvent) => void,
    ): void {
        if (!this.tableContainer) {
            console.warn('[SvelteExternalEvent] tableContainer not set — cannot register table listeners');
            return;
        }

        // Unregister any stale listeners before adding new ones (idempotency)
        this.unregisterTableListeners();

        this.mouseEnterHandler = onMouseEnter;
        this.mouseLeaveHandler = onMouseLeave;

        this.tableContainer.addEventListener('mouseenter', this.mouseEnterHandler);
        this.tableContainer.addEventListener('mouseleave', this.mouseLeaveHandler);
    }

    unregisterTableListeners(): void {
        if (!this.tableContainer) return;

        if (this.mouseEnterHandler) {
            this.tableContainer.removeEventListener('mouseenter', this.mouseEnterHandler);
            this.mouseEnterHandler = null;
        }
        if (this.mouseLeaveHandler) {
            this.tableContainer.removeEventListener('mouseleave', this.mouseLeaveHandler);
            this.mouseLeaveHandler = null;
        }
    }

    registerDocumentMouseMove(handler: (event: MouseEvent) => void): void {
        // Unregister stale listener if present (idempotency)
        this.unregisterDocumentMouseMove();

        this.documentMouseMoveHandler = handler;
        document.addEventListener('mousemove', this.documentMouseMoveHandler);
    }

    unregisterDocumentMouseMove(): void {
        if (this.documentMouseMoveHandler) {
            document.removeEventListener('mousemove', this.documentMouseMoveHandler);
            this.documentMouseMoveHandler = null;
        }
    }
}
