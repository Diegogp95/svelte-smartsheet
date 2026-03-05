import type { GridPosition, GridDimensions } from '../types/types.ts';
import { Selection } from './Selection.ts';
import { HeaderSelection } from './HeaderSelection.ts';

export interface DeselectionResult {
    selections: Selection[];
    headerSelectionsRows: HeaderSelection[];
    headerSelectionsCols: HeaderSelection[];
    activeSelection: Selection | HeaderSelection | null;
}

/**
 * Owns the deselection lifecycle: state tracking (isActive, current deselection area),
 * and the pure transformation logic that fragments existing selections around the
 * deselection rectangle. Returns new state without mutating the caller.
 */
export class DeselectionManager {
    private isDeselectingState: boolean = false;
    private deselection: Selection | null = null;
    private headerDeselection: HeaderSelection | null = null;

    get isActive(): boolean {
        return this.isDeselectingState;
    }

    activate(): void {
        this.isDeselectingState = true;
    }

    deactivate(): void {
        this.isDeselectingState = false;
    }

    // ==================== CELL DESELECTION ====================

    startCellDeselection(anchor: GridPosition, pointer: GridPosition): void {
        this.deselection = new Selection(anchor, pointer);
    }

    updateCellDeselection(anchor: GridPosition, pointer: GridPosition): void {
        if (this.deselection) {
            this.deselection.updateBounds(anchor, pointer);
        } else {
            this.startCellDeselection(anchor, pointer);
        }
    }

    clearCellDeselection(): void {
        this.deselection = null;
    }

    getDeselection(): Selection | null {
        return this.deselection;
    }

    // ==================== HEADER DESELECTION ====================

    startHeaderDeselection(type: 'row' | 'col', anchor: number, pointer: number, gridDimensions: GridDimensions): void {
        this.headerDeselection = new HeaderSelection(type, anchor, pointer, gridDimensions);
    }

    updateHeaderDeselection(type: 'row' | 'col', anchor: number, pointer: number, gridDimensions: GridDimensions): void {
        if (this.headerDeselection && this.headerDeselection.getDirection() === type) {
            this.headerDeselection.updateBoundsWithSync(anchor, pointer, gridDimensions);
        } else {
            this.startHeaderDeselection(type, anchor, pointer, gridDimensions);
        }
    }

    clearHeaderDeselection(): void {
        this.headerDeselection = null;
    }

    getHeaderDeselection(): HeaderSelection | null {
        return this.headerDeselection;
    }

    // ==================== APPLY DESELECTION ====================

    /**
     * Applies the current cell deselection area to all existing selections,
     * fragmenting them around the deselection rectangle.
     * Returns the new selection state without mutating the input arrays.
     */
    applyCellDeselection(
        selections: Selection[],
        headerSelectionsRows: HeaderSelection[],
        headerSelectionsCols: HeaderSelection[],
        activeSelection: Selection | HeaderSelection | null
    ): DeselectionResult {
        if (!this.deselection) {
            return { selections, headerSelectionsRows, headerSelectionsCols, activeSelection };
        }

        const deselectionBounds = this.deselection.getBounds();
        let currentActive = activeSelection;
        const newSelections: Selection[] = [];
        const newRowHeaderSelections: HeaderSelection[] = [];
        const newColHeaderSelections: HeaderSelection[] = [];

        // Fragment regular cell selections
        for (const selection of selections) {
            const [fragments, updatedActive] = this.fragmentRegularSelection(selection, deselectionBounds, currentActive);
            currentActive = updatedActive;
            newSelections.push(...fragments);
        }

        // Fragment row header selections → cell fragments
        for (const headerSelection of headerSelectionsRows) {
            const [kept, cellFragments, updatedActive] = this.fragmentHeaderSelectionToCells(headerSelection, deselectionBounds, currentActive);
            currentActive = updatedActive;
            if (kept) newRowHeaderSelections.push(kept);
            newSelections.push(...cellFragments);
        }

        // Fragment col header selections → cell fragments
        for (const headerSelection of headerSelectionsCols) {
            const [kept, cellFragments, updatedActive] = this.fragmentHeaderSelectionToCells(headerSelection, deselectionBounds, currentActive);
            currentActive = updatedActive;
            if (kept) newColHeaderSelections.push(kept);
            newSelections.push(...cellFragments);
        }

        return {
            selections: newSelections,
            headerSelectionsRows: newRowHeaderSelections,
            headerSelectionsCols: newColHeaderSelections,
            activeSelection: this.resolveActive(currentActive, newSelections, newRowHeaderSelections, newColHeaderSelections)
        };
    }

    /**
     * Applies the current header deselection area to all existing selections.
     * Fragments same-type header selections by header range, opposite-type by cell bounds,
     * and regular cell selections by cell bounds.
     */
    applyHeaderDeselection(
        selections: Selection[],
        headerSelectionsRows: HeaderSelection[],
        headerSelectionsCols: HeaderSelection[],
        activeSelection: Selection | HeaderSelection | null,
        gridDimensions: GridDimensions
    ): DeselectionResult {
        if (!this.headerDeselection) {
            return { selections, headerSelectionsRows, headerSelectionsCols, activeSelection };
        }

        const headerType = this.headerDeselection.getDirection();
        const cellDeselectionBounds = this.headerDeselection.getCellBounds();
        const headerDeselectionBounds = this.headerDeselection.getBounds();

        let currentActive = activeSelection;
        const newSelections: Selection[] = [];
        const newSameTypeSelections: HeaderSelection[] = [];
        const newOppositeTypeSelections: HeaderSelection[] = [];

        // Fragment regular cell selections by cell bounds
        for (const selection of selections) {
            const [fragments, updatedActive] = this.fragmentRegularSelection(selection, cellDeselectionBounds, currentActive);
            currentActive = updatedActive;
            newSelections.push(...fragments);
        }

        // Fragment same-type header selections by header range
        const sameTypeSelections = headerType === 'row' ? headerSelectionsRows : headerSelectionsCols;
        for (const headerSelection of sameTypeSelections) {
            const fragments = headerSelection.fragmentExcluding(headerDeselectionBounds, gridDimensions);
            if (currentActive === headerSelection) {
                if (fragments.length > 0 && currentActive !== fragments[0]) {
                    currentActive = fragments[0];
                } else if (fragments.length === 0) {
                    currentActive = null;
                }
            }
            newSameTypeSelections.push(...fragments);
        }

        // Fragment opposite-type header selections → cell fragments
        const oppositeTypeSelections = headerType === 'row' ? headerSelectionsCols : headerSelectionsRows;
        for (const headerSelection of oppositeTypeSelections) {
            const [kept, cellFragments, updatedActive] = this.fragmentHeaderSelectionToCells(headerSelection, cellDeselectionBounds, currentActive);
            currentActive = updatedActive;
            if (kept) newOppositeTypeSelections.push(kept);
            newSelections.push(...cellFragments);
        }

        const newRowHeaderSelections = headerType === 'row' ? newSameTypeSelections : newOppositeTypeSelections;
        const newColHeaderSelections = headerType === 'row' ? newOppositeTypeSelections : newSameTypeSelections;

        return {
            selections: newSelections,
            headerSelectionsRows: newRowHeaderSelections,
            headerSelectionsCols: newColHeaderSelections,
            activeSelection: this.resolveActive(currentActive, newSelections, newRowHeaderSelections, newColHeaderSelections)
        };
    }

    // ==================== PRIVATE HELPERS ====================

    private fragmentRegularSelection(
        selection: Selection,
        deselectionBounds: { topLeft: GridPosition; bottomRight: GridPosition },
        activeSelection: Selection | HeaderSelection | null
    ): [Selection[], Selection | HeaderSelection | null] {
        const fragments = selection.fragmentExcluding(deselectionBounds);
        let updatedActive = activeSelection;

        if (activeSelection === selection) {
            if (fragments.length > 0 && activeSelection !== fragments[0]) {
                updatedActive = fragments[0];
            } else if (fragments.length === 0) {
                updatedActive = null;
            }
        }

        return [fragments, updatedActive];
    }

    private fragmentHeaderSelectionToCells(
        headerSelection: HeaderSelection,
        deselectionBounds: { topLeft: GridPosition; bottomRight: GridPosition },
        activeSelection: Selection | HeaderSelection | null
    ): [HeaderSelection | null, Selection[], Selection | HeaderSelection | null] {
        const cellSelection = headerSelection.getCellSelection();
        const cellFragments = cellSelection.fragmentExcluding(deselectionBounds);

        // No intersection: header selection is unaffected
        if (cellFragments.length === 1 && cellFragments[0] === cellSelection) {
            return [headerSelection, [], activeSelection];
        }

        let updatedActive = activeSelection;
        if (activeSelection === headerSelection) {
            updatedActive = cellFragments[0] || null;
        }

        return [null, cellFragments, updatedActive];
    }

    private resolveActive(
        current: Selection | HeaderSelection | null,
        selections: Selection[],
        rowHeaderSelections: HeaderSelection[],
        colHeaderSelections: HeaderSelection[]
    ): Selection | HeaderSelection | null {
        if (current) return current;
        if (selections.length > 0) return selections[selections.length - 1];
        if (rowHeaderSelections.length > 0) return rowHeaderSelections[rowHeaderSelections.length - 1];
        if (colHeaderSelections.length > 0) return colHeaderSelections[colHeaderSelections.length - 1];
        return null;
    }
}
