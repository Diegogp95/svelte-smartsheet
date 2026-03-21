import type { GridPosition } from '../types/types.ts';
import { positionToKey } from '../utils/utils.ts';

export class Selection {
    // Rectangular selection defined by two corners
    private topLeft!: GridPosition;
    private bottomRight!: GridPosition;

    // Set of cells in this selection
    private cells: Set<string>;

    // Headers affected by this selection (derived)
    private affectedRowHeaders: Set<number>;
    private affectedColHeaders: Set<number>;

    // Grid area for CSS grid layout
    private gridArea!: {
        rowStart: number;
        rowEnd: number;
        colStart: number; 
        colEnd: number;
    };

    constructor(
        position1: GridPosition,
        position2: GridPosition,
    ) {
        this.cells = new Set<string>();
        this.affectedRowHeaders = new Set<number>();
        this.affectedColHeaders = new Set<number>();

        // Calculate bounds and grid area
        this.updateBounds(position1, position2);
    }

    // Update selection bounds and recalculate cells
    updateBounds(position1: GridPosition, position2: GridPosition): void {
        this.updateBoundsFromCells(position1, position2);
        this.recalculateCells();
        this.updateGridArea();
    }

    contains(position: GridPosition): boolean {
        const key = positionToKey(position);
        return this.cells.has(key);
    }

    getCells(): Set<string> {
        return new Set(this.cells);
    }

    getBounds(): { topLeft: GridPosition, bottomRight: GridPosition } {
        return {
            topLeft: { ...this.topLeft },
            bottomRight: { ...this.bottomRight }
        };
    }

    getGridArea(): { rowStart: number, rowEnd: number, colStart: number, colEnd: number } {
        return { ...this.gridArea };
    }

    // Get headers affected by this selection (derived headers)
    getDerivedRowHeaders(): Set<number> {
        return new Set(this.affectedRowHeaders);
    }

    getDerivedColHeaders(): Set<number> {
        return new Set(this.affectedColHeaders);
    }

    getDerivedHeaders(): { rows: Set<number>, cols: Set<number> } {
        return {
            rows: this.getDerivedRowHeaders(),
            cols: this.getDerivedColHeaders()
        };
    }

    // Calculate bounds based on two positions
    private calculateBounds(pos1: GridPosition, pos2: GridPosition): { topLeft: GridPosition, bottomRight: GridPosition } {
        const topLeft = {
            row: Math.min(pos1.row, pos2.row),
            col: Math.min(pos1.col, pos2.col)
        };
        const bottomRight = {
            row: Math.max(pos1.row, pos2.row),
            col: Math.max(pos1.col, pos2.col)
        };
        return { topLeft, bottomRight };
    }

    private updateBoundsFromCells(position1: GridPosition, position2: GridPosition): void {
        const { topLeft, bottomRight } = this.calculateBounds(position1, position2);
        this.topLeft = { ...topLeft };
        this.bottomRight = { ...bottomRight };
    }

    private recalculateCells(): void {
        this.cells.clear();
        this.affectedRowHeaders.clear();
        this.affectedColHeaders.clear();

        for (let row = this.topLeft.row; row <= this.bottomRight.row; row++) {
            this.affectedRowHeaders.add(row);
            for (let col = this.topLeft.col; col <= this.bottomRight.col; col++) {
                this.affectedColHeaders.add(col);
                this.cells.add(positionToKey({ row, col }));
            }
        }
    }

    private updateGridArea(): void {
        // Grid area is 1-based for CSS grid, so we add 1 to each index
        this.gridArea = {
            rowStart: this.topLeft.row + 1,
            rowEnd: this.bottomRight.row + 2, // +2 because end is exclusive
            colStart: this.topLeft.col + 1,
            colEnd: this.bottomRight.col + 2
        };
    }

    fragmentExcluding(excludeArea: { topLeft: GridPosition; bottomRight: GridPosition }): Selection[] {
        const fragments: Selection[] = [];

        const selectionTopLeft = this.topLeft;
        const selectionBottomRight = this.bottomRight;

        const excludeTopLeft = excludeArea.topLeft;
        const excludeBottomRight = excludeArea.bottomRight;

        // Calculate intersection
        const intersectTopLeft: GridPosition = {
            row: Math.max(selectionTopLeft.row, excludeTopLeft.row),
            col: Math.max(selectionTopLeft.col, excludeTopLeft.col)
        };

        const intersectBottomRight: GridPosition = {
            row: Math.min(selectionBottomRight.row, excludeBottomRight.row),
            col: Math.min(selectionBottomRight.col, excludeBottomRight.col)
        };

        // Check if there is no intersection
        const noIntersection =
            intersectTopLeft.row > intersectBottomRight.row ||
            intersectTopLeft.col > intersectBottomRight.col;

        // No intersection, return original selection as single fragment
        if (noIntersection)  {
            return [this];
        }

        // Check if the selection fully covers the intersection area
        const fullCover =
            intersectTopLeft.row === selectionTopLeft.row &&
            intersectBottomRight.row === selectionBottomRight.row &&
            intersectTopLeft.col === selectionTopLeft.col &&
            intersectBottomRight.col === selectionBottomRight.col;

        if (fullCover) {
            return [];
        }

        // Upper part
        if (selectionTopLeft.row < intersectTopLeft.row) {
            fragments.push(new Selection(
                { row: selectionTopLeft.row, col: selectionTopLeft.col },
                { row: intersectTopLeft.row - 1, col: selectionBottomRight.col },
            ));
        }

        // Lower part
        if (intersectBottomRight.row < selectionBottomRight.row) {
            fragments.push(new Selection(
                { row: intersectBottomRight.row + 1, col: selectionTopLeft.col },
                { row: selectionBottomRight.row, col: selectionBottomRight.col },
            ));
        }

        // Left side
        if (selectionTopLeft.col < intersectTopLeft.col) {
            fragments.push(new Selection(
                {
                    row: Math.max(selectionTopLeft.row, intersectTopLeft.row),
                    col: selectionTopLeft.col
                },
                {
                    row: Math.min(selectionBottomRight.row, intersectBottomRight.row),
                    col: intersectTopLeft.col - 1
                },
            ));
        }

        // Right side
        if (intersectBottomRight.col < selectionBottomRight.col) {
            fragments.push(new Selection(
                {
                    row: Math.max(selectionTopLeft.row, intersectTopLeft.row),
                    col: intersectBottomRight.col + 1
                },
                {
                    row: Math.min(selectionBottomRight.row, intersectBottomRight.row),
                    col: selectionBottomRight.col
                },
            ));
        }

        return fragments;
    }

}
