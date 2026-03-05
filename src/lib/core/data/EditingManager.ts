import type {
    GridPosition,
    CellComponent,
    HeaderComponent,
    HeaderPosition,
    EditingState,
} from '../types/types.ts';
import type { InputActivationPort } from '../ports/InputActivationPort.ts';

/**
 * EditingManager — owns the in-progress editing lifecycle for a single component
 * (cell or header) at a time.
 *
 * Manages editing state and delegates DOM-level activation/deactivation
 * to the InputActivationPort. Fires a notification callback on every state
 * change so DataHandler (and through it the adapter) can react.
 */
export class EditingManager<TExtraProps, TRowHeaderProps, TColHeaderProps> {
    private editingState: EditingState<TExtraProps, TRowHeaderProps, TColHeaderProps> | null = null;
    private inputActivationPort?: InputActivationPort;

    /**
     * @param onStateChange Called every time editing starts or ends,
     *   so the outer orchestrator can broadcast the new state to the UI.
     */
    constructor(private readonly onStateChange: () => void) {}

    setInputActivationPort(port: InputActivationPort): void {
        this.inputActivationPort = port;
    }

    getState(): EditingState<TExtraProps, TRowHeaderProps, TColHeaderProps> | null {
        return this.editingState;
    }

    getCurrentEditingCell(): CellComponent<TExtraProps> | null {
        if (this.editingState?.type === 'cell') {
            return this.editingState.component as CellComponent<TExtraProps>;
        }
        return null;
    }

    /** Returns the current live input value from the DOM, or null if not editing. */
    getInputValue(): string | null {
        return this.inputActivationPort?.getInputValue() ?? null;
    }

    start(
        component: CellComponent<TExtraProps> | HeaderComponent<TRowHeaderProps> | HeaderComponent<TColHeaderProps>,
        componentType: 'cell' | 'header',
        position: GridPosition | HeaderPosition,
        startKey?: string,
    ): void {
        if (this.editingState) this.end();

        this.editingState = { type: componentType, position, component };

        const initialValue = startKey
            ? (startKey === 'Backspace' ? '' : startKey)
            : String(component.value ?? '');

        this.inputActivationPort?.activateInput(componentType, initialValue);
        this.onStateChange();
    }

    end(): void {
        this.editingState = null;
        this.inputActivationPort?.deactivateInput();
        this.onStateChange();
    }
}
