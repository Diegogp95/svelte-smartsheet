import type {
    GridPosition,
    CellValue,
    CellComponent,
    CellBackgroundComponent,
    BackgroundProperties,
    TailwindProperties,
    FlashOptions,
    HeaderComponent,
    HeaderBackgroundComponent,
} from './types';

/** * Handles color and style management for SmartSheet cells and headers.
 * This module provides functionality to manage cell/header background, text and border colors,
 * and other visual aspects of the SmartSheet component.
 */
export default class ColorHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private backgroundComponents: Map<string, CellBackgroundComponent>;
    // Separate header components by type
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent | null;
    private headerBackgroundComponents: Map<string, HeaderBackgroundComponent>;

    constructor(
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        backgroundComponents: Map<string, CellBackgroundComponent>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent | null,
        headerBackgroundComponents: Map<string, HeaderBackgroundComponent>
    ) {
        this.cellComponents = cellComponents;
        this.backgroundComponents = backgroundComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;
        this.headerBackgroundComponents = headerBackgroundComponents;
    }

    setBackgroundProperties(position: GridPosition, properties: BackgroundProperties): void {
        const backgroundComponent = this.backgroundComponents.get(`${position.row}-${position.col}`);
        if (backgroundComponent) {
            backgroundComponent.setBackgroundProperties(properties);
            backgroundComponent.clearTailwindProperties(); // Clear Tailwind properties if set
            backgroundComponent.applyBackgroundProperties();
        }
    }

    setTailwindProperties(position: GridPosition, properties: TailwindProperties): void {
        const backgroundComponent = this.backgroundComponents.get(`${position.row}-${position.col}`);
        if (backgroundComponent) {
            backgroundComponent.setTailwindProperties(properties);
            backgroundComponent.clearBackgroundProperties(); // Clear background properties if set
            backgroundComponent.applyTailwindProperties();
        }
    }

    changeCellBackgroundColor(position: GridPosition, color: string): void {
        this.setBackgroundProperties(position, { 'background-color': color });
    }

    changeCellBorderColor(position: GridPosition, color: string): void {
        this.setBackgroundProperties(position, { 'border-color': color });
    }

    changeCellOpacity(position: GridPosition, value: number): void {
        this.setBackgroundProperties(position, { 'opacity': value });
    }

    changeCellTextColor(position: GridPosition, color: string): void {
        this.setBackgroundProperties(position, { 'text-color': color });
    }

    changeBorderStyle(position: GridPosition, style: string): void {
        this.setBackgroundProperties(position, { 'border-style': style });
    }

    changeTailwindBackgroundColor(position: GridPosition, clases: string[]): void {
        this.setTailwindProperties(position, { 'bg': clases });
    }

    changeTailwindText(position: GridPosition, clases: string[]): void {
        this.setTailwindProperties(position, { 'text': clases });
    }

    changeTailwindBorder(position: GridPosition, clases: string[]): void {
        this.setTailwindProperties(position, { 'border': clases });
    }

    changeTailwindOpacity(position: GridPosition, opacity: number): void {
        this.setTailwindProperties(position, { 'opacity': opacity });
    }

    // ==================== HEADER STYLING METHODS ====================

    /**
     * Set header background properties for row header
    */
    setRowHeaderBackgroundProperties(row: number, properties: BackgroundProperties): void {
        const key = `row-${row}`;
        const backgroundComponent = this.headerBackgroundComponents.get(key);
        if (backgroundComponent) {
            backgroundComponent.setBackgroundProperties(properties);
            backgroundComponent.clearTailwindProperties(); // Clear tailwind if set
            backgroundComponent.applyBackgroundProperties();
        }
    }

    /**
     * Set header background properties for column header
    */
    setColHeaderBackgroundProperties(col: number, properties: BackgroundProperties): void {
        const key = `col-${col}`;
        const backgroundComponent = this.headerBackgroundComponents.get(key);
        if (backgroundComponent) {
            backgroundComponent.setBackgroundProperties(properties);
            backgroundComponent.clearTailwindProperties(); // Clear tailwind if set
            backgroundComponent.applyBackgroundProperties();
        }
    }

    /**
     * Set header background properties for corner header
    */
    setCornerHeaderBackgroundProperties(properties: BackgroundProperties): void {
        const backgroundComponent = this.headerBackgroundComponents.get('corner');
        if (backgroundComponent) {
            backgroundComponent.setBackgroundProperties(properties);
            backgroundComponent.clearTailwindProperties(); // Clear tailwind if set
            backgroundComponent.applyBackgroundProperties();
        }
    }

    /**
     * Set tailwind properties for row header
    */
    setRowHeaderTailwindProperties(row: number, properties: TailwindProperties): void {
        const key = `row-${row}`;
        const backgroundComponent = this.headerBackgroundComponents.get(key);
        if (backgroundComponent) {
            backgroundComponent.setTailwindProperties(properties);
            backgroundComponent.clearBackgroundProperties(); // Clear background properties if set
            backgroundComponent.applyTailwindProperties();
        }
    }

    /**
     * Set tailwind properties for column header
    */
   setColHeaderTailwindProperties(col: number, properties: TailwindProperties): void {
       const key = `col-${col}`;
       const backgroundComponent = this.headerBackgroundComponents.get(key);
       if (backgroundComponent) {
           backgroundComponent.setTailwindProperties(properties);
           backgroundComponent.clearBackgroundProperties(); // Clear background properties if set
           backgroundComponent.applyTailwindProperties();
        }
    }

    /**
     * Set tailwind properties for corner header
    */
    setCornerHeaderTailwindProperties(properties: TailwindProperties): void {
        const backgroundComponent = this.headerBackgroundComponents.get('corner');
        if (backgroundComponent) {
            backgroundComponent.setTailwindProperties(properties);
            backgroundComponent.clearBackgroundProperties(); // Clear background properties if set
            backgroundComponent.applyTailwindProperties();
        }
    }

    // Convenience methods for common header styling operations

    changeRowHeaderBackgroundColor(row: number, color: string): void {
        this.setRowHeaderBackgroundProperties(row, { 'background-color': color });
    }

    changeColHeaderBackgroundColor(col: number, color: string): void {
        this.setColHeaderBackgroundProperties(col, { 'background-color': color });
    }

    changeCornerHeaderBackgroundColor(color: string): void {
        this.setCornerHeaderBackgroundProperties({ 'background-color': color });
    }

    changeRowHeaderTextColor(row: number, color: string): void {
        this.setRowHeaderBackgroundProperties(row, { 'text-color': color });
    }

    changeColHeaderTextColor(col: number, color: string): void {
        this.setColHeaderBackgroundProperties(col, { 'text-color': color });
    }

    changeCornerHeaderTextColor(color: string): void {
        this.setCornerHeaderBackgroundProperties({ 'text-color': color });
    }

    /**
     * Apply header background styles using generator functions
    */
    public applyRowHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        for (const [row, props] of styleGenerator(this.rowHeaderComponents)) {
            this.setRowHeaderBackgroundProperties(row, props);
        }
    }

    public applyColHeaderBackgroundStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, BackgroundProperties][]
    ): void {
        for (const [col, props] of styleGenerator(this.colHeaderComponents)) {
            this.setColHeaderBackgroundProperties(col, props);
        }
    }

    /**
     * Apply header tailwind styles using generator functions
    */
   public applyRowHeaderTailwindStyles(
       styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        for (const [row, props] of styleGenerator(this.rowHeaderComponents)) {
            this.setRowHeaderTailwindProperties(row, props);
        }
    }

    public applyColHeaderTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        for (const [col, props] of styleGenerator(this.colHeaderComponents)) {
            this.setColHeaderTailwindProperties(col, props);
        }
    }

    /**
     * Reset styles for all headers
    */
    public resetHeaderStyles(): void {
        for (const bg of this.headerBackgroundComponents.values()) {
            bg.clearBackgroundProperties();
            bg.clearTailwindProperties();
        }
    }

    /**
     * Reset all styles (cells and headers)
    */
    public resetAllStyles(): void {
        this.resetSheetStyles();
        this.resetHeaderStyles();
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
            this.setBackgroundProperties(position, props);
        }
    }

    public applyTailwindStyles(
        styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, TailwindProperties][]
    ): void {
        for (const [position, props] of styleGenerator(this.cellComponents)) {
            this.setTailwindProperties(position, props);
        }
    }

    // Reset styles for all cell backgrounds
    public resetSheetStyles(): void {
        for (const bg of this.backgroundComponents.values()) {
            bg.clearBackgroundProperties();
            bg.clearTailwindProperties();
        }
    }

    // ==================== FLASH EFFECTS ====================

    /**
     * Trigger flash effect on a single cell
     */
    public flashCell(position: GridPosition, options?: FlashOptions): void {
        const key = `${position.row}-${position.col}`;
        const cellComponent = this.cellComponents.get(key);
        if (cellComponent) {
            cellComponent.triggerFlash(options);
        }
    }

    /**
     * Trigger flash effect on multiple cells
     */
    public flashCells(positions: GridPosition[], options?: FlashOptions): void {
        for (const position of positions) {
            this.flashCell(position, options);
        }
    }

    /**
     * Trigger flash effect using a generator function that determines which cells to flash
     */
    public applyFlashEffect(
        flashGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[],
        options?: FlashOptions
    ): void {
        const positions = flashGenerator(this.cellComponents);
        this.flashCells(positions, options);
    }

    // ==================== HEADER + ROW/COLUMN STYLING METHODS ====================

    /**
     * Style row header and all cells in that row
     */
    styleRowHeaderAndCells(row: number, headerProps: BackgroundProperties, cellProps: BackgroundProperties): void {
        // Style the row header
        this.setRowHeaderBackgroundProperties(row, headerProps);

        // Style all cells in that row
        this.cellComponents.forEach((cell, key) => {
            const [cellRow] = key.split('-').map(Number);
            if (cellRow === row) {
                const position = { row: cellRow, col: parseInt(key.split('-')[1]) };
                this.setBackgroundProperties(position, cellProps);
            }
        });
    }

    /**
     * Style column header and all cells in that column
     */
    styleColHeaderAndCells(col: number, headerProps: BackgroundProperties, cellProps: BackgroundProperties): void {
        // Style the column header
        this.setColHeaderBackgroundProperties(col, headerProps);

        // Style all cells in that column
        this.cellComponents.forEach((cell, key) => {
            const [, cellCol] = key.split('-').map(Number);
            if (cellCol === col) {
                const position = { row: parseInt(key.split('-')[0]), col: cellCol };
                this.setBackgroundProperties(position, cellProps);
            }
        });
    }

    /**
     * Style row header and all cells in that row with Tailwind classes
     */
    styleRowHeaderAndCellsTailwind(row: number, headerProps: TailwindProperties, cellProps: TailwindProperties): void {
        // Style the row header
        this.setRowHeaderTailwindProperties(row, headerProps);

        // Style all cells in that row
        this.cellComponents.forEach((cell, key) => {
            const [cellRow] = key.split('-').map(Number);
            if (cellRow === row) {
                const position = { row: cellRow, col: parseInt(key.split('-')[1]) };
                this.setTailwindProperties(position, cellProps);
            }
        });
    }

    /**
     * Style column header and all cells in that column with Tailwind classes
     */
    styleColHeaderAndCellsTailwind(col: number, headerProps: TailwindProperties, cellProps: TailwindProperties): void {
        // Style the column header
        this.setColHeaderTailwindProperties(col, headerProps);

        // Style all cells in that column
        this.cellComponents.forEach((cell, key) => {
            const [, cellCol] = key.split('-').map(Number);
            if (cellCol === col) {
                const position = { row: parseInt(key.split('-')[0]), col: cellCol };
                this.setTailwindProperties(position, cellProps);
            }
        });
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

    /**
     * Apply row header + cells Tailwind styling using generator functions
     */
    public applyRowHeaderAndCellsTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]
    ): void {
        for (const [row, headerProps, cellProps] of styleGenerator(this.rowHeaderComponents)) {
            this.styleRowHeaderAndCellsTailwind(row, headerProps, cellProps);
        }
    }

    /**
     * Apply column header + cells Tailwind styling using generator functions
     */
    public applyColHeaderAndCellsTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties, TailwindProperties][]
    ): void {
        for (const [col, headerProps, cellProps] of styleGenerator(this.colHeaderComponents)) {
            this.styleColHeaderAndCellsTailwind(col, headerProps, cellProps);
        }
    }

}