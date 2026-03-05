import type { ClipboardPort } from '../../../core/ports/ClipboardPort.ts';

/**
 * Svelte adapter for ClipboardPort.
 *
 * Attaches document-level copy/cut/paste listeners while navigation mode is
 * active, then removes them when it ends or the component is disposed.
 *
 * All DOM interaction (addEventListener, preventDefault, clipboardData access)
 * is centralised here so the core remains free of browser-specific concerns.
 */
export class SvelteClipboard implements ClipboardPort {
    private pasteListener: ((event: ClipboardEvent) => void) | null = null;
    private copyListener:  ((event: ClipboardEvent) => void) | null = null;
    private cutListener:   ((event: ClipboardEvent) => void) | null = null;

    registerClipboardListeners(
        onPaste: (text: string) => void,
        onCopy:  () => string,
        onCut:   () => string,
    ): void {
        // Idempotent: skip if already registered
        if (this.pasteListener) return;

        this.pasteListener = (event: ClipboardEvent) => {
            event.preventDefault();
            event.stopPropagation();
            const text = event.clipboardData?.getData('text/plain') ?? '';
            onPaste(text);
        };

        this.copyListener = (event: ClipboardEvent) => {
            event.preventDefault();
            event.stopPropagation();
            const text = onCopy();
            event.clipboardData?.setData('text/plain', text);
        };

        this.cutListener = (event: ClipboardEvent) => {
            event.preventDefault();
            event.stopPropagation();
            const text = onCut();
            event.clipboardData?.setData('text/plain', text);
        };

        document.addEventListener('paste', this.pasteListener, { capture: true });
        document.addEventListener('copy',  this.copyListener,  { capture: true });
        document.addEventListener('cut',   this.cutListener,   { capture: true });
    }

    unregisterClipboardListeners(): void {
        if (this.pasteListener) {
            document.removeEventListener('paste', this.pasteListener, { capture: true });
            this.pasteListener = null;
        }
        if (this.copyListener) {
            document.removeEventListener('copy', this.copyListener, { capture: true });
            this.copyListener = null;
        }
        if (this.cutListener) {
            document.removeEventListener('cut', this.cutListener, { capture: true });
            this.cutListener = null;
        }
    }
}
