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
    anchorPosition: GridPosition;  // For rectangular selection,
    mousePosition?: GridPosition; // For mouse-based navigation
    isDragging: boolean; // Indicates if a drag operation is in progress
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
export type OnCellCreation = (cellComponent: CellComponent) => void;
export type OnCellDestruction = (cellComponent: CellComponent) => void;

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
    type: 'mousedown' | 'mouseenter' | 'mouseup';
    position: GridPosition;
    modifiers: ModifierState;
    clickType: 'normal' | 'double' | 'right' | 'wheel';
}

export interface CellMouseEvent {
    type: 'mousedown' | 'mouseenter' | 'mouseup';
    position: GridPosition;
    selected: boolean;
    value: string | number;
    mouseEvent: MouseEvent;
};