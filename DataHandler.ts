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
        console.log(`[ValueValidator] Validating: "${inputValue}" (expected: ${expectedType || 'auto'})`);

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

    setCellEditing(position: GridPosition) {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (cellComponent) {
            if (this.editingCell) {
                this.setCellNotEditing(this.editingCell.position);
            }
            this.editingCell = cellComponent;
            cellComponent.setEditing(true);
            cellComponent.setInputFocus();
            console.log(`[DataHandler] setCellEditing: Cell at ${key} is now in editing mode.`);
        }
    }

    setCellNotEditing(position: GridPosition) {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (cellComponent && cellComponent.editing) {
            cellComponent.setEditing(false);
            console.log(`[DataHandler] setCellNotEditing: Cell at ${key} is no longer in editing mode.`);
            // Clear editingCell reference if it matches
            if (this.editingCell && 
                this.editingCell.position.row === position.row && 
                this.editingCell.position.col === position.col) {
                this.editingCell = null;
            }
        } else {
            console.log(`[DataHandler] setCellNotEditing: Cell at ${key} was already not editing.`);
        }
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
            console.log(`[DataHandler] finishCellEdit: Cell ${key} is not being edited`);
            return false;
        }

        console.log(`[DataHandler] Finishing cell edit at ${key} with action: ${action}`);

        switch (action) {
            case 'cancel':
                // Discard changes - revert inputValue to original value
                cellComponent.setInputValue(cellComponent.value);
                this.setCellNotEditingDirect(cellComponent);
                console.log(`[DataHandler] Cell edit cancelled at ${key}`);
                return true;

            case 'commit':
                // Force commit - only if there are changes, keep in editing if validation fails
                if (cellComponent.inputValue === cellComponent.value) {
                    this.setCellNotEditingDirect(cellComponent);
                    return true;
                }
                const commitSuccess = this.attemptCommitCells([cellComponent], expectedType);
                if (commitSuccess) {
                    this.setCellNotEditingDirect(cellComponent);
                }
                return commitSuccess;

            case 'blur':
                // Exit editing regardless, but only commit if validation passes and there are changes
                if (cellComponent.inputValue === cellComponent.value) {
                    this.setCellNotEditingDirect(cellComponent);
                    return true;
                }
                this.attemptCommitCells([cellComponent], expectedType);
                this.setCellNotEditingDirect(cellComponent);
                return true; // Always return true for blur, even if commit failed

            default:
                console.error(`[DataHandler] Unknown action: ${action}`);
                return false;
        }
    }

    /**
     * Set cell not editing - works directly with cell component
     */
    private setCellNotEditingDirect(cellComponent: CellComponent): void {
        if (cellComponent.editing) {
            cellComponent.setEditing(false);
            console.log(`[DataHandler] setCellNotEditingDirect: Cell at ${cellComponent.position.row}-${cellComponent.position.col} is no longer in editing mode.`);

            // Clear editingCell reference if it matches
            if (this.editingCell && 
                this.editingCell.position.row === cellComponent.position.row && 
                this.editingCell.position.col === cellComponent.position.col) {
                this.editingCell = null;
            }
        }
    }

    /**
     * Attempt to commit multiple cell edits - if any fails, entire commit fails
     */
    private attemptCommitCells(cells: CellComponent[], expectedType?: ExpectedType): boolean {
        console.log(`[DataHandler] Attempting to commit ${cells.length} cells`);

        // First pass: validate all cells
        for (const cell of cells) {
            const inputValue = cell.inputValue;
            const inputString = inputValue === null ? '' : String(inputValue);
            const validationResult = this.validator.validate(inputString, expectedType);

            if (!validationResult.isValid) {
                console.log(`[DataHandler] Validation failed for cell ${cell.position.row}-${cell.position.col}: ${validationResult.error}`);
                // If any cell fails validation, fail entire commit
                return false;
            }
        }

        // All validations passed, commit the changes
        return this.commitCellChanges(cells, 'single-edit');
    }

    // ==================== HISTORY METHODS ====================

    /**
     * Undo the last change
     */
    undo(): boolean {
        const changeSet = this.historyManager.undo();
        if (changeSet) {
            console.log(`[DataHandler] Undoing ${changeSet.changes.length} changes`);
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
            console.log(`[DataHandler] Redoing ${changeSet.changes.length} changes`);
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
     * Get history debug information
     */
    getHistoryInfo(): object {
        return this.historyManager.getDebugInfo();
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
            console.log(`[DataHandler] Applied value ${JSON.stringify(value)} to cell ${key}`);
        } else {
            console.warn(`[DataHandler] Cannot apply value: cell ${key} not found`);
        }
    }

    // ==================== COMMIT METHODS ====================

    /**
     * Process cell changes: create ChangeSet from cells and apply changes
     */
    commitCellChanges(cells: CellComponent[], type: 'single-edit' | 'paste' | 'delete' | 'format' | 'other'): boolean {
        console.log(`[DataHandler] Processing ${cells.length} cells for commit`);

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
            console.log(`[DataHandler] No actual changes detected, skipping commit`);
            return true;
        }

        // Create ChangeSet
        const changeSet = new ChangeSet(changes, type);

        // Add to history
        this.historyManager.add(changeSet);

        // Apply changes
        this.applyChangeSet(changeSet);

        console.log(`[DataHandler] Successfully committed ${changes.length} changes`);
        return true;
    }

}