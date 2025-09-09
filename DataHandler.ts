import type {
    GridPosition,
    CellComponent,
    CellValue,
    HeaderPosition,
    HeaderComponent,
    HeaderValue,
    EditingState,
} from './types';
import { CellChange, HeaderChange, ChangeSet, HistoryManager } from './HistoryManager';
import { tick } from 'svelte';

// Callback type for editing state changes
export type EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    (handler: DataHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

// Types for validation results
interface ValidationResult {
    isValid: boolean;
    value?: CellValue;
    error?: string;
    detectedType?: 'string' | 'number' | 'boolean' | 'null';
}

// Expected types for columns (can be extended later)
type ExpectedType = 'string' | 'number' | 'boolean' | 'auto';

// ==================== GENERIC TYPES FOR UNIFIED METHODS ====================

// Union types for components and values
type AnyComponent<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    | CellComponent<TExtraProps>
    | HeaderComponent<TRowHeaderProps>
    | HeaderComponent<TColHeaderProps>;

type AnyValue = CellValue | HeaderValue;
type AnyPosition = GridPosition | HeaderPosition;

// Generic interface for component changes
interface ComponentChange<T extends AnyComponent<any, any, any>> {
    component: T;
    inputValue: string;  // Always string - represents user input
}

interface ValidatedComponentChange<T extends AnyComponent<any, any, any>, V extends AnyValue>
    extends ComponentChange<T> {
    newValue: V;  // Parsed and validated value
}

// ==================== VALUE VALIDATOR CLASS ====================

class ValueValidator {
    /**
     * Parse and validate input value based on expected type or auto-detection
     */
    validate(inputValue: string, expectedType?: ExpectedType): ValidationResult {
        // Handle empty input
        if (inputValue.trim() === '') {
            return { isValid: true, value: '', detectedType: 'string' };
        }

        // If expected type is provided, try to parse to that type
        if (expectedType && expectedType !== 'auto') {
            return this.parseToSpecificType(inputValue, expectedType);
        }

        // Auto-detection: try in order of specificity
        // 1. Try number first (0 and 1 should be numbers, not booleans)
        const numberResult = this.tryParseNumber(inputValue);
        if (numberResult.isValid) return numberResult;

        // 2. Try boolean second (but exclude pure numeric strings)
        const boolResult = this.tryParseBoolean(inputValue);
        if (boolResult.isValid) return boolResult;

        // 3. Default to string (always valid)
        return { isValid: true, value: inputValue, detectedType: 'string' };
    }

    /**
     * Parse to a specific expected type
     */
    private parseToSpecificType(inputValue: string, expectedType: 'string' | 'number' | 'boolean'): ValidationResult {
        switch (expectedType) {
            case 'string':
                return { isValid: true, value: inputValue, detectedType: 'string' };

            case 'number':
                return this.tryParseNumber(inputValue);

            case 'boolean':
                return this.tryParseBoolean(inputValue);

            default:
                return { isValid: false, error: `Unknown expected type: ${expectedType}` };
        }
    }

    /**
     * Try to parse as boolean
     */
    private tryParseBoolean(inputValue: string): ValidationResult {
        const lower = inputValue.toLowerCase().trim();

        // Exclude pure numeric strings - these should be parsed as numbers
        if (/^\d+$/.test(lower)) {
            return { isValid: false, error: 'Pure numeric value, should be parsed as number' };
        }

        // True values (excluding '1' which should be a number)
        if (['true', 'yes', 'y', 'on', 'sí', 'si'].includes(lower)) {
            return { isValid: true, value: true, detectedType: 'boolean' };
        }

        // False values (excluding '0' which should be a number)
        if (['false', 'no', 'n', 'off'].includes(lower)) {
            return { isValid: true, value: false, detectedType: 'boolean' };
        }

        return { isValid: false, error: 'Not a valid boolean value' };
    }

    /**
     * Try to parse as number (integer or float)
     */
    private tryParseNumber(inputValue: string): ValidationResult {
        const trimmed = inputValue.trim();

        // Check for empty or non-numeric patterns
        if (trimmed === '' || !/^-?(\d+\.?\d*|\.\d+)$/.test(trimmed)) {
            return { isValid: false, error: 'Not a valid number' };
        }

        const parsed = Number(trimmed);

        if (isNaN(parsed) || !isFinite(parsed)) {
            return { isValid: false, error: 'Not a valid number' };
        }

        return { isValid: true, value: parsed, detectedType: 'number' };
    }

    /**
     * Parse header value - simpler validation than cells
     * @param inputValue - String value to parse
     * @returns ValidationResult with parsed value
     */
    validateHeader(inputValue: string): ValidationResult {
        const trimmed = inputValue.trim();

        // Headers cannot be empty
        if (trimmed === '') {
            return { isValid: false, error: 'Header value cannot be empty' };
        }

        // Headers should have reasonable length
        if (trimmed.length > 100) {
            return { isValid: false, error: 'Header value is too long (max 100 characters)' };
        }

        // Try to parse as number first
        const numberResult = this.tryParseNumber(trimmed);
        if (numberResult.isValid) {
            return numberResult;
        }

        // Default to string
        return { isValid: true, value: trimmed, detectedType: 'string' };
    }
}

// ==================== DATA HANDLER CLASS ====================

export default class DataHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private validator: ValueValidator;
    private historyManager: HistoryManager;
    // Separate header components by type
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent | null;

    // Centralized editing state
    private editingStateCallback?: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;

    // Editing state
    private editingState: EditingState<TExtraProps, TRowHeaderProps, TColHeaderProps> | null = null;

    constructor(
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent | null,
        editingStateCallback?: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
    ) {
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.validator = new ValueValidator();
        this.historyManager = new HistoryManager();
        this.editingStateCallback = editingStateCallback;
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


    // Helper methods for centralized editing state
    getCurrentEditingState(): EditingState<TExtraProps, TRowHeaderProps, TColHeaderProps> | null {
        return this.editingState;
    }

    getCurrentEditingCell(): CellComponent<TExtraProps> | null {
        return this.editingState?.component as CellComponent<TExtraProps> | null;
    }

    getCurrentInputHTMLElement(): HTMLInputElement | null {
        return this.editingState?.inputElement ?? null;
    }

    private notifyEditingStateChange(): void {
        if (this.editingStateCallback) {
            this.editingStateCallback(this);
        }
    }

    startEditingComponent(position: GridPosition | HeaderPosition, componentType: 'cell' | 'header', startKey?: string) {
        let component: CellComponent<TExtraProps> | HeaderComponent<TRowHeaderProps> | HeaderComponent<TColHeaderProps> | null = null;
        console.log('Attempting to start editing:', position, componentType, startKey);

        if (componentType === 'cell') {
            const key = `${(position as GridPosition).row}-${(position as GridPosition).col}`;
            component = this.cellComponents.get(key) || null;
        } else {
            component = this.getHeaderComponent(`${(position as HeaderPosition).headerType}-${(position as HeaderPosition).index}`);
        }

        if (component) {
            // End any current editing
            if (this.editingState) {
                this.endEditingComponent();
            }

            // Set new editing state
            this.editingState = {
                type: componentType,
                position: position,
                component: component,
                inputElement: null
            };
            // Wait for the DOM to update
            tick().then(() => {
                const inputElement = document.querySelector('#cell-input');
                console.log('Found input element:', inputElement);
                if (inputElement instanceof HTMLInputElement) {
                    this.editingState!.inputElement = inputElement;
                    this.editingState!.inputElement.value = startKey ?
                        (startKey === 'Backspace' ? '' : startKey) :
                        String(component.value ?? '');
                    this.editingState!.inputElement.focus();
                    this.editingState!.inputElement.select();
                }
            });
            // Notify state change
            this.notifyEditingStateChange();
        }
    }

    endEditingComponent() {
        // Clear centralized editing state regardless of position validation
        this.editingState = null;

        // Notify state change
        this.notifyEditingStateChange();
    }

    deleteCellsValues(positions: GridPosition[]) {
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

    /**
     * Parse clipboard text into 2D array for pasting
     * @param clipboardText - Text from clipboard (typically tab/newline separated)
     * @returns 2D array of parsed values
     */
    parseClipboardText(clipboardText: string): CellValue[][] {
        if (!clipboardText || clipboardText.trim() === '') {
            return [];
        }

        // Split by lines (handle different line endings)
        const lines = clipboardText.split(/\r?\n/);
        const result: CellValue[][] = [];

        for (const line of lines) {
            // Skip empty lines at the end
            if (line === '' && lines.indexOf(line) === lines.length - 1) {
                continue;
            }

            // Split by tabs (standard for spreadsheet data)
            const cells = line.split('\t');
            const rowData: CellValue[] = [];

            for (const cellText of cells) {
                // Parse each cell value - could be enhanced with type detection
                let cellValue: CellValue = cellText;

                // Basic type conversion (can be enhanced)
                if (cellText === '') {
                    cellValue = '';
                } else if (cellText.toLowerCase() === 'null' || cellText.toLowerCase() === 'undefined') {
                    cellValue = null;
                } else if (!isNaN(Number(cellText)) && cellText.trim() !== '') {
                    cellValue = Number(cellText);
                } else if (cellText.toLowerCase() === 'true') {
                    cellValue = true;
                } else if (cellText.toLowerCase() === 'false') {
                    cellValue = false;
                } else {
                    cellValue = cellText;
                }

                rowData.push(cellValue);
            }

            result.push(rowData);
        }

        return result;
    }

    /**
     * Format selected positions into clipboard text (tab-separated format)
     * @param positions - Array of grid positions to format
     * @returns Formatted string ready for clipboard
     */
    formatClipboardData(positions: GridPosition[]): string {
        if (positions.length === 0) return '';

        // Group positions by row
        const rowMap = new Map<number, GridPosition[]>();
        for (const pos of positions) {
            if (!rowMap.has(pos.row)) {
                rowMap.set(pos.row, []);
            }
            rowMap.get(pos.row)!.push(pos);
        }

        // Sort rows and create data
        const sortedRows = Array.from(rowMap.keys()).sort((a, b) => a - b);
        const rows: string[] = [];

        for (const rowNum of sortedRows) {
            const rowPositions = rowMap.get(rowNum)!.sort((a, b) => a.col - b.col);
            const rowData: string[] = [];

            for (const pos of rowPositions) {
                const key = `${pos.row}-${pos.col}`;
                const cellComponent = this.cellComponents.get(key);
                const value = cellComponent?.value ?? '';
                rowData.push(String(value));
            }

            rows.push(rowData.join('\t'));
        }

        const result = rows.join('\n');
        return result;
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
        changeType: 'single-edit' | 'paste' | 'delete' | 'format' | 'other'
    ): boolean {
        // Separate creation based on component type (no mixing allowed)
        if (componentType === 'cell') {
            const cellChanges: CellChange[] = [];

            for (const change of changes) {
                const oldValue = change.component.value;
                const newValue = change.newValue;

                // Only create change if value actually changed
                if (oldValue !== newValue) {
                    cellChanges.push(new CellChange(
                        change.component.position as GridPosition,
                        oldValue as CellValue,
                        newValue as CellValue
                    ));
                }
            }

            // If no actual changes, return early
            if (cellChanges.length === 0) {
                return true;
            }

            // Create ChangeSet for cells
            const changeSet = new ChangeSet(cellChanges, changeType);
            console.log('Committing Cell ChangeSet:', changeSet);

            // Add to history and apply
            this.historyManager.add(changeSet);
            this.applyChangeSet(changeSet, 'cell');

        } else {
            const headerChanges: HeaderChange[] = [];

            for (const change of changes) {
                const oldValue = change.component.value;
                const newValue = change.newValue;

                // Only create change if value actually changed
                if (oldValue !== newValue) {
                    headerChanges.push(new HeaderChange(
                        change.component.position as HeaderPosition,
                        oldValue as HeaderValue,
                        newValue as HeaderValue
                    ));
                }
            }

            // If no actual changes, return early
            if (headerChanges.length === 0) {
                return true;
            }

            // Create ChangeSet for headers
            const changeSet = new ChangeSet(headerChanges, changeType);
            console.log('Committing Header ChangeSet:', changeSet);

            // Add to history and apply
            this.historyManager.add(changeSet);
            this.applyChangeSet(changeSet, 'header');
        }

        return true;
    }

    // ==================== EDIT COMPLETION METHODS ====================

    /**
     * Handle end of component editing - decides whether to commit or discard based on action
     * @param position - Position of the component being edited (GridPosition or HeaderPosition)
     * @param action - What triggered the end of editing ('commit', 'cancel', 'blur')
     */
    finishComponentEdit(action: 'commit' | 'cancel' | 'blur'): boolean {
        // Validate that we're currently editing this position
        if (!this.editingState) {
            return false;
        }

        let inputValue: string | undefined;
        let commitSuccess: boolean = false;

        switch (action) {
            case 'cancel':
                // Discard changes - use centralized reset method
                this.endEditingComponent();
                return true;

            case 'commit':
                // Force commit - only if there are changes, keep in editing if validation fails
                if (this.editingState && this.editingState.inputElement) {
                    if (this.editingState.inputElement.value === String(this.editingState.component.value ?? '')) {
                        this.endEditingComponent();
                        return true;
                    }
                    inputValue = this.editingState.inputElement.value;

                    // Use unified method for both cell and header
                    const changesToCommit = [{
                        component: this.editingState.component,
                        inputValue: inputValue ?? ''
                    }];
                    commitSuccess = this.attemptCommit(changesToCommit, this.editingState.type);

                    this.endEditingComponent();
                    return commitSuccess;
                }
                return false;

            case 'blur':
                // Exit editing regardless, but only commit if validation passes and there are changes
                if (this.editingState && this.editingState.inputElement) {
                    if (this.editingState.inputElement.value === String(this.editingState.component.value ?? '')) {
                        this.endEditingComponent();
                        return true;
                    }
                    inputValue = this.editingState.inputElement.value;

                    // Use unified method for both cell and header
                    const blurChangesToCommit = [{
                        component: this.editingState.component,
                        inputValue: inputValue ?? ''
                    }];
                    commitSuccess = this.attemptCommit(blurChangesToCommit, this.editingState.type);

                    this.endEditingComponent();
                    return commitSuccess;
                }
                this.endEditingComponent();
                return true;

            default:
                return false;
        }
    }

    // ==================== HISTORY METHODS ====================

    /**
     * Undo the last change
     */
    undo(): [GridPosition[] | HeaderPosition[], 'cell' | 'header'] {
        const changeSet = this.historyManager.undo();
        // Detect type of changes (cell or header) based on first change
        let componentType: 'cell' | 'header';
        if (changeSet && changeSet.changes.length > 0) {
            const firstChange = changeSet.changes[0];
            if (firstChange.position.hasOwnProperty('row') && firstChange.position.hasOwnProperty('col')) {
                componentType = 'cell';
            } else { // Assume header if not cell
                componentType = 'header';
            }
            this.revertChangeSet(changeSet, componentType);
            // Return affected positions (we are sure it's one of the two types)
            return [changeSet.changes.map(change => change.position
                ) as (GridPosition[] | HeaderPosition[]), componentType]
        }
        return [[], 'cell']; // Return empty array and default type if no undo available
    }

    /**
     * Redo the next change
     */
    redo(): [GridPosition[] | HeaderPosition[], 'cell' | 'header'] {
        const changeSet = this.historyManager.redo();
        //  Detect type of changes (cell or header) based on first change
        let componentType: 'cell' | 'header';
        if (changeSet && changeSet.changes.length > 0) {
            const firstChange = changeSet.changes[0];
            if (firstChange.position.hasOwnProperty('row') && firstChange.position.hasOwnProperty('col')) {
                componentType = 'cell';
            } else {
                componentType = 'header';
            }
            this.applyChangeSet(changeSet, componentType);
            // Return affected positions (we are sure it's one of the two types)
            return [changeSet.changes.map(change => change.position
                ) as (GridPosition[] | HeaderPosition[]), componentType];
        }
        return [[], 'cell']; // Return empty array and default type if no redo available
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
     * Apply a change set (used for redo)
     */
    private applyChangeSet(changeSet: ChangeSet, type?: 'cell' | 'header'): void {
        for (const change of changeSet.changes) {
            if (type === 'cell') {
                this.applyCellValueDirectly(change.position as GridPosition, change.newValue);
            } else if (type === 'header') {
                this.applyHeaderValueDirectly(change.position as HeaderPosition, change.newValue as HeaderValue);
            }
        }
    }

    /**
     * Revert a change set (used for undo)
     */
    private revertChangeSet(changeSet: ChangeSet, type?: 'cell' | 'header'): void {
        // Apply changes in reverse order for complex operations
        for (let i = changeSet.changes.length - 1; i >= 0; i--) {
            const change = changeSet.changes[i];
            if (type === 'cell') {
                this.applyCellValueDirectly(change.position as GridPosition, change.oldValue);
            } else if (type === 'header') {
                this.applyHeaderValueDirectly(change.position as HeaderPosition, change.oldValue as HeaderValue);
            }
        }
    }

    /**
     * Apply a value to a cell without adding to history
     */
    private applyCellValueDirectly(position: GridPosition, value: CellValue): void {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        console.log(`Applying value directly to cell ${key}:`, value);
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

    // ==================== COMMIT METHODS ====================

    /**
     * @deprecated Use commitChanges instead - kept for backward compatibility
     * Process cell changes: create ChangeSet from changes and apply changes
     */
    commitCellChanges(
        changes: Array<{ cell: CellComponent<TExtraProps>, newValue: CellValue }>,
        type: 'single-edit' | 'paste' | 'delete' | 'format' | 'other'): boolean {
        // Convert to new format and delegate to unified method
        const unifiedChanges = changes.map(change => ({
            component: change.cell,
            inputValue: '', // Not used in commitChanges
            newValue: change.newValue
        }));

        return this.commitChanges(unifiedChanges, 'cell', type);
    }

    // ==================== IMPUTATION APIS ====================

    /**
     * Impute values for specific positions (direct API)
     * @param imputations Array of [position, value] tuples
     * @returns boolean indicating success
     */
    imputeValues(imputations: [GridPosition, CellValue][]): GridPosition[] {
        if (!imputations || imputations.length === 0) {
            return [];
        }

        const changes: Array<{ component: CellComponent<TExtraProps>, inputValue: string }> = [];

        for (const [position, newValue] of imputations) {
            const key = `${position.row}-${position.col}`;
            const cellComponent = this.cellComponents.get(key);
            if (cellComponent) {
                // Convert CellValue to string for inputValue
                const inputValue = newValue === null ? '' : String(newValue);
                changes.push({ component: cellComponent, inputValue });
            }
        }

        const success = this.attemptCommit(changes, 'cell', undefined, 'other');
        if (success) {
            // Return positions of successfully changed cells
            return changes.map(change => change.component.position);
        }
        return [];
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