import type { GridPosition, GridDimensions } from '../types/types.ts';
import { Selection } from './Selection.ts';

export class HeaderSelection {
    // Direction of the header selection (row or column)
    private direction: 'row' | 'col';

    // Range defined by start and end indices
    private startIndex!: number;
    private endIndex!: number;

    // Set of header indices in this selection
    private headerIndices: Set<number>;

    // Grid area for header subgrid CSS grid layout
    private headerGridArea!: {
        rowStart: number;
        rowEnd: number;
        colStart: number;
        colEnd: number;
    };

    // Internal Selection that represents the cells affected by this header selection
    // This Selection is ALWAYS inactive (isActive: false) as it's only for derived cell calculations
    private cellSelection: Selection;

    constructor(
        direction: 'row' | 'col',
        startIndex: number,
        endIndex: number,
        gridDimensions: GridDimensions,
    ) {
        this.direction = direction;
        this.headerIndices = new Set<number>();

        // First, set bounds and calculate header-specific data
        this.updateBounds(startIndex, endIndex);

        // Then create internal cell selection based on calculated bounds
        // NOTE: cellSelection is ALWAYS inactive (false) - it's only for derived cell calculations
        this.cellSelection = this.createCellSelectionFromHeaders(gridDimensions, false);
    }

    // Update selection bounds and recalculate indices (header-specific only)
    updateBounds(startIndex: number, endIndex: number): void {
        this.startIndex = Math.min(startIndex, endIndex);
        this.endIndex = Math.max(startIndex, endIndex);
        this.recalculateHeaderIndices();
        this.updateHeaderGridArea();
    }

    // Update bounds and automatically sync the internal cellSelection
    updateBoundsWithSync(startIndex: number, endIndex: number, gridDimensions: GridDimensions): void {
        // Update header bounds first
        this.updateBounds(startIndex, endIndex);

        // Then sync the cellSelection with new bounds
        this.updateCellSelection(gridDimensions);
    }

    // Update the cell selection when bounds change
    updateCellSelection(gridDimensions: GridDimensions): void {
        const { topLeft, bottomRight } = this.calculateCellBounds(gridDimensions);
        this.cellSelection.updateBounds(topLeft, bottomRight);
    }

    contains(index: number): boolean {
        return this.headerIndices.has(index);
    }

    getHeaderIndices(): Set<number> {
        return new Set(this.headerIndices);
    }

    getHeaderArea(): { indexStart: number; indexEnd: number; type: 'row' | 'col' } {
        return {
            indexStart: this.startIndex,
            indexEnd: this.endIndex,
            type: this.direction
        };
    }

    getBounds(): { startIndex: number, endIndex: number } {
        return {
            startIndex: this.startIndex,
            endIndex: this.endIndex
        };
    }

    getDirection(): 'row' | 'col' {
        return this.direction;
    }

    // Delegate cell-related methods to internal Selection
    getCells(): Set<string> {
        return this.cellSelection.getCells();
    }

    getCellBounds(): { topLeft: GridPosition, bottomRight: GridPosition } {
        return this.cellSelection.getBounds();
    }

    // Get the internal cell selection (for derived cell visualization)
    getCellSelection(): Selection {
        return this.cellSelection;
    }

    getGridArea(): { rowStart: number, rowEnd: number, colStart: number, colEnd: number } {
        return this.cellSelection.getGridArea();
    }

    // Get grid area specifically for header subgrid positioning
    getHeaderGridArea(): { rowStart: number, rowEnd: number, colStart: number, colEnd: number } {
        return { ...this.headerGridArea };
    }

    // Create a Selection instance that represents all cells in the selected headers
    // This Selection is ALWAYS inactive as it's only used for derived cell calculations
    private createCellSelectionFromHeaders(gridDimensions: GridDimensions, isActive: boolean): Selection {
        const { topLeft, bottomRight } = this.calculateCellBounds(gridDimensions);
        return new Selection(topLeft, bottomRight);
    }

    // Calculate the cell bounds that correspond to this header selection
    private calculateCellBounds(gridDimensions: GridDimensions): { topLeft: GridPosition, bottomRight: GridPosition } {
        if (this.direction === 'row') {
            // Row selection: all columns in the selected rows
            return {
                topLeft: { row: this.startIndex, col: 0 },
                bottomRight: { row: this.endIndex, col: gridDimensions.maxCol }
            };
        } else {
            // Column selection: all rows in the selected columns
            return {
                topLeft: { row: 0, col: this.startIndex },
                bottomRight: { row: gridDimensions.maxRow , col: this.endIndex }
            };
        }
    }

    // Recalculate header indices based on current bounds
    private recalculateHeaderIndices(): void {
        this.headerIndices.clear();
        for (let i = this.startIndex; i <= this.endIndex; i++) {
            this.headerIndices.add(i);
        }
    }

    // Update header grid area for CSS grid positioning
    private updateHeaderGridArea(): void {
        if (this.direction === 'row') {
            // Row headers: span across the row indices, single column
            this.headerGridArea = {
                rowStart: this.startIndex + 1, // 1-based for CSS grid
                rowEnd: this.endIndex + 2, // +2 because end is exclusive
                colStart: 1, // Row headers are in column 1 of header subgrid
                colEnd: 2 // Single column span
            };
        } else {
            // Column headers: span across the column indices, single row
            this.headerGridArea = {
                rowStart: 1, // Column headers are in row 1 of header subgrid
                rowEnd: 2, // Single row span
                colStart: this.startIndex + 1, // 1-based for CSS grid
                colEnd: this.endIndex + 2 // +2 because end is exclusive
            };
        }
    }

    // Fragment this selection excluding a given range
    fragmentExcluding(excludeRange: { startIndex: number, endIndex: number }, gridDimensions: GridDimensions): HeaderSelection[] {
        const fragments: HeaderSelection[] = [];

        const excludeStart = excludeRange.startIndex;
        const excludeEnd = excludeRange.endIndex;

        // Calculate intersection
        const intersectStart = Math.max(this.startIndex, excludeStart);
        const intersectEnd = Math.min(this.endIndex, excludeEnd);

        // Check if there is no intersection
        const noIntersection = intersectStart > intersectEnd;

        if (noIntersection) {
            // No intersection, return original selection as single fragment
            return [this];
        }

        // Check if the selection is fully covered by the exclusion
        const fullCover =
            intersectStart === this.startIndex &&
            intersectEnd === this.endIndex;

        if (fullCover) {
            // Fully covered, return empty array
            return [];
        }

        // Left fragment (before exclusion)
        if (this.startIndex < intersectStart) {
            fragments.push(new HeaderSelection(
                this.direction,
                this.startIndex,
                intersectStart - 1,
                gridDimensions,
            ));
        }

        // Right fragment (after exclusion)
        if (intersectEnd < this.endIndex) {
            fragments.push(new HeaderSelection(
                this.direction,
                intersectEnd + 1,
                this.endIndex,
                gridDimensions,
            ));
        }

        return fragments;
    }
}
