export interface GridPosition {
    row: number;
    col: number;
}

export interface HeaderPosition {
    index: number;
    elementType: 'row' | 'col';
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

// Type for cell values, can be extended later if needed
export type CellValue = string | number | boolean | null;
export type HeaderValue = string | number;

// Interface for Cell component interaction with simplified extraProps
// T defaults to undefined, but when specified, should extend Record<string, any>
export interface CellComponent<T = undefined> {
    position: GridPosition;
    element: HTMLElement;
    selected: boolean;
    value: CellValue; // Updated to use CellValue type
    editing: boolean;
    inputElement: HTMLInputElement;
    inputValue: CellValue; // Intermediate value for input handling
    extraProps: T; // Simplified: just T directly
    setSelected(selected: boolean): void;
    setEditing(editing: boolean): void;
    setInputFocus(): void;
    setInputValue(value: CellValue): void;
    setValue(value: CellValue): void; // Method to update the cell's value
    setExtraProps(props: T): void; // Simplified: just T directly
    triggerFlash(): void; // Method to trigger visual flash effect when value changes
}

export interface HeaderComponent {
    position: HeaderPosition;
    element: HTMLElement;
    selected: boolean;
    value: HeaderValue;
    editing: boolean;
    inputElement: HTMLInputElement;
    inputValue: HeaderValue;
    readOnly: boolean;
    setSelected(selected: boolean): void;
    setEditing(editing: boolean): void;
    setInputFocus(): void;
    setInputValue(value: HeaderValue): void;
    setValue(value: HeaderValue): void;
    triggerFlash(): void;
}

// Function type for cell registration
export type OnCellCreation<T = undefined> = (cellComponent: CellComponent<T>) => void;
export type OnCellDestruction<T = undefined> = (cellComponent: CellComponent<T>) => void;

// Function type for header registration
export type OnHeaderCreation = (headerComponent: HeaderComponent) => void;
export type OnHeaderDestruction = (headerComponent: HeaderComponent) => void;

// Background properties for cell styling
export interface BackgroundProperties {
    'background-color'?: string;
    'border-color'?: string;
    'border-width'?: string;
    'border-style'?: string;
    'border-radius'?: string;
    'text-color'?: string;
    'opacity'?: number;
}
export interface TailwindProperties {
    'bg'?: string[];
    'border'?: string[];
    'rounded'?: string[];
    'text'?: string[];
    'opacity'?: number;
}

// Interface for CellBackground component interaction
export interface CellBackgroundComponent {
    position: GridPosition;
    element: HTMLElement;
    backgroundProperties: BackgroundProperties;
    tailwindProperties: TailwindProperties;
    setBackgroundProperties: (props: BackgroundProperties) => void;
    applyBackgroundProperties: () => void;
    clearBackgroundProperties: () => void;
    setTailwindProperties: (props: TailwindProperties) => void;
    applyTailwindProperties: () => void;
    clearTailwindProperties: () => void;
}

// Function type for background registration
export type OnBackgroundCreation = (backgroundComponent: CellBackgroundComponent) => void;
export type OnBackgroundDestruction = (backgroundComponent: CellBackgroundComponent) => void;

// Keyboard event analysis types
export type KeyCategory = 'arrow' | 'edit' | 'confirm' | 'backspace' | 'cancel' | 'delete' | 'space' | 'command' | 'write' | 'other';

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

export interface CommandAnalysis {
    key: string;
    modifiers: ModifierState;
    command: 'undo' | 'redo' | 'select-all' | 'save' | 'invalid-command';
}

export interface ClickAnalysis {
    type: 'mousedown' | 'mouseenter' | 'mouseup' | 'dblclick';
    position: GridPosition;
    modifiers: ModifierState;
    clickType: 'normal' | 'double' | 'right' | 'wheel';
}

export interface CellMouseEvent {
    type: 'mousedown' | 'mouseenter' | 'mouseup' | 'dblclick';
    position: GridPosition;
    selected: boolean;
    value: CellValue;
    mouseEvent: MouseEvent;
};

export interface HeaderMouseEvent {
    type: 'mousedown' | 'mouseenter' | 'mouseup' | 'dblclick';
    position: HeaderPosition;
    selected: boolean;
    value: HeaderValue;
    mouseEvent: MouseEvent;
}