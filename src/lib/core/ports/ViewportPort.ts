/**
 * Port definition: ViewportPort
 *
 * Abstracts all interaction with the scrollable container that wraps the grid.
 * Both NavigationHandler and VirtualizeHandler consume this port.
 *
 * Four operations are represented here, all related to viewport management
 * during navigation and virtualization:
 *
 *   - Reading viewport state (scroll offsets + visible dimensions)
 *   - Commanding a programmatic scroll
 *   - Focusing the container (keyboard navigation activation)
 *   - Retrieving the bounding rectangle of the scroll container
 *
 * `contentHeight` / `contentWidth` correspond to the inner grid element
 * (not the scroll container itself). They are used to compute the maximum
 * reachable scroll position when navigating page-down / page-right.
 */

export interface ScrollState {
    scrollTop: number;
    scrollLeft: number;
    viewportHeight: number;  // visible height of the scroll container (clientHeight)
    viewportWidth: number;   // visible width  of the scroll container (clientWidth)
    contentHeight: number;   // total scrollable height of the inner grid (clientHeight of main grid)
    contentWidth: number;    // total scrollable width  of the inner grid (clientWidth  of main grid)
}

export interface ScrollCommand {
    top: number;
    left: number;
    behavior: 'smooth' | 'instant';
}

export interface ViewportPort {
    /**
     * Returns a snapshot of the current scroll and size state.
     * Called on demand — not event-driven — so the implementation must
     * read live values from the DOM at the moment of the call.
     * Returns null if the container is not yet available (pre-mount).
     */
    getScrollState(): ScrollState | null;

    /**
     * Applies a programmatic scroll to the container.
     * The implementation decides how to map the command to the DOM
     * (e.g., container.scrollTo, or a framework-managed scroll).
     * No-op if the container is not yet available.
     */
    scrollTo(command: ScrollCommand): void;

    /**
     * Moves focus to the scroll container so keyboard events are captured.
     * No-op if the container is not yet available.
     */
    focusContainer(): void;

    /**
     * Returns the bounding DOMRect of the scroll container.
     * Used by MouseEventTranslator to map mouse coordinates to grid positions.
     * Returns null if the container is not yet available (pre-mount).
     */
    getTableContainerRect(): DOMRect | null;
}
