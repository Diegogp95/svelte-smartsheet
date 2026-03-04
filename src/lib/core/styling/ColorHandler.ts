import type {
    GridPosition,
    HeaderPosition,
    CellValue,
    CellComponent,
    BackgroundProperties,
    TailwindProperties,
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
    private styleMode: 'style' | 'tailwind';
    private flashEffectPort?: FlashEffectPort;

    // Pre-calculated default style strings for performance optimization
    private readonly DEFAULT_CELL_STYLE_STRING: string;
    private readonly DEFAULT_CELL_TAILWIND_STRING: string;
    private readonly DEFAULT_HEADER_STYLE_STRING: string;
    private readonly DEFAULT_HEADER_TAILWIND_STRING: string;

    constructor(
        gridDimensions: GridDimensions,
        styleMode: 'style' | 'tailwind',
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        rowHeaderComponents: Map<string, HeaderComponent<TRowHeaderProps>>,
        colHeaderComponents: Map<string, HeaderComponent<TColHeaderProps>>,
        cornerHeaderComponent: HeaderComponent,
    ) {
        this.gridDimensions = gridDimensions;
        this.styleMode = styleMode;
        this.cellComponents = cellComponents;
        this.rowHeaderComponents = rowHeaderComponents;
        this.colHeaderComponents = colHeaderComponents;
        this.cornerHeaderComponent = cornerHeaderComponent;

        // Pre-calculate default style strings for performance optimization
        this.DEFAULT_CELL_STYLE_STRING = this.bgPropertiesToString(this.defaultCellBackgroundProperties);
        this.DEFAULT_CELL_TAILWIND_STRING = this.tailwindPropertiesToString(this.defaultCellTailwindProperties);
        this.DEFAULT_HEADER_STYLE_STRING = this.bgPropertiesToString(this.defaultHeaderBackgroundProperties);
        this.DEFAULT_HEADER_TAILWIND_STRING = this.tailwindPropertiesToString(this.defaultHeaderTailwindProperties);

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

    defaultCellTailwindProperties: TailwindProperties = {
        'bg-color': 'transparent',
        'border-top-color': 'electric-blue/15',
        'border-top-width': '1',
        'border-top-style': 'solid',
        'border-right-color': 'electric-blue/15',
        'border-right-width': '1',
        'border-right-style': 'solid',
        'border-bottom-color': 'electric-blue/15',
        'border-bottom-width': '1',
        'border-bottom-style': 'solid',
        'border-left-color': 'electric-blue/15',
        'border-left-width': '1',
        'border-left-style': 'solid',
        'text-color': 'inherit',
        'opacity': 1,
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

    defaultHeaderTailwindProperties: TailwindProperties = {
        'bg-color': 'electric-blue/30',
        'border-top-color': 'electric-blue/15',
        'border-top-width': '1',
        'border-top-style': 'solid',
        'border-right-color': 'electric-blue/15',
        'border-right-width': '1',
        'border-right-style': 'solid',
        'border-bottom-color': 'electric-blue/15',
        'border-bottom-width': '1',
        'border-bottom-style': 'solid',
        'border-left-color': 'electric-blue/15',
        'border-left-width': '1',
        'border-left-style': 'solid',
        'text-color': 'inherit',
        'opacity': 1,
    };

    /**
     * Apply default styles to the specified type of component.
     * Optimized version using pre-calculated default strings
     */
    applyDefaultStyles(type: 'cell' | 'row' | 'col' | 'corner'): void {
        if (type === 'cell') {
            this.cellComponents.forEach(cell => {
                if (this.styleMode === 'style') {
                    cell.styles.styling = this.DEFAULT_CELL_STYLE_STRING;
                } else {
                    cell.styles.tailwindStyling = this.DEFAULT_CELL_TAILWIND_STRING;
                }
            });
        } else if (type === 'row') {
            this.rowHeaderComponents.forEach(header => {
                if (this.styleMode === 'style') {
                    header.styles.styling = this.DEFAULT_HEADER_STYLE_STRING;
                } else {
                    header.styles.tailwindStyling = this.DEFAULT_HEADER_TAILWIND_STRING;
                }
            });
        } else if (type === 'col') {
            this.colHeaderComponents.forEach(header => {
                if (this.styleMode === 'style') {
                    header.styles.styling = this.DEFAULT_HEADER_STYLE_STRING;
                } else {
                    header.styles.tailwindStyling = this.DEFAULT_HEADER_TAILWIND_STRING;
                }
            });
        } else if (type === 'corner') {
            if (this.styleMode === 'style') {
                this.cornerHeaderComponent.styles.styling = this.DEFAULT_HEADER_STYLE_STRING;
            } else {
                this.cornerHeaderComponent.styles.tailwindStyling = this.DEFAULT_HEADER_TAILWIND_STRING;
            }
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

    tailwindPropertiesToString(properties: TailwindProperties): string {
        let tailwindClasses = []
        for (const [key, value] of Object.entries(properties)) {
            switch (key) {
                case 'bg-color':
                    tailwindClasses.push(`bg-${value}`);
                    break;
                case 'border-radius':
                    tailwindClasses.push(`rounded-${value}`);
                    break;
                // Directional borders - granular control
                case 'border-top-color':
                    tailwindClasses.push(`border-t-${value}`);
                    break;
                case 'border-top-width':
                    tailwindClasses.push(`border-t-${value}`);
                    break;
                case 'border-top-style':
                    tailwindClasses.push(`border-t-${value}`);
                    break;
                case 'border-right-color':
                    tailwindClasses.push(`border-r-${value}`);
                    break;
                case 'border-right-width':
                    tailwindClasses.push(`border-r-${value}`);
                    break;
                case 'border-right-style':
                    tailwindClasses.push(`border-r-${value}`);
                    break;
                case 'border-bottom-color':
                    tailwindClasses.push(`border-b-${value}`);
                    break;
                case 'border-bottom-width':
                    tailwindClasses.push(`border-b-${value}`);
                    break;
                case 'border-bottom-style':
                    tailwindClasses.push(`border-b-${value}`);
                    break;
                case 'border-left-color':
                    tailwindClasses.push(`border-l-${value}`);
                    break;
                case 'border-left-width':
                    tailwindClasses.push(`border-l-${value}`);
                    break;
                case 'border-left-style':
                    tailwindClasses.push(`border-l-${value}`);
                    break;
                case 'text-color':
                    tailwindClasses.push(`text-${value}`);
                    break;
                case 'opacity':
                    tailwindClasses.push(`opacity-${value}`);
                    break;
            }
        }
        return tailwindClasses.join(' ');
    }

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

    /**
     * Parse Tailwind class string back to TailwindProperties object
     */
    parseTailwindString(tailwindString: string): TailwindProperties {
        const properties: TailwindProperties = {};
        if (!tailwindString) return properties;

        const classes = tailwindString.split(' ').filter(cls => cls.trim());

        for (const cls of classes) {
            // Background color: bg-{value}
            if (cls.startsWith('bg-') && !cls.startsWith('bg-opacity-')) {
                properties['bg-color'] = cls.substring(3);
            }
            // Border radius: rounded-{value}
            else if (cls.startsWith('rounded-')) {
                properties['border-radius'] = cls.substring(8);
            }
            // Border top color: border-t-{value}
            else if (cls.startsWith('border-t-') && !cls.match(/border-t-\d+$/)) {
                properties['border-top-color'] = cls.substring(9);
            }
            // Border top width: border-t-{number}
            else if (cls.match(/^border-t-\d+$/)) {
                properties['border-top-width'] = cls.substring(9);
            }
            // Border right color: border-r-{value}
            else if (cls.startsWith('border-r-') && !cls.match(/border-r-\d+$/)) {
                properties['border-right-color'] = cls.substring(9);
            }
            // Border right width: border-r-{number}
            else if (cls.match(/^border-r-\d+$/)) {
                properties['border-right-width'] = cls.substring(9);
            }
            // Border bottom color: border-b-{value}
            else if (cls.startsWith('border-b-') && !cls.match(/border-b-\d+$/)) {
                properties['border-bottom-color'] = cls.substring(9);
            }
            // Border bottom width: border-b-{number}
            else if (cls.match(/^border-b-\d+$/)) {
                properties['border-bottom-width'] = cls.substring(9);
            }
            // Border left color: border-l-{value}
            else if (cls.startsWith('border-l-') && !cls.match(/border-l-\d+$/)) {
                properties['border-left-color'] = cls.substring(9);
            }
            // Border left width: border-l-{number}
            else if (cls.match(/^border-l-\d+$/)) {
                properties['border-left-width'] = cls.substring(9);
            }
            // Text color: text-{value}
            else if (cls.startsWith('text-')) {
                properties['text-color'] = cls.substring(5);
            }
            // Opacity: opacity-{value}
            else if (cls.startsWith('opacity-')) {
                properties['opacity'] = parseFloat(cls.substring(8)) || 1;
            }
        }

        return properties;
    }

    setCellStyling(position: GridPosition, properties: BackgroundProperties): void {
        if (this.styleMode !== 'style') return
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

    setCellTailwindStyling(position: GridPosition, properties: TailwindProperties): void {
        if (this.styleMode !== 'tailwind') return
        const cell = this.cellComponents.get(`${position.row}-${position.col}`);
        if (cell) {
            // Parse current Tailwind classes to preserve existing properties
            const currentProperties = this.parseTailwindString(cell.styles.tailwindStyling);

            // Merge current properties with new ones (new properties override existing ones)
            cell.styles.tailwindStyling = this.tailwindPropertiesToString(
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

    changeCellBorderColor(position: GridPosition, color: string): void {
        this.setCellStyling(position, {
            'border-top-color': color,
            'border-right-color': color,
            'border-bottom-color': color,
            'border-left-color': color
        });
    }

    changeCellOpacity(position: GridPosition, value: number): void {
        this.setCellStyling(position, { 'opacity': value });
    }

    changeCellTextColor(position: GridPosition, color: string): void {
        this.setCellStyling(position, { 'text-color': color });
    }

    changeBorderStyle(position: GridPosition, style: string): void {
        this.setCellStyling(position, {
            'border-top-style': style,
            'border-right-style': style,
            'border-bottom-style': style,
            'border-left-style': style
        });
    }

    changeCellTailwindBackgroundColor(position: GridPosition, color: string): void {
        this.setCellTailwindStyling(position, { 'bg-color': color });
    }

    changeCellTailwindText(position: GridPosition, color: string): void {
        this.setCellTailwindStyling(position, { 'text-color': color });
    }

    changeCellTailwindBorder(position: GridPosition, color: string): void {
        this.setCellTailwindStyling(position, {
            'border-top-color': color,
            'border-right-color': color,
            'border-bottom-color': color,
            'border-left-color': color
        });
    }

    changeCellTailwindOpacity(position: GridPosition, opacity: number): void {
        this.setCellTailwindStyling(position, { 'opacity': opacity });
    }

    // ==================== HEADER STYLING METHODS ====================

    /**
     * Set header background properties for a header
    */
    setHeaderStyling(type: 'row' | 'col' | 'corner', index: number, properties: BackgroundProperties): void {
        if (this.styleMode !== 'style') return
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

    /**
     * Set tailwind properties for header
    */
    setHeaderTailwindStyling(type: 'row' | 'col' | 'corner', index: number, properties: TailwindProperties): void {
        if (this.styleMode !== 'tailwind') return
        let header: HeaderComponent<TRowHeaderProps> | HeaderComponent<TColHeaderProps> | HeaderComponent<undefined> | undefined;
        if (type === 'row') {
            header = this.rowHeaderComponents.get(`row-${index}`);
        } else if (type === 'col') {
            header = this.colHeaderComponents.get(`col-${index}`);
        } else {
            header = this.cornerHeaderComponent;
        }
        if (header) {
            // Parse current Tailwind classes to preserve existing properties
            const currentProperties = this.parseTailwindString(header.styles.tailwindStyling);

            // Merge current properties with new ones (new properties override existing ones)
            header.styles.tailwindStyling = this.tailwindPropertiesToString(
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

    /**
     * Apply header tailwind styles using generator functions
    */
   public applyRowHeaderTailwindStyles(
       styleGenerator: (headers: Map<string, HeaderComponent<TRowHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        for (const [row, props] of styleGenerator(this.rowHeaderComponents)) {
            this.setHeaderTailwindStyling('row', row, props);
        }
    }

    public applyColHeaderTailwindStyles(
        styleGenerator: (headers: Map<string, HeaderComponent<TColHeaderProps>>) => [number, TailwindProperties][]
    ): void {
        for (const [col, props] of styleGenerator(this.colHeaderComponents)) {
            this.setHeaderTailwindStyling('col', col, props);
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

    public applyTailwindStyles(
        styleGenerator: (cells: Map<string, CellComponent<TExtraProps>>) => [GridPosition, TailwindProperties][]
    ): void {
        for (const [position, props] of styleGenerator(this.cellComponents)) {
            this.setCellTailwindStyling(position, props);
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
     * Style row header and all cells in that row with Tailwind classes
     */
    styleRowHeaderAndCellsTailwind(row: number, headerProps: TailwindProperties, cellProps: TailwindProperties): void {
        // Style the row header
        this.setHeaderTailwindStyling('row', row, headerProps);

        // Directly construct keys for the row using grid dimensions
        for (let col = 0; col <= this.gridDimensions.maxCol; col++) {
            const key = `${row}-${col}`;
            if (this.cellComponents.has(key)) {
                const position = { row, col };
                this.setCellTailwindStyling(position, cellProps);
            }
        }
    }

    /**
     * Style column header and all cells in that column with Tailwind classes
     */
    styleColHeaderAndCellsTailwind(col: number, headerProps: TailwindProperties, cellProps: TailwindProperties): void {
        // Style the column header
        this.setHeaderTailwindStyling('col', col, headerProps);

        // Directly construct keys for the column using grid dimensions
        for (let row = 0; row <= this.gridDimensions.maxRow; row++) {
            const key = `${row}-${col}`;
            if (this.cellComponents.has(key)) {
                const position = { row, col };
                this.setCellTailwindStyling(position, cellProps);
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