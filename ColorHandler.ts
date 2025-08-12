import type {
    GridPosition,
    CellValue,
    CellComponent,
    CellBackgroundComponent,
    BackgroundProperties,
    TailwindProperties,
} from './types';

/** * Handles color and style management for SmartSheet cells.
 * This module provides functionality to manage cell background, text and border colors,
 * and other visual aspects of the SmartSheet component.
 */
// Generic ONLY for CellComponent extraProps, no extension of background/tailwind prop types
export class ColorHandler<TExtraProps = undefined> {
    private cellComponents: Map<string, CellComponent<TExtraProps>>;
    private backgroundComponents: Map<string, CellBackgroundComponent>;

    constructor(
        cellComponents: Map<string, CellComponent<TExtraProps>>,
        backgroundComponents: Map<string, CellBackgroundComponent>
    ) {
        this.cellComponents = cellComponents;
        this.backgroundComponents = backgroundComponents;
    }

    setBackgroundProperties(position: GridPosition, properties: BackgroundProperties): void {
        console.log(`[ColorHandler] Setting background properties at (${position.row}, ${position.col})`);
        const backgroundComponent = this.backgroundComponents.get(`${position.row}-${position.col}`);
        if (backgroundComponent) {
            backgroundComponent.setBackgroundProperties(properties);
            backgroundComponent.clearTailwindProperties(); // Clear Tailwind properties if set
            backgroundComponent.applyBackgroundProperties();
        }
    }

    setTailwindProperties(position: GridPosition, properties: TailwindProperties): void {
        console.log(`[ColorHandler] Setting tailwind properties at (${position.row}, ${position.col})`);
        const backgroundComponent = this.backgroundComponents.get(`${position.row}-${position.col}`);
        if (backgroundComponent) {
            backgroundComponent.setTailwindProperties(properties);
            backgroundComponent.clearBackgroundProperties(); // Clear background properties if set
            backgroundComponent.applyTailwindProperties();
        }
    }

    changeCellBackgroundColor(position: GridPosition, color: string): void {
        console.log(`[ColorHandler] Changing background color at (${position.row}, ${position.col}) to ${color}`);
        this.setBackgroundProperties(position, { 'background-color': color });
    }

    changeCellBorderColor(position: GridPosition, color: string): void {
        console.log(`[ColorHandler] Changing border color at (${position.row}, ${position.col}) to ${color}`);
        this.setBackgroundProperties(position, { 'border-color': color });
    }

    changeCellOpacity(position: GridPosition, value: number): void {
        console.log(`[ColorHandler] Changing opacity at (${position.row}, ${position.col}) to ${value}`);
        this.setBackgroundProperties(position, { 'opacity': value });
    }

    changeCellTextColor(position: GridPosition, color: string): void {
        console.log(`[ColorHandler] Changing text color at (${position.row}, ${position.col}) to ${color}`);
        this.setBackgroundProperties(position, { 'text-color': color });
    }

    changeBorderStyle(position: GridPosition, style: string): void {
        console.log(`[ColorHandler] Changing border style at (${position.row}, ${position.col}) to ${style}`);
        this.setBackgroundProperties(position, { 'border-style': style });
    }

    changeTailwindBackgroundColor(position: GridPosition, clases: string[]): void {
        console.log(`[ColorHandler] Changing tailwind background color at (${position.row}, ${position.col}) to ${clases.join(', ')}`);
        this.setTailwindProperties(position, { 'bg': clases });
    }

    changeTailwindText(position: GridPosition, clases: string[]): void {
        console.log(`[ColorHandler] Changing tailwind text color at (${position.row}, ${position.col}) to ${clases.join(', ')}`);
        this.setTailwindProperties(position, { 'text': clases });
    }

    changeTailwindBorder(position: GridPosition, clases: string[]): void {
        console.log(`[ColorHandler] Changing tailwind border at (${position.row}, ${position.col}) to ${clases.join(', ')}`);
        this.setTailwindProperties(position, { 'border': clases });
    }

    changeTailwindOpacity(position: GridPosition, opacity: number): void {
        console.log(`[ColorHandler] Changing tailwind opacity at (${position.row}, ${position.col}) to ${opacity}`);
        this.setTailwindProperties(position, { 'opacity': opacity });
    }

    /*
     ** Public APIs that take a function, and knows the structure of Cell's extraProps by a ts generic
     ** The function must generate [position, props][] then the corresponding methods are called for styling handling
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

}