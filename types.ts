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
    headerAnchorRow: number;          // Anchor for row header selection
    headerPointerRow: number;         // Pointer for row header selection
    headerAnchorCol: number;          // Anchor for column header selection
    headerPointerCol: number;         // Pointer for column header selection
    isDragging: boolean;
    draggingContext: DraggingActionContext;
}

// Navigation anchors and pointers for selection operations
export interface NavigationAnchorsAndPointers {
    // Cell navigation state
    cellPointer: GridPosition;        // Current cell pointer position
    cellAnchor: GridPosition;         // Cell anchor for rectangular selections
    headerAnchorRow: number;          // Anchor for row header selection
    headerPointerRow: number;         // Pointer for row header selection
    headerAnchorCol: number;          // Anchor for column header selection
    headerPointerCol: number;         // Pointer for column header selection
}

// Type for cell values, can be extended later if needed
export type CellValue = string | number | boolean | null;
export type HeaderValue = string;

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
    selected: boolean;
    value: CellValue;
    extraProps: T;
    styles: {
        styling: string;
        tailwindStyling: string;
    };
}

export interface HeaderComponent<T = undefined> {
    position: HeaderPosition;
    selected: boolean;
    value: HeaderValue;
    editing: boolean;
    extraProps: T;
    styles: {
        styling: string;
        tailwindStyling: string;
    };
}

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
    'bg-color'?: string;
    'bg-opacity'?: number;
    'border-color'?: string;
    'border-width'?: string;
    'border-style'?: string;
    'border-radius'?: string;
    'text-color'?: string;
    'opacity'?: number;
}

// Keyboard event analysis types
export type KeyCategory =
    'arrow' |
    'edit' |
    'confirm' |
    'backspace' |
    'cancel' |
    'delete' |
    'space' |
    'command' |
    'write' |
    'tab' |
    'other';

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
    mouseEvent: MouseEvent;
};

export interface HeaderMouseEvent {
    type: GridMouseInteractionType;
    position: HeaderPosition;
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
// Virtualization types
export interface RenderArea {
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
}

export interface VisibleComponents<TExtraProps, TRowHeaderProps, TColHeaderProps> {
    cells: CellComponent<TExtraProps>[];
    rowHeaders: HeaderComponent<TRowHeaderProps>[];
    colHeaders: HeaderComponent<TColHeaderProps>[];
    cornerHeader: HeaderComponent | undefined;
}

export interface EditingState<TExtraProps, TRowHeaderProps, TColHeaderProps> {
    type: 'cell' | 'header';
    position: GridPosition | HeaderPosition;
    component: CellComponent<TExtraProps> | HeaderComponent<TRowHeaderProps> | HeaderComponent<TColHeaderProps>;
    inputElement: HTMLInputElement | null;
}

// Update state for operations feedback
export interface ProcessingState {
    isProcessing: boolean;
    message: string;
    operation?: string; // Optional: type of operation
    source?: 'internal' | 'external'; // Track the origin of the processing state
}
