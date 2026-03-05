import type {
    GridPosition,
    CellComponent,
    CellValue,
    HeaderPosition,
    HeaderComponent,
    HeaderValue,
    EditingState,
    NumberFormat,
} from '../types/types.ts';
import { HistoryManager, type ChangeOrigin } from '../history/HistoryManager.ts';
import { ValueValidator, type ExpectedType } from './ValueValidator.ts';
import { ClipboardParser } from './ClipboardParser.ts';
import { DataTranslator } from './DataTranslator.ts';
import { ImputationTracker } from './ImputationTracker.ts';
import { EditingManager } from './EditingManager.ts';
import type { InputActivationPort } from '../ports/InputActivationPort.ts';

// Callback type for editing state changes
export type EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    (handler: DataHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

// Callback type for imputed elements changes
export type ImputedElementsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    (handler: DataHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

// ==================== GENERIC TYPES FOR UNIFIED METHODS ====================

// Union types for components and values
type AnyComponent<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    | CellComponent<TExtraProps>
    | HeaderComponent<TRowHeaderProps>
    | HeaderComponent<TColHeaderProps>;

type AnyValue = CellValue | HeaderValue;

// Generic interface for component changes
interface ComponentChange<T extends AnyComponent<any, any, any>> {
    component: T;
    inputValue: string;  // Always string - represents user input
}

interface ValidatedComponentChange<T extends AnyComponent<any, any, any>, V extends AnyValue>
    extends ComponentChange<T> {
    newValue: V;  // Parsed and validated value
}

// ==================== DATA HANDLER CLASS ====================

/**
 * Entry point to the data domain. Owns the core data structures and orchestrates interactions between
 * editing, validation, history, translation, and imputation.
 *
 * Responsibilities:
 *  - Manage cell and header values.
 *  - Handle editing lifecycle and delegate to EditingManager.
 *  - Validate user input and manage value changes.
 *  - Track history and support undo/redo operations.
 *  - Translate data between different formats.
 *  - Track and manage imputed values.
 *  - Interact directly with the history domain.
 */

export default class DataHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent | null;

    private readonly validator: ValueValidator;
    private readonly historyManager: HistoryManager;
    private readonly clipboardParser: ClipboardParser;
    private readonly dataTranslator: DataTranslator<TExtraProps, TRowHeaderProps, TColHeaderProps>;
    private readonly imputationTracker: ImputationTracker;
    private readonly editingManager: EditingManager<TExtraProps, TRowHeaderProps, TColHeaderProps>;

    private imputedElementsCallback?: ImputedElementsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;

    constructor(
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent | null,
        numberFormat: NumberFormat = 'anglo',
        editingStateCallback?: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        imputedElementsCallback?: ImputedElementsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
    ) {
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.imputedElementsCallback = imputedElementsCallback;

        this.validator = new ValueValidator(numberFormat);
        this.historyManager = new HistoryManager();
        this.clipboardParser = new ClipboardParser(this.validator);
        this.dataTranslator = new DataTranslator(cellComponents, rowHeaderComponents, colHeaderComponents);
        this.imputationTracker = new ImputationTracker(this.historyManager);
        this.editingManager = new EditingManager(
            () => { if (editingStateCallback) editingStateCallback(this); }
        );
    }

    // Helper method to get header component from any of the header maps
    private getHeaderComponent(key: string): HeaderComponent<any> | null {
        // Try row headers
        let headerComponent: HeaderComponent<any> | undefined = this.rowHeaderComponents.get(key);
        if (headerComponent) return headerComponent;

        // Try column headers
        headerComponent = this.colHeaderComponents.get(key);
        if (headerComponent) return headerComponent;

        // Try corner header if the key matches
        if (this.cornerHeaderComponent) {
            const cornerKey = `${this.cornerHeaderComponent.position.headerType}-${this.cornerHeaderComponent.position.index}`;
            if (key === cornerKey) return this.cornerHeaderComponent;
        }

        return null;
    }


    // ==================== EDITING ====================

    getCurrentEditingState(): EditingState<TExtraProps, TRowHeaderProps, TColHeaderProps> | null {
        return this.editingManager.getState();
    }

    getCurrentEditingCell(): CellComponent<TExtraProps> | null {
        return this.editingManager.getCurrentEditingCell();
    }

    setInputActivationPort(port: InputActivationPort): void {
        this.editingManager.setInputActivationPort(port);
    }

    startEditingComponent(position: GridPosition | HeaderPosition, componentType: 'cell' | 'header', startKey?: string) {
        let component: CellComponent<TExtraProps> | HeaderComponent<TRowHeaderProps> | HeaderComponent<TColHeaderProps> | null = null;

        if (componentType === 'cell') {
            const key = `${(position as GridPosition).row}-${(position as GridPosition).col}`;
            component = this.cellComponents.get(key) || null;
        } else {
            component = this.getHeaderComponent(`${(position as HeaderPosition).headerType}-${(position as HeaderPosition).index}`);
        }

        if (component) {
            this.editingManager.start(component, componentType, position, startKey);
        }
    }

    endEditingComponent() {
        this.editingManager.end();
    }

    deleteCellsValues(positions: GridPosition[]): boolean {
        const changes: Array<{ component: CellComponent<TExtraProps>, inputValue: string }> = [];
        for (const position of positions) {
            const key = `${position.row}-${position.col}`;
            const cellComponent = this.cellComponents.get(key);
            if (cellComponent) {
                // Use empty string as inputValue which will be validated as null/empty
                changes.push({ component: cellComponent, inputValue: '' });
            }
        }

        const commitSuccess = this.attemptCommit(changes, 'cell', undefined, 'delete');
        return commitSuccess;
    }

    /**
     * Paste data starting from a specific position
     * @param startPosition - Position where paste operation begins (top-left corner)
     * @param pasteData - 2D array of values to paste [row][col]
     * @param expectedType - Optional expected type for validation
     * @returns boolean indicating success
     */
    paste(startPosition: GridPosition, pasteData: CellValue[][], expectedType?: ExpectedType): boolean {
        if (!pasteData || pasteData.length === 0) {
            return false;
        }

        const changes: Array<{ component: CellComponent<TExtraProps>, inputValue: string }> = [];
        const maxRows = pasteData.length;

        // Process each row of paste data
        for (let rowOffset = 0; rowOffset < maxRows; rowOffset++) {
            const rowData = pasteData[rowOffset];
            if (!rowData || rowData.length === 0) continue;

            const maxCols = rowData.length;

            // Process each column in the current row
            for (let colOffset = 0; colOffset < maxCols; colOffset++) {
                const targetPosition: GridPosition = {
                    row: startPosition.row + rowOffset,
                    col: startPosition.col + colOffset
                };

                const key = `${targetPosition.row}-${targetPosition.col}`;
                const cellComponent = this.cellComponents.get(key);

                if (cellComponent) {
                    const pasteValue = rowData[colOffset];
                    // Convert CellValue to string for inputValue
                    const inputValue = pasteValue === null ? '' : String(pasteValue);
                    changes.push({ component: cellComponent, inputValue });
                }
            }
        }

        if (changes.length === 0) {
            return false;
        }

        // Attempt to commit all changes using unified method
        const commitSuccess = this.attemptCommit(changes, 'cell', expectedType, 'paste');

        return commitSuccess;
    }


    // ==================== CLIPBOARD ====================

    parseClipboardText(clipboardText: string): CellValue[][] {
        return this.clipboardParser.parse(clipboardText);
    }

    formatClipboardData(positions: GridPosition[]): string {
        return this.clipboardParser.format(positions, this.cellComponents);
    }

    // ==================== UNIFIED GENERIC METHODS ====================

    /**
     * Unified attempt to commit changes for both cells and headers
     */
    private attemptCommit<
        T extends AnyComponent<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        V extends AnyValue
    >(
        changes: Array<ComponentChange<T>>,
        componentType: 'cell' | 'header',
        expectedType?: ExpectedType,
        changeType: 'single-edit' | 'paste' | 'delete' | 'format' | 'other' = 'single-edit'
    ): boolean {
        // First pass: validate all changes and prepare commit data
        const validatedChanges: Array<ValidatedComponentChange<T, V>> = [];

        for (const change of changes) {
            // Discriminación solo en validación
            const validationResult = componentType === 'cell'
                ? this.validator.validate(change.inputValue, expectedType)
                : this.validator.validateHeader(change.inputValue);

            if (!validationResult.isValid) {
                // If any change fails validation, fail entire commit
                return false;
            }

            // Add validated change with parsed value
            validatedChanges.push({
                ...change,
                newValue: validationResult.value! as V
            });
        }

        // All validations passed, commit the changes
        return this.commitChanges(validatedChanges, componentType, changeType);
    }

    /**
     * Unified commit changes for both cells and headers
     */
    private commitChanges<
        T extends AnyComponent<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        V extends AnyValue
    >(
        changes: Array<ValidatedComponentChange<T, V>>,
        componentType: 'cell' | 'header',
        changeOrigin: ChangeOrigin
    ): boolean {
        if (componentType === 'cell') {
            const rawChanges = changes
                .filter(c => c.component.value !== c.newValue)
                .map(c => ({
                    position: c.component.position as GridPosition,
                    oldValue: c.component.value as CellValue,
                    newValue: c.newValue as CellValue,
                }));

            if (rawChanges.length === 0) return true;

            this.historyManager.recordCellChanges(rawChanges, changeOrigin);
            for (const c of rawChanges) this.applyCellValueDirectly(c.position, c.newValue);
        } else {
            const rawChanges = changes
                .filter(c => c.component.value !== c.newValue)
                .map(c => ({
                    position: c.component.position as HeaderPosition,
                    oldValue: c.component.value as HeaderValue,
                    newValue: c.newValue as HeaderValue,
                }));

            if (rawChanges.length === 0) return true;

            this.historyManager.recordHeaderChanges(rawChanges, changeOrigin);
            for (const c of rawChanges) this.applyHeaderValueDirectly(c.position, c.newValue);
        }

        this.afterCommit();
        return true;
    }

    private afterCommit() {
        this.imputationTracker.sync();
        if (this.imputedElementsCallback) this.imputedElementsCallback(this);
    }

    // ==================== EDIT COMPLETION METHODS ====================

    /**
     * Handle end of component editing - decides whether to commit or discard based on action
     * @param position - Position of the component being edited (GridPosition or HeaderPosition)
     * @param action - What triggered the end of editing ('commit', 'cancel', 'blur')
     */
    finishComponentEdit(action: 'commit' | 'cancel' | 'blur'): boolean {
        const state = this.editingManager.getState();
        if (!state) return false;

        switch (action) {
            case 'cancel':
                this.editingManager.end();
                return true;

            case 'commit': {
                const inputValue = this.editingManager.getInputValue();
                if (inputValue === null) return false;
                if (inputValue === String(state.component.value ?? '')) {
                    this.editingManager.end();
                    return true;
                }
                const commitSuccess = this.attemptCommit(
                    [{ component: state.component, inputValue }],
                    state.type,
                );
                this.editingManager.end();
                return commitSuccess;
            }

            case 'blur': {
                const inputValue = this.editingManager.getInputValue();
                if (inputValue === null) {
                    this.editingManager.end();
                    return true;
                }
                if (inputValue === String(state.component.value ?? '')) {
                    this.editingManager.end();
                    return true;
                }
                const commitSuccess = this.attemptCommit(
                    [{ component: state.component, inputValue }],
                    state.type,
                );
                this.editingManager.end();
                return commitSuccess;
            }

            default:
                return false;
        }
    }

    // ==================== HISTORY METHODS ====================

    /**
     * Undo the last change
     */
    undo(): [GridPosition[] | HeaderPosition[], 'cell' | 'header'] {
        const result = this.historyManager.undo();
        if (!result) return [[], 'cell'];

        if (result.type === 'cell') {
            for (let i = result.changes.length - 1; i >= 0; i--) {
                this.applyCellValueDirectly(result.changes[i].position, result.changes[i].oldValue);
            }
            this.afterCommit();
            return [result.changes.map(c => c.position), 'cell'];
        } else {
            for (let i = result.changes.length - 1; i >= 0; i--) {
                this.applyHeaderValueDirectly(result.changes[i].position, result.changes[i].oldValue);
            }
            this.afterCommit();
            return [result.changes.map(c => c.position), 'header'];
        }
    }

    /**
     * Redo the next change
     */
    redo(): [GridPosition[] | HeaderPosition[], 'cell' | 'header'] {
        const result = this.historyManager.redo();
        if (!result) return [[], 'cell'];

        if (result.type === 'cell') {
            for (const c of result.changes) this.applyCellValueDirectly(c.position, c.newValue);
            this.afterCommit();
            return [result.changes.map(c => c.position), 'cell'];
        } else {
            for (const c of result.changes) this.applyHeaderValueDirectly(c.position, c.newValue);
            this.afterCommit();
            return [result.changes.map(c => c.position), 'header'];
        }
    }

    /**
     * Check if undo is available
     */
    canUndo(): boolean {
        return this.historyManager.canUndo();
    }

    /**
     * Check if redo is available
     */
    canRedo(): boolean {
        return this.historyManager.canRedo();
    }

    /**
     * Clear all history
     */
    clearHistory(): void {
        this.historyManager.clear();
    }

    /**
     * Apply a value to a cell without adding to history
     */
    private applyCellValueDirectly(position: GridPosition, value: CellValue): void {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (cellComponent) {
            // Update the cell's value directly
            cellComponent.value = value;
        }
    }

    /**
     * Apply a value to a header without adding to history
     */
    private applyHeaderValueDirectly(position: HeaderPosition, value: HeaderValue): void {
        const key = `${position.headerType}-${position.index}`;
        const headerComponent = this.getHeaderComponent(key);
        if (headerComponent) {
            // Update the header's value directly
            headerComponent.value = value;
        }
    }

    // ==================== TRANSLATION METHODS ====================

    public translatePositionsToData(
        positions: GridPosition[],
        agrupation: 'row' | 'col' = 'row'
    ): { [primaryHeader: string]: { [secondaryHeader: string]: CellValue } } {
        return this.dataTranslator.translatePositionsToData(positions, agrupation);
    }

    public translatePositionsToListedHeaders(
        positions: GridPosition[],
        agrupation: 'row' | 'col' = 'row'
    ): { [primaryHeader: string]: HeaderValue[] } {
        return this.dataTranslator.translatePositionsToListedHeaders(positions, agrupation);
    }

    public translateIndicesToHeaderValues(
        indices: number[],
        headerType: 'row' | 'col'
    ): HeaderValue[] {
        return this.dataTranslator.translateIndicesToHeaderValues(indices, headerType);
    }

    // ==================== DATA EXTRACTION METHODS ====================

    extractChangedCells(): GridPosition[] {
        return this.historyManager.getChangedCells();
    }

    // ==================== IMPUTED ELEMENTS METHODS ====================

    getImputedCells(): Set<string> {
        return this.imputationTracker.getImputedCells();
    }

    getImputedRowHeaders(): Set<string> {
        return this.imputationTracker.getImputedRowHeaders();
    }

    getImputedColHeaders(): Set<string> {
        return this.imputationTracker.getImputedColHeaders();
    }

    // ==================== IMPUTATION APIS ====================

    /**
     * Impute values for specific positions (direct API)
     * @param imputations Array of [position, value] tuples
     * @returns boolean indicating success
     */
    imputeValues(imputations: [GridPosition, CellValue][]): GridPosition[] {
        if (!imputations || imputations.length === 0) return [];

        const changes: Array<{ component: CellComponent<TExtraProps>, inputValue: string }> = [];
        for (const [position, newValue] of imputations) {
            const key = `${position.row}-${position.col}`;
            const cellComponent = this.cellComponents.get(key);
            if (cellComponent) {
                changes.push({ component: cellComponent, inputValue: newValue === null ? '' : String(newValue) });
            }
        }

        const cursorBefore = this.historyManager.getCursor();
        const success = this.attemptCommit(changes, 'cell', undefined, 'other');
        if (!success) return [];
        if (this.historyManager.getCursor() === cursorBefore) return [];
        return this.historyManager.getLastCommittedCellPositions();
    }

    /**
     * Impute values using a generator function (smart API)
     * @param imputationGenerator Function that receives cell components and returns [position, value] tuples
     * @returns boolean indicating success
     */
    applyImputations(
        imputationGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, CellValue][]
    ): GridPosition[] {
        const imputations = imputationGenerator(this.cellComponents);
        return this.imputeValues(imputations);
    }

}
