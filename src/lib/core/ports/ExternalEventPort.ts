/**
 * Port definition: ExternalEventPort
 *
 * Abstracts the registration and removal of DOM event listeners that the
 * NavigationHandler needs during drag operations but that live outside the
 * component's own boundaries.
 *
 * Two listener groups are managed here:
 *
 * 1. Table-boundary listeners (mouseenter / mouseleave on the scroll container):
 *    Detect when the pointer crosses the edge of the grid during a drag, which
 *    triggers the outside-dragging auto-scroll mode.
 *
 * 2. Document-level mousemove listener:
 *    Active only while the pointer is outside the table during a drag. Feeds
 *    movement data back to NavigationHandler so it can compute scroll direction
 *    and speed.
 *
 * Note on MouseEvent: this is a standard browser type shared by all web adapters.
 * Abstracting it further would add complexity with no practical benefit, since
 * this library targets browser environments by design.
 */
export interface ExternalEventPort {
    /**
     * Registers mouseenter and mouseleave handlers on the scroll container.
     * Called once at the beginning of every drag operation.
     * Multiple calls without an interleaved unregister must be idempotent.
     */
    registerTableListeners(
        onMouseEnter: (event: MouseEvent) => void,
        onMouseLeave: (event: MouseEvent) => void,
    ): void;

    /**
     * Removes the handlers registered by registerTableListeners.
     * Safe to call even if no listeners are currently registered.
     */
    unregisterTableListeners(): void;

    /**
     * Registers a mousemove handler on the document.
     * Called when the pointer leaves the table mid-drag.
     */
    registerDocumentMouseMove(handler: (event: MouseEvent) => void): void;

    /**
     * Removes the handler registered by registerDocumentMouseMove.
     * Safe to call even if no listener is currently registered.
     */
    unregisterDocumentMouseMove(): void;
}
