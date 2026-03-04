import type {
    GridPosition,
    HeaderPosition,
    CellValue,
    CellComponent,
    BackgroundProperties,
    FlashOptions,
    HeaderComponent,
    VisibleComponents,
    GridDimensions,
} from '../types/types.ts';
import './Styling.css'
import { getFlashColors } from '../utils/utils.ts';
import type { FlashEffectPort } from '../ports/FlashEffectPort.ts';

/** * Handles color and style management for SmartSheet cells and headers.
 * This module provides functionality to manage cell/header background, text and border colors,
 * and other visual aspects of the SmartSheet component.
 */
export default class ColorHandler<TExtraProps = undefined, TRowHeaderProps = undefined, TColHeaderProps = undefined> {
    private gridDimensions: GridDimensions;
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    // Separate header components by type
    private rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>;
    private colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>;
    private cornerHeaderComponent: HeaderComponent;
    private flashEffectPort?: FlashEffectPort;

    // Pre-calculated default style strings for performance optimization
    private readonly DEFAULT_CELL_STYLE_STRING: string;
    private readonly DEFAULT_HEADER_STYLE_STRING: string;

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

        // Pre-calculate default style strings for performance optimization
        this.DEFAULT_CELL_STYLE_STRING = this.bgPropertiesToString(this.defaultCellBackgroundProperties);
        this.DEFAULT_HEADER_STYLE_STRING = this.bgPropertiesToString(this.defaultHeaderBackgroundProperties);

        // Apply defaults styles to cell and header components
        this.resetAllStyles();
    }

    defaultCellBackgroundProperties: BackgroundProperties = {
        'background-color': 'transparent',
        'border-top-color': 'rgba(0, 100, 200, 0.15)',
        'border-top-width': '1px',
        'border-top-style': 'solid',
        'border-right-color': 'rgba(0, 100, 200, 0.15)',
        'border-right-width': '1px',
        'border-right-style': 'solid',
        'border-bottom-color': 'rgba(0, 100, 200, 0.15)',
        'border-bottom-width': '1px',
        'border-bottom-style': 'solid',
        'border-left-color': 'rgba(0, 100, 200, 0.15)',
        'border-left-width': '1px',
        'border-left-style': 'solid',
        'opacity': 1,
        'text-color': 'inherit',
    };

    defaultHeaderBackgroundProperties: BackgroundProperties = {
        'background-color': 'rgba(0, 120, 200, 0.3)',
        'border-right-color': 'rgba(0, 100, 200, 0.15)',
        'border-right-width': '1px',
        'border-right-style': 'solid',
        'border-bottom-color': 'rgba(0, 100, 200, 0.15)',
        'border-bottom-width': '1px',
        'border-bottom-style': 'solid',
        'border-left-color': 'rgba(0, 100, 200, 0.15)',
        'border-left-width': '1px',
        'border-left-style': 'solid',
        'border-top-color': 'rgba(0, 100, 200, 0.15)',
        'border-top-width': '1px',
        'border-top-style': 'solid',
        'opacity': 1,
        'text-color': 'inherit',
    };

    /**
     * Apply default styles to the specified type of component.
     * Optimized version using pre-calculated default strings
     */
    applyDefaultStyles(type: 'cell' | 'row' | 'col' | 'corner'): void {
        if (type === 'cell') {
            this.cellComponents.forEach(cell => {
                cell.styles.styling = this.DEFAULT_CELL_STYLE_STRING;
            });
        } else if (type === 'row') {
            this.rowHeaderComponents.forEach(header => {
                header.styles.styling = this.DEFAULT_HEADER_STYLE_STRING;
            });
        } else if (type === 'col') {
            this.colHeaderComponents.forEach(header => {
                header.styles.styling = this.DEFAULT_HEADER_STYLE_STRING;
            });
        } else if (type === 'corner') {
            this.cornerHeaderComponent.styles.styling = this.DEFAULT_HEADER_STYLE_STRING;
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

    bgPropertiesToString(properties: BackgroundProperties): string {
        return Object.entries(properties)
            .map(([key, value]) => `${key}: ${value};`)
            .join(' ');
    };

    /**
     * Parse CSS style string back to BackgroundProperties object
     */
    parseStyleString(styleString: string): BackgroundProperties {
        const properties: BackgroundProperties = {};
        if (!styleString) return properties;

        // Split by semicolon and process each declaration
        const declarations = styleString.split(';').filter(decl => decl.trim());

        for (const declaration of declarations) {
            const colonIndex = declaration.indexOf(':');
            if (colonIndex === -1) continue;

            const property = declaration.substring(0, colonIndex).trim() as keyof BackgroundProperties;
            const value = declaration.substring(colonIndex + 1).trim();

            // Only include valid BackgroundProperties keys
            if (property in this.defaultCellBackgroundProperties || property in this.defaultHeaderBackgroundProperties) {
                if (property === 'opacity') {
                    properties[property] = parseFloat(value) || 1;
                } else {
                    (properties as any)[property] = value;
                }
            }
        }

        return properties;
    }

    setCellStyling(position: GridPosition, properties: BackgroundProperties): void {
        const cell = this.cellComponents.get(`${position.row}-${position.col}`);
        if (cell) {
            // Parse current styles to preserve existing properties
            const currentProperties = this.parseStyleString(cell.styles.styling);

            // Merge current properties with new ones (new properties override existing ones)
            cell.styles.styling = this.bgPropertiesToString(
                {
                    ...currentProperties,
                    ...properties
                }
            );
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
            // Parse current styles to preserve existing properties
            const currentProperties = this.parseStyleString(header.styles.styling);

            // Merge current properties with new ones (new properties override existing ones)
            header.styles.styling = this.bgPropertiesToString(
                {
                    ...currentProperties,
                    ...properties
                }
            );
        }
    }

    // Convenience methods for common header styling operations

    changeHeaderBackgroundColor(type: 'row' | 'col' | 'corner', index: number, color: string): void {
        this.setHeaderStyling(type, index, { 'background-color': color });
    }

    changeHeaderTextColor(type: 'row' | 'col' | 'corner', index: number, color: string): void {
        this.setHeaderStyling(type, index, { 'text-color': color });
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
        this.flashEffectPort = port;
    }

    // ==================== FLASH EFFECTS ====================

    /**
     * Trigger flash effect on a single cell
     */
    public flashCell(cell: CellComponent<TExtraProps>, options?: FlashOptions): void {
        const color = options?.color || 'blue';
        const duration = options?.duration || 600;
        const colors = getFlashColors(color);
        this.flashEffectPort?.flash(
            { type: 'cell', row: cell.position.row, col: cell.position.col },
            { primaryColor: colors.primary, secondaryColor: colors.secondary, duration }
        );
    }

    /**
     * Trigger flash effect on a single header (row, col, or corner)
     */
    public flashHeader(header: HeaderComponent<TColHeaderProps | TRowHeaderProps>, options?: FlashOptions): void {
        const color = options?.color || 'blue';
        const duration = options?.duration || 600;
        const colors = getFlashColors(color);
        this.flashEffectPort?.flash(
            { type: 'header', headerType: header.position.headerType, index: header.position.index },
            { primaryColor: colors.primary, secondaryColor: colors.secondary, duration }
        );
    }

    /**
     * Trigger flash effect on multiple cells
     */
    public flashCells(
        positions: GridPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions
    ): void {
        for (const position of positions) {
            const renderedCell = visibleComponents.cells.find(
                c => c.position.row === position.row && c.position.col === position.col
            );
            if (renderedCell) {
                this.flashCell(renderedCell, options);
            }
        }
    }

    /**
     * Trigger flash effect on multiple headers
     */
    public flashHeaders(
        headerPositions: HeaderPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions
    ): void {
        for (const headerPos of headerPositions) {
            let header: HeaderComponent<any> | undefined;
            let index = headerPos.index;
            if (headerPos.headerType === 'row') {
                header = this.rowHeaderComponents.get(`row-${index}`);
            } else if (headerPos.headerType === 'col') {
                header = this.colHeaderComponents.get(`col-${index}`);
            } else if (headerPos.headerType === 'corner') {
                header = this.cornerHeaderComponent;
            }
            if (header) {
                this.flashHeader(header, options);
            }
        }
    }

    /**
     * Trigger flash effect on batch of cells and headers
     */
    public flashComponents(
        components: {
            cells?: GridPosition[];
            headers?: HeaderPosition[];
        },
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions
    ): void {
        if (components.cells && components.cells.length > 0) {
            this.flashCells(components.cells, visibleComponents, options);
        }
        if (components.headers && components.headers.length > 0) {
            this.flashHeaders(components.headers, visibleComponents, options);
        }
    }

    /**
     * Trigger flash effect using a generator function that determines which cells to flash
     */
    public applyFlashEffect(
        flashGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => GridPosition[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions
    ): void {
        const positions = flashGenerator(this.cellComponents);
        this.flashCells(positions, visibleComponents, options);
    }

    /**
     * Flash row header and all cells in that row
     */
    public flashRowHeaderAndCells(
        row: number,
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions
    ): void {
        const header: HeaderPosition = { headerType: 'row', index: row };
        const cells: GridPosition[] = [];
        for (let col = 0; col <= this.gridDimensions.maxCol; col++) {
            cells.push({ row, col });
        }
        this.flashComponents({ headers: [header], cells }, visibleComponents, options);
    }

    /**
     * Flash column header and all cells in that column
     */
    public flashColHeaderAndCells(
        col: number,
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions
    ): void {
        // Header
        const header: HeaderPosition = { headerType: 'col', index: col };
        // Cells (más eficiente usando gridDimensions)
        const cells: GridPosition[] = [];
        for (let row = 0; row <= this.gridDimensions.maxRow; row++) {
            cells.push({ row, col });
        }
        this.flashComponents({ headers: [header], cells }, visibleComponents, options);
    }

    /**
     * Batch flash for row header + cells using a generator of row indices
     */
    public applyRowHeaderAndCellsFlash(
        generator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => number[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions
    ): void {
        const rows = generator(this.rowHeaderComponents);
        for (const row of rows) {
            this.flashRowHeaderAndCells(row, visibleComponents, options);
        }
    }

    /**
     * Batch flash for column header + cells using a generator of col indices
     */
    public applyColHeaderAndCellsFlash(
        generator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => number[],
        visibleComponents: VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps>,
        options?: FlashOptions
    ): void {
        const cols = generator(this.colHeaderComponents);
        for (const col of cols) {
            this.flashColHeaderAndCells(col, visibleComponents, options);
        }
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