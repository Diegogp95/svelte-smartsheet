export interface GridPosition {
    row: number;
    col: number;
}

export interface GridDimensions {
    maxRow: number;
    maxCol: number;
}

export interface NavigationState {
    pointerPosition: GridPosition;
    navigationMode: boolean;
}

// Interface for Cell component interaction
export interface CellComponent {
    position: GridPosition;
    element: HTMLElement;
    selected: boolean;
    value: string | number;
    setSelected(selected: boolean): void;
}

// Function type for cell registration
export type RegisterCellFunction = (cellComponent: CellComponent) => void;
export type UnregisterCellFunction = (position: GridPosition) => void;
