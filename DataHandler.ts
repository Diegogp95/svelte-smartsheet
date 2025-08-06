import type {
    GridPosition,
    CellComponent,
    CellValue,
} from './types';
import { CellChange, ChangeSet, HistoryManager } from './HistoryManager';

// Types for validation results
interface ValidationResult {
    isValid: boolean;
    value?: CellValue;
    error?: string;
    detectedType?: 'string' | 'number' | 'boolean' | 'null';
}

// Expected types for columns (can be extended later)
type ExpectedType = 'string' | 'number' | 'boolean' | 'auto';

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
        // 1. Try boolean first (most specific)
        const boolResult = this.tryParseBoolean(inputValue);
        if (boolResult.isValid) return boolResult;

        // 2. Try number (integers and floats)
        const numberResult = this.tryParseNumber(inputValue);
        if (numberResult.isValid) return numberResult;

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

        // True values
        if (['true', '1', 'yes', 'y', 'on', 'sí', 'si'].includes(lower)) {
            return { isValid: true, value: true, detectedType: 'boolean' };
        }

        // False values
        if (['false', '0', 'no', 'n', 'off'].includes(lower)) {
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
}

// ==================== DATA HANDLER CLASS ====================

export default class DataHandler {
    private cellComponents: Map<string, CellComponent>;
    private editingCell: CellComponent | null = null;
    private validator: ValueValidator;
    private historyManager: HistoryManager;

    constructor(cellComponents: Map<string, CellComponent>) {
        this.cellComponents = cellComponents;
        this.validator = new ValueValidator();
        this.historyManager = new HistoryManager();
    }

    private setCellEditing(cellComponent: CellComponent): void {
        if (!cellComponent.editing) {
            cellComponent.setEditing(true);
        }
        this.editingCell = cellComponent;
    }

    private setCellNotEditing(cellComponent: CellComponent): void {
        if (cellComponent.editing) {
            cellComponent.setEditing(false);
            // Clear editingCell reference if it matches
            if (this.editingCell &&
                this.editingCell.position.row === cellComponent.position.row &&
                this.editingCell.position.col === cellComponent.position.col) {
                this.editingCell = null;
            }
        }
    }

    startEditingCell(position: GridPosition, startKey?: string) {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (cellComponent) {
            if (this.editingCell) {
                this.endEditingCell(this.editingCell.position);
            }
            this.setCellEditing(cellComponent);
            cellComponent.setInputFocus();
            if (startKey) {
                // Set initial input value based on startKey or erase existing value if key is backspace
                cellComponent.setInputValue(startKey === 'Backspace' ? '' : startKey);
            }
        }
    }

    endEditingCell(position: GridPosition) {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (cellComponent && cellComponent.editing) {
            cellComponent.setEditing(false);
            // Clear editingCell reference if it matches
            if (this.editingCell && 
                this.editingCell.position.row === position.row && 
                this.editingCell.position.col === position.col) {
                this.editingCell = null;
            }
        }
    }

    /**
     * Generate changes for a cell by setting its inputValue to newValue.
     * For artificially generating changes (like deletion), this method can be used
     * and take advantage of existing commit/validation logic.
     */
    generateChangesCell(position: GridPosition, newValue: CellValue): CellComponent | null {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (!cellComponent) {
            return null;
        }
        const oldValue = cellComponent.value;
        // Set inputValue to null to use existing methods
        cellComponent.setInputValue(newValue);

        return cellComponent;
    }

    deleteCellsValues(positions: GridPosition[]) {
        const changedCells: CellComponent[] = [];
        for (const position of positions) {
            const cellComponent = this.generateChangesCell(position, null);
            if (cellComponent) {
                changedCells.push(cellComponent);
            }
        }
        const commitSuccess = this.attemptCommitCells(changedCells, undefined, 'delete');
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

        const changedCells: CellComponent[] = [];
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

                const pasteValue = rowData[colOffset];
                const cellComponent = this.generateChangesCell(targetPosition, pasteValue);

                if (cellComponent) {
                    changedCells.push(cellComponent);
                }
            }
        }

        if (changedCells.length === 0) {
            return false;
        }

        // Attempt to commit all changes
        const commitSuccess = this.attemptCommitCells(changedCells, expectedType, 'paste');
        if (commitSuccess) {
        }

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
                const value = cellComponent?.value || '';
                rowData.push(String(value));
            }

            rows.push(rowData.join('\t'));
        }

        const result = rows.join('\n');
        return result;
    }

    // ==================== EDIT COMPLETION METHODS ====================

    /**
     * Handle end of cell editing - decides whether to commit or discard based on action
     * @param position - Position of the cell being edited
     * @param action - What triggered the end of editing ('commit', 'cancel', 'blur')
     * @param expectedType - Optional expected type for validation
     */
    finishCellEdit(position: GridPosition, action: 'commit' | 'cancel' | 'blur', expectedType?: ExpectedType): boolean {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);

        if (!cellComponent || !cellComponent.editing) {
            return false;
        }

        switch (action) {
            case 'cancel':
                // Discard changes - revert inputValue to original value
                cellComponent.setInputValue(cellComponent.value);
                this.setCellNotEditing(cellComponent);
                return true;

            case 'commit':
                // Force commit - only if there are changes, keep in editing if validation fails
                if (cellComponent.inputValue === cellComponent.value) {
                    this.setCellNotEditing(cellComponent);
                    return true;
                }
                const commitSuccess = this.attemptCommitCells([cellComponent], expectedType);
                if (commitSuccess) {
                    this.setCellNotEditing(cellComponent);
                }
                return commitSuccess;

            case 'blur':
                // Exit editing regardless, but only commit if validation passes and there are changes
                if (cellComponent.inputValue === cellComponent.value) {
                    this.setCellNotEditing(cellComponent);
                    return true;
                }
                this.attemptCommitCells([cellComponent], expectedType);
                this.setCellNotEditing(cellComponent);
                return true; // Always return true for blur, even if commit failed

            default:
                return false;
        }
    }

    /**
     * Attempt to commit multiple cell edits - if any fails, entire commit fails
     */
    private attemptCommitCells(cells: CellComponent[], expectedType?: ExpectedType,
        changeType: 'single-edit' | 'paste' | 'delete' | 'format' | 'other' = 'single-edit'): boolean {

        // First pass: validate all cells
        for (const cell of cells) {
            const inputValue = cell.inputValue;
            const inputString = inputValue === null ? '' : String(inputValue);
            const validationResult = this.validator.validate(inputString, expectedType);

            if (!validationResult.isValid) {
                // If any cell fails validation, fail entire commit
                return false;
            }
        }

        // All validations passed, commit the changes
        return this.commitCellChanges(cells, changeType);
    }

    // ==================== HISTORY METHODS ====================

    /**
     * Undo the last change
     */
    undo(): boolean {
        const changeSet = this.historyManager.undo();
        if (changeSet) {
            this.revertChangeSet(changeSet);
            return true;
        }
        return false;
    }

    /**
     * Redo the next change
     */
    redo(): boolean {
        const changeSet = this.historyManager.redo();
        if (changeSet) {
            this.applyChangeSet(changeSet);
            return true;
        }
        return false;
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
    private applyChangeSet(changeSet: ChangeSet): void {
        for (const change of changeSet.changes) {
            this.applyCellValueDirectly(change.position, change.newValue);
        }
    }

    /**
     * Revert a change set (used for undo)
     */
    private revertChangeSet(changeSet: ChangeSet): void {
        // Apply changes in reverse order for complex operations
        for (let i = changeSet.changes.length - 1; i >= 0; i--) {
            const change = changeSet.changes[i];
            this.applyCellValueDirectly(change.position, change.oldValue);
        }
    }

    /**
     * Apply a value to a cell without adding to history
     */
    private applyCellValueDirectly(position: GridPosition, value: CellValue): void {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (cellComponent) {
            // Update both value and inputValue to keep them in sync
            cellComponent.setValue(value);
            cellComponent.setInputValue(value);
        }
    }

    // ==================== COMMIT METHODS ====================

    /**
     * Process cell changes: create ChangeSet from cells and apply changes
     */
    commitCellChanges(cells: CellComponent[], type: 'single-edit' | 'paste' | 'delete' | 'format' | 'other'): boolean {
        // Create CellChange array from cells using their interface
        const changes: CellChange[] = [];

        for (const cell of cells) {
            const oldValue = cell.value;
            const newValue = cell.inputValue;

            // Only create change if value actually changed
            if (oldValue !== newValue) {
                changes.push(new CellChange(cell.position, oldValue, newValue));
            }
        }

        // If no actual changes, return early
        if (changes.length === 0) {
            return true;
        }

        // Create ChangeSet
        const changeSet = new ChangeSet(changes, type);

        // Add to history
        this.historyManager.add(changeSet);

        // Apply changes
        this.applyChangeSet(changeSet);

        return true;
    }

}