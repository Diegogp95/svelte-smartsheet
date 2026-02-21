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
import { CellChange, HeaderChange, ChangeSet, HistoryManager } from '../history/HistoryManager.ts';
import { tick } from 'svelte';

// Callback type for editing state changes
export type EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> =
    (handler: DataHandler<TExtraProps, TRowHeaderProps, TColHeaderProps>) => void;

// Callback type for imputed elements changes
export type ImputedElementsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps> =
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
    private numberFormat: NumberFormat;

    constructor(numberFormat: NumberFormat) {
        this.numberFormat = numberFormat;
    }

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

        // Handle empty input
        if (trimmed === '') {
            return { isValid: false, error: 'Empty input' };
        }

        // Handle edge cases: numbers starting or ending with separators
        if (trimmed.startsWith('.') || trimmed.startsWith(',')) {
            // Handle cases like ".5" or ",5"
            const withoutLeading = trimmed.substring(1);
            if (/^\d+$/.test(withoutLeading)) {
                const value = Number('0.' + withoutLeading);
                return { isValid: true, value, detectedType: 'number' };
            }
        }

        if (trimmed.endsWith('.') || trimmed.endsWith(',')) {
            // Handle cases like "1." or "1,"
            const withoutTrailing = trimmed.substring(0, trimmed.length - 1);
            if (/^\d+$/.test(withoutTrailing)) {
                return { isValid: true, value: Number(withoutTrailing), detectedType: 'number' };
            }
        }

        // Check for basic integer (no separators)
        if (/^-?\d+$/.test(trimmed)) {
            const value = Number(trimmed);
            if (!isNaN(value) && isFinite(value)) {
                return { isValid: true, value, detectedType: 'number' };
            }
        }

        // Analyze separator positions
        const commaPositions = [...trimmed.matchAll(/,/g)].map(m => m.index!);
        const dotPositions = [...trimmed.matchAll(/\./g)].map(m => m.index!);
        const commaCount = commaPositions.length;
        const dotCount = dotPositions.length;

        // No separators case already handled above
        if (commaCount === 0 && dotCount === 0) {
            return { isValid: false, error: 'Not a valid number' };
        }

        // Mixed separators - determine format by last separator
        if (commaCount > 0 && dotCount > 0) {
            const lastComma = Math.max(...commaPositions);
            const lastDot = Math.max(...dotPositions);

            if (lastComma > lastDot) {
                // 1.000,50 → Latino format (dots=thousands, comma=decimal)
                return this.validateAndParseLatinFormat(trimmed, dotPositions, lastComma);
            } else {
                // 1,000.50 → Anglo format (commas=thousands, dot=decimal)
                return this.validateAndParseAngloFormat(trimmed, commaPositions, lastDot);
            }
        }

        // Multiple of same separator
        if (commaCount > 1 && dotCount === 0) {
            // Multiple commas → Anglo thousands format
            return this.validateAndParseThousands(trimmed, commaPositions, 'anglo');
        }

        if (dotCount > 1 && commaCount === 0) {
            // Multiple dots → Latin thousands format
            return this.validateAndParseThousands(trimmed, dotPositions, 'latin');
        }

        // Single separator - ambiguous case, use configuration
        if ((commaCount === 1 && dotCount === 0) || (dotCount === 1 && commaCount === 0)) {
            return this.parseAmbiguousSeparator(trimmed);
        }

        return { isValid: false, error: 'Invalid number format' };
    }

    /**
     * Validate and parse Latin format (dots=thousands, comma=decimal)
     */
    private validateAndParseLatinFormat(input: string, dotPositions: number[], decimalPos: number): ValidationResult {
        const beforeDecimal = input.substring(0, decimalPos);
        const afterDecimal = input.substring(decimalPos + 1);

        // Validate decimal part (only digits)
        if (!/^\d+$/.test(afterDecimal)) {
            return { isValid: false, error: 'Invalid decimal part' };
        }

        // Validate thousands part
        if (!this.validateThousandsPattern(beforeDecimal, dotPositions, '.')) {
            return { isValid: false, error: 'Invalid thousands pattern' };
        }

        // Parse: remove dots, replace comma with dot
        const normalized = input.replace(/\./g, '').replace(',', '.');
        const value = Number(normalized);

        if (isNaN(value) || !isFinite(value)) {
            return { isValid: false, error: 'Failed to parse number' };
        }

        return { isValid: true, value, detectedType: 'number' };
    }

    /**
     * Validate and parse Anglo format (commas=thousands, dot=decimal)
     */
    private validateAndParseAngloFormat(input: string, commaPositions: number[], decimalPos: number): ValidationResult {
        const beforeDecimal = input.substring(0, decimalPos);
        const afterDecimal = input.substring(decimalPos + 1);

        // Validate decimal part (only digits)
        if (!/^\d+$/.test(afterDecimal)) {
            return { isValid: false, error: 'Invalid decimal part' };
        }

        // Validate thousands part
        if (!this.validateThousandsPattern(beforeDecimal, commaPositions, ',')) {
            return { isValid: false, error: 'Invalid thousands pattern' };
        }

        // Parse: remove commas
        const normalized = input.replace(/,/g, '');
        const value = Number(normalized);

        if (isNaN(value) || !isFinite(value)) {
            return { isValid: false, error: 'Failed to parse number' };
        }

        return { isValid: true, value, detectedType: 'number' };
    }

    /**
     * Validate and parse thousands-only format
     */
    private validateAndParseThousands(input: string, positions: number[], format: NumberFormat): ValidationResult {
        const separator = format === 'latin' ? '.' : ',';

        if (!this.validateThousandsPattern(input, positions, separator)) {
            return { isValid: false, error: 'Invalid thousands pattern' };
        }

        // Parse: remove separators
        const normalized = input.replace(new RegExp('\\' + separator, 'g'), '');
        const value = Number(normalized);

        if (isNaN(value) || !isFinite(value)) {
            return { isValid: false, error: 'Failed to parse number' };
        }

        return { isValid: true, value, detectedType: 'number' };
    }

    /**
     * Validate thousands separator pattern (1-3 digits, then groups of 3)
     */
    private validateThousandsPattern(input: string, positions: number[], separator: string): boolean {
        const parts = input.split(separator);

        // First part: 1-3 digits
        if (!/^\d{1,3}$/.test(parts[0])) {
            return false;
        }

        // Subsequent parts: exactly 3 digits each
        for (let i = 1; i < parts.length; i++) {
            if (!/^\d{3}$/.test(parts[i])) {
                return false;
            }
        }

        return true;
    }

    /**
     * Parse ambiguous single separator using configuration
     */
    private parseAmbiguousSeparator(input: string): ValidationResult {
        if (this.numberFormat === 'latin') {
            if (input.includes(',')) {
                // Comma always decimal in Latin
                const normalized = input.replace(',', '.');
                const value = Number(normalized);
                if (!isNaN(value) && isFinite(value)) {
                    return { isValid: true, value, detectedType: 'number' };
                }
            } else if (input.includes('.')) {
                // Dot could be thousands or decimal - use heuristic
                const parts = input.split('.');
                const afterDot = parts[1];

                if (afterDot.length === 3) {
                    // Exactly 3 digits → thousands
                    const normalized = input.replace(/\./g, '');
                    const value = Number(normalized);
                    if (!isNaN(value) && isFinite(value)) {
                        return { isValid: true, value, detectedType: 'number' };
                    }
                } else {
                    // Not 3 digits → decimal (Anglo style exception)
                    const value = Number(input);
                    if (!isNaN(value) && isFinite(value)) {
                        return { isValid: true, value, detectedType: 'number' };
                    }
                }
            }
        } else { // anglo format
            if (input.includes('.')) {
                // Dot always decimal in Anglo
                const value = Number(input);
                if (!isNaN(value) && isFinite(value)) {
                    return { isValid: true, value, detectedType: 'number' };
                }
            } else if (input.includes(',')) {
                // Comma could be thousands or decimal - use heuristic
                const parts = input.split(',');
                const afterComma = parts[1];

                if (afterComma.length === 3) {
                    // Exactly 3 digits → thousands
                    const normalized = input.replace(/,/g, '');
                    const value = Number(normalized);
                    if (!isNaN(value) && isFinite(value)) {
                        return { isValid: true, value, detectedType: 'number' };
                    }
                } else {
                    // Not 3 digits → decimal (Latin style exception)
                    const normalized = input.replace(',', '.');
                    const value = Number(normalized);
                    if (!isNaN(value) && isFinite(value)) {
                        return { isValid: true, value, detectedType: 'number' };
                    }
                }
            }
        }

        return { isValid: false, error: 'Failed to parse ambiguous number' };
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
    private instanceId: string;
    private numberFormat: NumberFormat = 'anglo'; // Default number format

    // Centralized editing state
    private editingStateCallback?: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;

    // Imputed elements tracking (separated by type)
    private imputedCells: Set<string>;
    private imputedRowHeaders: Set<string>;
    private imputedColHeaders: Set<string>;
    private imputedElementsCallback?: ImputedElementsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>;

    // Editing state
    private editingState: EditingState<TExtraProps, TRowHeaderProps, TColHeaderProps> | null = null;

    constructor(
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent | null,
        instanceId: string,
        numberFormat: NumberFormat = 'anglo',
        editingStateCallback?: EditingStateCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        imputedElementsCallback?: ImputedElementsCallback<TExtraProps, TRowHeaderProps, TColHeaderProps>,
    ) {
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.instanceId = instanceId;
        this.numberFormat = numberFormat;
        this.validator = new ValueValidator(numberFormat);
        this.historyManager = new HistoryManager();
        this.editingStateCallback = editingStateCallback;
        this.imputedCells = new Set<string>();
        this.imputedRowHeaders = new Set<string>();
        this.imputedColHeaders = new Set<string>();
        this.imputedElementsCallback = imputedElementsCallback;
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
                // Use the appropriate ID based on component type
                const inputSelector = componentType === 'cell'
                    ? `#cell-input-${this.instanceId}`
                    : `#header-input-${this.instanceId}`;

                const inputElement = document.querySelector(inputSelector);
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
                // Parse each cell value using the centralized validator
                let cellValue: CellValue = cellText;

                // Handle special null/undefined cases before validation
                if (cellText.toLowerCase() === 'null' || cellText.toLowerCase() === 'undefined') {
                    cellValue = null;
                } else {
                    // Use the validator with auto-detection for consistent parsing
                    const validationResult = this.validator.validate(cellText, 'auto');

                    // If validation succeeds, use the parsed value; otherwise keep original text
                    cellValue = validationResult.isValid ? validationResult.value! : cellText;
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

            // Add to history and apply
            this.historyManager.add(changeSet);
            this.applyChangeSet(changeSet, 'cell');

            // Update imputed elements and notify
            this.updateImputedElements();
            if (this.imputedElementsCallback) {
                this.imputedElementsCallback(this);
            }

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

            // Add to history and apply
            this.historyManager.add(changeSet);
            this.applyChangeSet(changeSet, 'header');

            // Update imputed elements and notify
            this.updateImputedElements();
            if (this.imputedElementsCallback) {
                this.imputedElementsCallback(this);
            }
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

            // Update imputed elements and notify (same as commitChanges)
            this.updateImputedElements();
            if (this.imputedElementsCallback) {
                this.imputedElementsCallback(this);
            }

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

            // Update imputed elements and notify (same as commitChanges)
            this.updateImputedElements();
            if (this.imputedElementsCallback) {
                this.imputedElementsCallback(this);
            }

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

    // ==================== TRANSLATION METHODS ====================
    /**
     * This section defines methods for translating between cell positions
     * and different representations (e.g., A1 notation, row/col indices).
     */

    private groupPositionsByRow(positions: GridPosition[]): Map<number, GridPosition[]> {
        const rowMap = new Map<number, GridPosition[]>();
        for (const pos of positions) {
            if (!rowMap.has(pos.row)) {
                rowMap.set(pos.row, []);
            }
            rowMap.get(pos.row)!.push(pos);
        }
        return rowMap;
    }

    private groupPositionsByCol(positions: GridPosition[]): Map<number, GridPosition[]> {
        const colMap = new Map<number, GridPosition[]>();
        for (const pos of positions) {
            if (!colMap.has(pos.col)) {
                colMap.set(pos.col, []);
            }
            colMap.get(pos.col)!.push(pos);
        }
        return colMap;
    }

    private lookForRowHeader(row: number): HeaderValue | null {
        return this.rowHeaderComponents.get(`row-${row}`)?.value ?? null;
    }

    private lookForColHeader(col: number): HeaderValue | null {
        return this.colHeaderComponents.get(`col-${col}`)?.value ?? null;
    }

    /**
     * Core translation logic - processes positions and applies a transformation function
     * @param positions Array of GridPosition to process
     * @param agrupation 'row' | 'col' grouping mode
     * @param processGroup Function to process each primary group
     * @returns Generic result type
     */
    private translatePositionsCore<T>(
        positions: GridPosition[],
        agrupation: 'row' | 'col',
        processGroup: (
            primaryKey: string,
            posArray: GridPosition[],
            getSecondaryHeader: (index: number) => HeaderValue | null,
            getSecondaryIndex: (pos: GridPosition) => number,
            secondaryHeaderCache: Map<number, HeaderValue | null>
        ) => T
    ): { [primaryHeader: string]: T } {
        const result: { [primaryHeader: string]: T } = {};

        // Get grouped positions and define header lookup functions based on agrupation
        const { groupedMap, getPrimaryHeader, getSecondaryHeader, getSecondaryIndex } =
            agrupation === 'row'
                ? {
                    groupedMap: this.groupPositionsByRow(positions),
                    getPrimaryHeader: (index: number) => this.lookForRowHeader(index),
                    getSecondaryHeader: (index: number) => this.lookForColHeader(index),
                    getSecondaryIndex: (pos: GridPosition) => pos.col
                }
                : {
                    groupedMap: this.groupPositionsByCol(positions),
                    getPrimaryHeader: (index: number) => this.lookForColHeader(index),
                    getSecondaryHeader: (index: number) => this.lookForRowHeader(index),
                    getSecondaryIndex: (pos: GridPosition) => pos.row
                };

        // Cache primary headers to avoid repeated lookups
        const primaryHeaderCache = new Map<number, HeaderValue | null>();

        for (const [primaryIndex, posArray] of groupedMap.entries()) {
            // Get or cache primary header
            let primaryHeader = primaryHeaderCache.get(primaryIndex);
            if (primaryHeader === undefined) {
                primaryHeader = getPrimaryHeader(primaryIndex);
                primaryHeaderCache.set(primaryIndex, primaryHeader);
            }

            if (primaryHeader !== null) {
                const primaryKey = String(primaryHeader);
                // Cache secondary headers for this group's positions
                const secondaryHeaderCache = new Map<number, HeaderValue | null>();

                // Apply specific processing logic for this group
                result[primaryKey] = processGroup(
                    primaryKey,
                    posArray,
                    getSecondaryHeader,
                    getSecondaryIndex,
                    secondaryHeaderCache
                );
            }
        }
        return result;
    }

    public translatePositionsToData(
        positions: GridPosition[],
        agrupation: 'row' | 'col' = 'row'
    ): { [primaryHeader: string]: { [secondaryHeader: string]: CellValue } } {
        return this.translatePositionsCore(
            positions,
            agrupation,
            (primaryKey, posArray, getSecondaryHeader, getSecondaryIndex, secondaryHeaderCache) => {
                const groupData: { [secondaryHeader: string]: CellValue } = {};

                for (const pos of posArray) {
                    const key = `${pos.row}-${pos.col}`;
                    const cellComponent = this.cellComponents.get(key);

                    if (cellComponent) {
                        // Get or cache secondary header
                        const secondaryIndex = getSecondaryIndex(pos);
                        let secondaryHeader = secondaryHeaderCache.get(secondaryIndex);
                        if (secondaryHeader === undefined) {
                            secondaryHeader = getSecondaryHeader(secondaryIndex);
                            secondaryHeaderCache.set(secondaryIndex, secondaryHeader);
                        }

                        if (secondaryHeader !== null) {
                            const secondaryKey = String(secondaryHeader);
                            groupData[secondaryKey] = cellComponent.value ?? '';
                        }
                    }
                }

                return groupData;
            }
        );
    }

    public translatePositionsToListedHeaders(
        positions: GridPosition[],
        agrupation: 'row' | 'col' = 'row'
    ): { [primaryHeader: string]: HeaderValue[] } {
        return this.translatePositionsCore(
            positions,
            agrupation,
            (primaryKey, posArray, getSecondaryHeader, getSecondaryIndex, secondaryHeaderCache) => {
                const headers: HeaderValue[] = [];
                const addedHeaders = new Set<string>();

                for (const pos of posArray) {
                    const cellComponent = this.cellComponents.get(`${pos.row}-${pos.col}`);

                    if (cellComponent) {
                        // Get or cache secondary header
                        const secondaryIndex = getSecondaryIndex(pos);
                        let secondaryHeader = secondaryHeaderCache.get(secondaryIndex);
                        if (secondaryHeader === undefined) {
                            secondaryHeader = getSecondaryHeader(secondaryIndex);
                            secondaryHeaderCache.set(secondaryIndex, secondaryHeader);
                        }

                        if (secondaryHeader !== null) {
                            const secondaryKey = String(secondaryHeader);
                            if (!addedHeaders.has(secondaryKey)) {
                                headers.push(secondaryHeader);
                                addedHeaders.add(secondaryKey);
                            }
                        }
                    }
                }

                return headers;
            }
        );
    }

    public translateIndicesToHeaderValues(
        indices: number[],
        headerType: 'row' | 'col'
    ): HeaderValue[] {
        const headers: HeaderValue[] = [];
        const headerMap = headerType === 'row' ? this.rowHeaderComponents : this.colHeaderComponents;

        for (const index of indices) {
            const header = headerMap.get(`${headerType}-${index}`);
            if (header) {
                headers.push(header.value);
            }
        }

        return headers;
    }

    // ==================== DATA EXTRACTION METHODS ====================

    /**
     * Extract cells whose values where changed across the entire grid and history
     * @returns Array of GridPosition for cells that have been changed
     */
    extractChangedCells(): GridPosition[] {
        return this.historyManager.getChangedCells();
    }

    // ==================== IMPUTED ELEMENTS METHODS ====================

    /**
     * Get all imputed cells as Set for efficient lookup
     * @returns Set of string keys in format "row-col" for cells that have been imputed
     */
    getImputedCells(): Set<string> {
        return new Set(this.imputedCells);
    }

    /**
     * Get all imputed row headers as Set for efficient lookup
     * @returns Set of string keys in format "headerType-index" for row headers that have been imputed
     */
    getImputedRowHeaders(): Set<string> {
        return new Set(this.imputedRowHeaders);
    }

    /**
     * Get all imputed column headers as Set for efficient lookup
     * @returns Set of string keys in format "headerType-index" for column headers that have been imputed
     */
    getImputedColHeaders(): Set<string> {
        return new Set(this.imputedColHeaders);
    }

    /**
     * Update imputed elements sets based on history manager data
     * This method synchronizes the internal sets with all changed elements in history
     */
    private updateImputedElements(): void {
        // Clear current sets
        this.imputedCells.clear();
        this.imputedRowHeaders.clear();
        this.imputedColHeaders.clear();

        // Get all changed elements from history manager
        const changedElements = this.historyManager.getChangedElements();

        // Populate cells set
        for (const cellPos of changedElements.cells) {
            this.imputedCells.add(`${cellPos.row}-${cellPos.col}`);
        }

        // Populate row headers set
        for (const headerPos of changedElements.rowHeaders) {
            this.imputedRowHeaders.add(`${headerPos.headerType}-${headerPos.index}`);
        }

        // Populate column headers set
        for (const headerPos of changedElements.colHeaders) {
            this.imputedColHeaders.add(`${headerPos.headerType}-${headerPos.index}`);
        }
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