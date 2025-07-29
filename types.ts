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
    anchorPosition?: GridPosition;  // For rectangular selection
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

// Keyboard event analysis types
export type KeyCategory = 'arrow' | 'confirm' | 'cancel' | 'delete' | 'space' | 'alphanumeric' | 'other';

export interface ModifierState {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
}

export interface RawKeyboardAnalysis {
    key: string;
    modifiers: ModifierState;
    keyCategory: KeyCategory;
    isRepeating: boolean;
    shouldPreventDefault: boolean;
}

// Specialized analysis interfaces for two-phase analysis
export interface NavigationAnalysis {
    key: string;
    modifiers: ModifierState;
    direction: 'up' | 'down' | 'left' | 'right' | null;
}

export interface ClickAnalysis {
    position: GridPosition;
    modifiers: ModifierState;
    clickType: 'normal' | 'double' | 'right';
}
