/**
 * Port definition: InputActivationPort
 *
 * Abstracts the platform-specific interaction with the editing input element.
 * The core defines what it needs (this interface); each adapter provides its own implementation.
 *
 * Responsibilities delegated to the adapter:
 * - Framework-specific rendering timing (e.g., Svelte's tick(), React's flushSync(), etc.)
 * - DOM element lookup and lifecycle management
 * - Input focus, selection, and value initialization
 */
export interface InputActivationPort {
    /**
     * Activates the input element after an editing session begins.
     * The adapter is responsible for any necessary timing delay before accessing the DOM
     * (e.g., waiting for the framework's next render cycle).
     *
     * @param componentType Whether the input belongs to a cell or a header
     * @param initialValue  The value to pre-fill the input with on activation
     */
    activateInput(componentType: 'cell' | 'header', initialValue: string): Promise<void>;

    /**
     * Returns the current value entered by the user in the active input.
     * Returns null if no input is currently active (e.g., activation is still pending).
     */
    getInputValue(): string | null;

    /**
     * Called when the editing session ends, regardless of commit or cancel.
     * The adapter should release its internal reference to the input element.
     */
    deactivateInput(): void;
}
