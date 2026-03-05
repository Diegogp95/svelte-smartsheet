/**
 * Port definition: ClipboardPort
 *
 * Abstracts the registration of document-level clipboard event listeners
 * (copy, cut, paste) that the controller needs while navigation is active.
 *
 * The core is responsible for:
 *   - Deciding WHEN to activate clipboard interception (navigation mode on/off)
 *   - Providing the callbacks that carry out the actual data operations
 *     (read/write via DataHandler, format, delete cells, etc.)
 *
 * The adapter is responsible for:
 *   - Attaching and detaching the real DOM event listeners on `document`
 *   - Calling event.preventDefault() / event.stopPropagation() so the
 *     browser default clipboard handling does not fire
 *   - Extracting the text payload from ClipboardEvent and forwarding it
 *   - Writing the formatted text back into ClipboardEvent.clipboardData
 *
 * Note: ClipboardEvent is a standard browser type available in all
 * web environments — abstracting it further would add complexity with
 * no practical benefit for this library.
 */
export interface ClipboardPort {
    /**
     * Register document-level clipboard listeners.
     * The adapter will call the supplied callbacks when the corresponding
     * clipboard events fire. Multiple calls without an interleaved
     * unregister must be idempotent.
     *
     * @param onPaste  Called with the plain-text payload extracted from the paste event.
     * @param onCopy   Called so the core can provide the text to place on the clipboard;
     *                 the adapter is expected to write the returned string back to the event.
     * @param onCut    Same as onCopy but the core also deletes the source cells.
     */
    registerClipboardListeners(
        onPaste: (text: string) => void,
        onCopy: () => string,
        onCut: () => string,
    ): void;

    /**
     * Unregister the listeners previously set by registerClipboardListeners.
     * Safe to call even if no listeners are currently registered.
     */
    unregisterClipboardListeners(): void;
}
