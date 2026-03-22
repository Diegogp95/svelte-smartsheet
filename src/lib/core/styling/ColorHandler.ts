import type {
    GridPosition,
    HeaderPosition,
    CellComponent,
    BackgroundProperties,
    FlashOptions,
    HeaderComponent,
    VisibleComponents,
    GridDimensions,
} from '../types/types.ts';
import type { FlashEffectPort } from '../ports/FlashEffectPort.ts';
import {
    DEFAULT_CELL_BACKGROUND_PROPERTIES,
    DEFAULT_HEADER_BACKGROUND_PROPERTIES,
    DEFAULT_CELL_STYLE_STRING,
    DEFAULT_HEADER_STYLE_STRING,
    mergeStyleString,
} from './StyleSerializer.ts';
import { FlashEffectManager } from './FlashEffectManager.ts';

/** * Handles color and style management for SmartSheet cells and headers.
 * This module provides functionality to manage cell/header background, text and border colors,
 * and other visual aspects of the SmartSheet component.
 */
export default class ColorHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private gridDimensions: GridDimensions;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent;
    private flashEffectManager: FlashEffectManager<TExtraProps, TRowHeaderProps, TColHeaderProps>;

    constructor(
        gridDimensions: GridDimensions,
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent,
    ) {
        this.gridDimensions = gridDimensions;
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.flashEffectManager = new FlashEffectManager(
            cellComponents,
            rowHeaderComponents,
            colHeaderComponents,
            cornerHeaderComponent,
            () => this.gridDimensions,
        );
        this.resetAllStyles();
    }


    /**
     * Apply default styles to the specified type of component.
     * Optimized version using pre-calculated default strings
     */
    applyDefaultStyles(type: 'cell' | 'row' | 'col' | 'corner'): void {
        if (type === 'cell') {
            this.cellComponents.forEach(cell => {
                cell.styles.styling = DEFAULT_CELL_STYLE_STRING;
            });
        } else if (type === 'row') {
            this.rowHeaderComponents.forEach(header => {
                header.styles.styling = DEFAULT_HEADER_STYLE_STRING;
            });
        } else if (type === 'col') {
            this.colHeaderComponents.forEach(header => {
                header.styles.styling = DEFAULT_HEADER_STYLE_STRING;
            });
        } else if (type === 'corner') {
            this.cornerHeaderComponent.styles.styling = DEFAULT_HEADER_STYLE_STRING;
        }
    }

    /**
     * Reset all styles (cells and headers)
    */
    public resetAllStyles(): void {
        this.applyDefaultStyles('cell');
        this.applyDefaultStyles('row');
        this.applyDefaultStyles('col');
        this.applyDefaultStyles('corner');
    }

    setCellStyling(position: GridPosition, properties: BackgroundProperties): void {
        const cell = this.cellComponents.get(`${position.row}-${position.col}`);
        if (cell) {
            cell.styles.styling = mergeStyleString(cell.styles.styling, properties);
        }
    }

    changeCellBackgroundColor(position: GridPosition, color: string): void {
        this.setCellStyling(position, { 'background-color': color });
    }

    // ==================== HEADER STYLING METHODS ====================

    /**
     * Set header background properties for a header
    */
    setHeaderStyling(type: 'row' | 'col' | 'corner', index: number, properties: BackgroundProperties): void {
        let header: HeaderComponent<TRowHeaderProps> | HeaderComponent<TColHeaderProps> | HeaderComponent<undefined> | undefined;
        if (type === 'row') {
            header = this.rowHeaderComponents.get(`row-${index}`);
        } else if (type === 'col') {
            header = this.colHeaderComponents.get(`col-${index}`);
        } else {
            header = this.cornerHeaderComponent;
        }
        if (header) {
            header.styles.styling = mergeStyleString(header.styles.styling, properties);
        }
    }

    // Convenience methods for common header styling operations

    changeHeaderBackgroundColor(type: 'row' | 'col' | 'corner', index: number, color: string): void {
        this.setHeaderStyling(type, index, { 'background-color': color });
    }

    changeHeaderTextColor(type: 'row' | 'col' | 'corner', index: number, color: string): void {
        this.setHeaderStyling(type, index, { 'color': color });
    }

    /**
     * Apply an Excel-like selection-reflection border to a row or column header.
     * The reflection color tracks the theme via var(--ss-selection-border) so it
     * is never hardcoded in the core.
     *  - Row headers get a thicker right border (facing the selected cells)
     *  - Col headers get a thicker bottom border
     */
    public applyHeaderReflection(type: 'row' | 'col', index: number): void {
        const borderSide = type === 'row' ? 'border-right' : 'border-bottom';
        this.setHeaderStyling(type, index, {
            [`${borderSide}-color`]: 'var(--ss-selection-border)',
            [`${borderSide}-width`]: '3px',
            [`${borderSide}-style`]: 'solid',
        } as BackgroundProperties);
    }

    public clearHeaderReflection(type: 'row' | 'col', index: number): void {
        const borderSide = type === 'row' ? 'border-right' : 'border-bottom';
        const d = DEFAULT_HEADER_BACKGROUND_PROPERTIES;
        this.setHeaderStyling(type, index, {
            [`${borderSide}-color`]: d[`${borderSide}-color` as keyof BackgroundProperties] as string,
            [`${borderSide}-width`]: d[`${borderSide}-width` as keyof BackgroundProperties] as string,
            [`${borderSide}-style`]: d[`${borderSide}-style` as keyof BackgroundProperties] as string,
        } as BackgroundProperties);
    }

    /**
     * Apply header background styles using generator functions
    */
    public applyRowHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        for (const [row, props] of styleGenerator(this.rowHeaderComponents)) {
            this.setHeaderStyling('row', row, props);
        }
    }

    public applyColHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        for (const [col, props] of styleGenerator(this.colHeaderComponents)) {
            this.setHeaderStyling('col', col, props);
        }
    }

    /*
     ** =============================================================================================================
     ** Public APIs that take a function, and knows the structure of Cell's extraProps by a ts generic
     ** The function must generate [position, props][] then the corresponding methods are called for styling handling
     ** =============================================================================================================
     */

    public applyBackgroundStyles(
        styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, BackgroundProperties][]
    ): void {
        for (const [position, props] of styleGenerator(this.cellComponents)) {
            this.setCellStyling(position, props);
        }
    }

    public setFlashEffectPort(port: FlashEffectPort): void {
        this.flashEffectManager.setFlashEffectPort(port);
    }

    // ==================== FLASH EFFECTS (delegated to FlashEffectManager) ====================

    public flashCell(cell: CellComponent<TExtraProps>, options?: FlashOptions): void {
        this.flashEffectManager.flashCell(cell, options);
    }

    public flashHeader(header: HeaderComponent<TColHeaderProps | TRowHeaderProps>, options?: FlashOptions): void {
        this.flashEffectManager.flashHeader(header, options);
    }

    public flashCells(
        positions: GridPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashEffectManager.flashCells(positions, visibleComponents, options);
    }

    public flashHeaders(
        headerPositions: HeaderPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashEffectManager.flashHeaders(headerPositions, visibleComponents, options);
    }

    public flashComponents(
        components: { cells?: GridPosition[]; headers?: HeaderPosition[] },
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashEffectManager.flashComponents(components, visibleComponents, options);
    }

    public applyFlashEffect(
        flashGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashEffectManager.applyFlashEffect(flashGenerator, visibleComponents, options);
    }

    public flashRowHeaderAndCells(
        row: number,
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashEffectManager.flashRowHeaderAndCells(row, visibleComponents, options);
    }

    public flashColHeaderAndCells(
        col: number,
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashEffectManager.flashColHeaderAndCells(col, visibleComponents, options);
    }

    public applyRowHeaderAndCellsFlash(
        generator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => number[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashEffectManager.applyRowHeaderAndCellsFlash(generator, visibleComponents, options);
    }

    public applyColHeaderAndCellsFlash(
        generator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => number[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions,
    ): void {
        this.flashEffectManager.applyColHeaderAndCellsFlash(generator, visibleComponents, options);
    }

    // ==================== HEADER + ROW/COLUMN STYLING METHODS ====================

    /**
     * Style row header and all cells in that row
     */
    styleRowHeaderAndCells(row: number, headerProps: BackgroundProperties, cellProps: BackgroundProperties): void {
        // Style the row header
        this.setHeaderStyling('row', row, headerProps);

        // Directly construct keys for the row using grid dimensions
        for (let col = 0; col <= this.gridDimensions.maxCol; col++) {
            const key = `${row}-${col}`;
            if (this.cellComponents.has(key)) {
                const position = { row, col };
                this.setCellStyling(position, cellProps);
            }
        }
    }

    /**
     * Style column header and all cells in that column
     */
    styleColHeaderAndCells(col: number, headerProps: BackgroundProperties, cellProps: BackgroundProperties): void {
        // Style the column header
        this.setHeaderStyling('col', col, headerProps);

        // Directly construct keys for the column using grid dimensions
        for (let row = 0; row <= this.gridDimensions.maxRow; row++) {
            const key = `${row}-${col}`;
            if (this.cellComponents.has(key)) {
                const position = { row, col };
                this.setCellStyling(position, cellProps);
            }
        }
    }

    /**
     * Apply row header + cells styling using generator functions
     */
    public applyRowHeaderAndCellsBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]
    ): void {
        for (const [row, headerProps, cellProps] of styleGenerator(this.rowHeaderComponents)) {
            this.styleRowHeaderAndCells(row, headerProps, cellProps);
        }
    }

    /**
     * Apply column header + cells styling using generator functions
     */
    public applyColHeaderAndCellsBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties, BackgroundProperties][]
    ): void {
        for (const [col, headerProps, cellProps] of styleGenerator(this.colHeaderComponents)) {
            this.styleColHeaderAndCells(col, headerProps, cellProps);
        }
    }

}