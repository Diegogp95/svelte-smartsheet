export interface GridPosition {
    row: number;
    col: number;
}

export interface HeaderPosition {
    index: number;
    headerType: 'row' | 'col' | 'corner';
}

export interface GridDimensions {
    maxRow: number;
    maxCol: number;
}

// Outside scroll analysis for auto-scroll behavior
export interface OutsideScrollAnalysis {
    direction: { row: number; col: number };           // -1, 0, 1
    intervals: { row?: number; col?: number };         // Intervals in ms per dimension
    distances: { top?: number; bottom?: number; left?: number; right?: number };
    edges: ('top' | 'bottom' | 'left' | 'right')[];   // Edges that are affecting
}

export interface DraggingActionContext {
    dragType?: 'cell' | 'row' | 'col';
    isOutsideDragging: boolean; // Indicates if dragging outside the table
    dragOrigin?: GridPosition | HeaderPosition;
    outsideDraggingState?: OutsideScrollAnalysis;
    activeTimers?: {                                    // Active timers for auto-scroll
        rowTimerId?: number;                           // Timer for vertical scroll
        colTimerId?: number;                           // Timer for horizontal scroll
    };
}

export type NavigationAction =
    | 'start-cell-drag'
    | 'start-row-drag'
    | 'start-col-drag'
    | 'update-drag'
    | 'continue-drag'
    | 'end-drag'
    | 'edit'
    | 'none';

export type SelectionAction =
    | 'new-selection'
    | 'add-selection'
    | 'remove-selection'
    | 'update-selection'
    | 'finalize-selection'
    | 'clear'
    | 'none';

export interface NavigationState {
    pointerPosition: GridPosition;
    navigationMode: boolean;
    anchorPosition: GridPosition;  // For rectangular selection,
    mousePosition?: GridPosition; // For mouse-based navigation
    isDragging: boolean;
    draggingContext: DraggingActionContext;
}

// Type for cell values, can be extended later if needed
export type CellValue = string | number | boolean | null;
export type HeaderValue = string | number;

// Flash color options
export type FlashColor = 'blue'
    | 'green'
    | 'red'
    | 'orange'
    | 'yellow'
    | 'purple'
    | 'pink'
    | 'cyan'
    | 'magenta';

export interface FlashOptions {
    color?: FlashColor | string; // Predefined color or custom RGB/hex
    duration?: number; // Duration in milliseconds, default 800
}

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
    triggerFlash(options?: FlashOptions): void; // Method to trigger visual flash effect when value changes
}

export interface HeaderComponent<T = undefined> {
    position: HeaderPosition;
    element: HTMLElement;
    selected: boolean;
    value: HeaderValue;
    editing: boolean;
    inputElement: HTMLInputElement;
    inputValue: HeaderValue;
    extraProps: T;
    readOnly: boolean;
    setSelected(selected: boolean): void;
    setEditing(editing: boolean): void;
    setInputFocus(): void;
    setInputValue(value: HeaderValue): void;
    setValue(value: HeaderValue): void;
    setExtraProps(props: T): void;
    triggerFlash(options?: FlashOptions): void;
}

// Function type for cell registration
export type OnCellCreation<T = undefined> = (cellComponent: CellComponent<T>) => void;
export type OnCellDestruction<T = undefined> = (cellComponent: CellComponent<T>) => void;

// Function type for header registration
export type OnHeaderCreation<T = undefined> = (headerComponent: HeaderComponent<T>) => void;
export type OnHeaderDestruction<T = undefined> = (headerComponent: HeaderComponent<T>) => void;

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

export interface HeaderBackgroundComponent {
    position: HeaderPosition;
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
export type OnHeaderBackgroundCreation = (backgroundComponent: HeaderBackgroundComponent) => void;
export type OnHeaderBackgroundDestruction = (backgroundComponent: HeaderBackgroundComponent) => void;

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

export type GridMouseInteractionType = 'mousedown' | 'mouseenter' | 'mouseup' | 'dblclick' | 'middleclick' | 'contextmenu';

export interface CellMouseEvent {
    type: GridMouseInteractionType;
    position: GridPosition;
    selected: boolean;
    value: CellValue;
    mouseEvent: MouseEvent;
};

export interface HeaderMouseEvent {
    type: GridMouseInteractionType;
    position: HeaderPosition;
    selected: boolean;
    value: HeaderValue;
    mouseEvent: MouseEvent;
}

export interface MouseEventAnalysis {
    type: GridMouseInteractionType;
    componentType: 'cell' | 'header' | undefined;
    position: GridPosition | HeaderPosition | undefined;
    navigationAction: NavigationAction;
    selectionAction: SelectionAction;
    draggingContext: DraggingActionContext;
    outsideScrollAnalysis?: OutsideScrollAnalysis; // Optional analysis for outside scrolling
}