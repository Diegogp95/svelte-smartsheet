import type {
    GridPosition,
    HeaderPosition,
    ModifierState,
    RawKeyboardAnalysis,
    NavigationAnalysis,
    CommandAnalysis,
    KeyCategory,
    CellMouseEvent,
    HeaderMouseEvent,
    MouseEventAnalysis,
    DraggingActionContext,
    NavigationAction,
    SelectionAction,
    OutsideScrollAnalysis,
} from './types';

export default class InputAnalyzer {
    private modifierState: ModifierState = { shift: false, ctrl: false, alt: false };

    // PHASE 1: Basic analysis for event categorization
    analyzeEvent(event: KeyboardEvent): RawKeyboardAnalysis {
        this.updateModifierState(event);
        const category = this.categorizeKey(event.key);
        return {
            key: event.key,
            modifiers: { ...this.modifierState },
            keyCategory: category,
            isRepeating: event.repeat,
            shouldPreventDefault: this.shouldPreventDefault(category, event),
        };
    }

    // PHASE 2: Specialized navigation analysis (only called if keyCategory === 'arrow')
    analyzeNavigation(basicAnalysis: RawKeyboardAnalysis): NavigationAnalysis {
        return {
            key: basicAnalysis.key,
            modifiers: basicAnalysis.modifiers,
            direction: this.getNavigationDirection(basicAnalysis.key),
        };
    }

    // PHASE 2: Specialized command analysis (only called if keyCategory === 'command')
    analyzeCommand(basicAnalysis: RawKeyboardAnalysis): CommandAnalysis {
        return {
            key: basicAnalysis.key,
            modifiers: basicAnalysis.modifiers,
            command: this.getCommandType(basicAnalysis.key),
        };
    }

    /**
     * Analyzes mouse events for cells and headers.
     * @param event The mouse event to analyze.
     * @param context The context in which the event occurred.
     * @returns The analysis result for the mouse event.
     */
    analyzeMouseEvent(event: CellMouseEvent | HeaderMouseEvent, isDragging: boolean,
        context: DraggingActionContext
        ): MouseEventAnalysis {
        const modifiers = this.analyzeMouseModifiers(event.mouseEvent);
        // ctrl + shift modifiers cancel each other
        if (modifiers.ctrl && modifiers.shift) {
            modifiers.ctrl = false;
            modifiers.shift = false;
        }

        // Determine component type and position
        const componentType = 'row' in event.position && 'col' in event.position ? 'cell' : 'header';
        const position = event.position;

        // CRITICAL: Navigation action based on event type and modifiers
        const navigationAction = this.createNavigationAction(event, isDragging, context, componentType, modifiers);

        // Selection action coordinated with navigation
        const selectionAction = this.createSelectionAction(event, isDragging, context, modifiers);

        return {
            type: event.type,
            componentType,
            position,
            navigationAction,
            selectionAction,
            draggingContext: { ...context } // Include the current dragging context
        };
    }

    // CRITICAL: Navigation action analysis - translated from processMouseNavigation logic
    private createNavigationAction(
        event: CellMouseEvent | HeaderMouseEvent,
        isDragging: boolean,
        context: DraggingActionContext,
        componentType: 'cell' | 'header',
        modifiers: ModifierState
    ): NavigationAction {
        const eventType = event.type;

        // MOUSEDOWN: Based on original processMouseNavigation logic
        if (eventType === 'mousedown') {
            if (modifiers.shift && !modifiers.ctrl) {
                // SHIFT+MOUSEDOWN: Update pointer but keep anchor (shift logic)
                if (isDragging) {
                    // Already dragging, return current position (no navigation change)
                    return 'none';
                }
                // Move pointer and start dragging
                return componentType === 'cell' ? 'update-drag' :
                       (event.position as HeaderPosition).headerType === 'row' ? 'start-row-drag' : 'start-col-drag';
            } else {
                // NORMAL/CTRL MOUSEDOWN: Set anchor and pointer (normal logic)
                if (isDragging) {
                    // Already dragging, return current position (no navigation change)
                    return 'none';
                }
                // Set anchor and pointer, start dragging
                return componentType === 'cell' ? 'start-cell-drag' :
                       (event.position as HeaderPosition).headerType === 'row' ? 'start-row-drag' : 'start-col-drag';
            }
        }

        // MOUSEENTER: Update pointer during drag
        if (eventType === 'mouseenter') {
            // Only act if position changed and we're dragging
            if (isDragging) {
                return 'continue-drag';
            }
            // Not dragging, no navigation action
            return 'none';
        }

        // MOUSEUP: End drag
        if (eventType === 'mouseup') {
            return 'end-drag';
        }

        // DBLCLICK: End drag state (for editing)
        if (eventType === 'dblclick') {
            return 'edit';
        }

        return 'none';
    }

    // Selection action analysis - translated from processClickSelection logic
    private createSelectionAction(
        event: CellMouseEvent | HeaderMouseEvent,
        isDragging: boolean,
        context: DraggingActionContext,
        modifiers: ModifierState,
    ): SelectionAction {
        const eventType = event.type;

        // DBLCLICK: Clear selection (for editing)
        if (eventType === 'dblclick') {
            return 'clear';
        }

        // MOUSEDOWN: Based on original processClickSelection logic
        if (eventType === 'mousedown') {
            if (modifiers.ctrl && !modifiers.shift) {
                // CTRL+MOUSEDOWN: Create new selection or start deselecting
                // Note: Original logic checks isCellSelected - this will be handled by SelectionHandler
                return 'add-selection'; // or 'remove-selection' - handler will determine based on current state
            } else if (modifiers.shift && !modifiers.ctrl) {
                // SHIFT+MOUSEDOWN: Update active selection
                return 'update-selection';
            } else {
                // NORMAL MOUSEDOWN: Clear and add new selection
                return 'new-selection';
            }
        }

        // MOUSEENTER: Continue selection during drag
        if (eventType === 'mouseenter') {
            // Only act if we're dragging (context will be checked by handlers)
            if (isDragging) {
                // Update active selection regardless of modifiers during drag
                return 'update-selection';
            }
            return 'none';
        }

        // MOUSEUP: Finalize selection
        if (eventType === 'mouseup') {
            // Original logic: mouseup on same cell with no modifiers = select single
            // This will be handled by SelectionHandler based on anchor == current position
            return 'finalize-selection';
        }

        return 'none';
    }

    analyzeMouseModifiers(event: MouseEvent): ModifierState {
        return {
            shift: event.shiftKey,
            ctrl: event.ctrlKey,
            alt: event.altKey
        };
    }

    // Update internal modifier state
    private updateModifierState(event: KeyboardEvent): void {
        this.modifierState.shift = event.shiftKey;
        this.modifierState.ctrl = event.ctrlKey;
        this.modifierState.alt = event.altKey;
    }

    // Categorize key by type
    private categorizeKey(key: string): KeyCategory {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return 'arrow';
        if (['Delete'].includes(key)) return 'delete';
        if (['Backspace'].includes(key)) return 'backspace';
        if (['Enter'].includes(key)) return 'edit';
        if (['Tab'].includes(key)) return 'tab';
        if (key === ' ') return 'space';

        // Command category: Any letter with Ctrl modifier
        if (this.modifierState.ctrl && key.length === 1 && /[a-zA-Z]/.test(key)) return 'command';

        // Write category: Characters that can be written (letters, numbers, symbols, etc.)
        if (this.isWritableCharacter(key)) return 'write';

        return 'other';
    }

    // Helper method to determine if a key represents a writable character
    private isWritableCharacter(key: string): boolean {
        // Single character check
        if (key.length !== 1) return false;

        // Alphanumeric characters
        if (/[a-zA-Z0-9]/.test(key)) return true;

        // Common symbols and punctuation that can be written
        if (/[áéíóúüñÁÉÍÓÚÜÑ]/.test(key)) return true; // Spanish accents
        if (/[àèìòùÀÈÌÒÙ]/.test(key)) return true; // Other accents
        if (/[çÇ]/.test(key)) return true; // Cedilla
        if (/[.,;:!?¡¿]/.test(key)) return true; // Punctuation
        if (/[\-_+=*\/\\|<>(){}[\]"'`~@#$%^&]/.test(key)) return true; // Symbols

        return false;
    }

    // Get navigation direction from arrow key
    private getNavigationDirection(key: string): 'up' | 'down' | 'left' | 'right' | null {
        const directions: Record<string, 'up' | 'down' | 'left' | 'right'> = {
            'ArrowUp': 'up', 
            'ArrowDown': 'down', 
            'ArrowLeft': 'left', 
            'ArrowRight': 'right'
        };
        return directions[key] || null;
    }

    // Get command type from key
    private getCommandType(key: string): | 'undo' | 'redo' | 'select-all' | 'save' | 'invalid-command' {
        const commands: Record<string, 'undo' | 'redo' | 'select-all' | 'save'> = {
            'z': 'undo',
            'y': 'redo',
            'a': 'select-all',
            's': 'save'
        };
        return commands[key.toLowerCase()] || 'invalid-command';
    }

    // Determine if default behavior should be prevented
    private shouldPreventDefault(category: KeyCategory, event: KeyboardEvent): boolean {

        // Prevent default for arrow keys (to avoid scrolling)
        if (category === 'arrow') return true;

        // Prevent default for commands
        if (category === 'command') {
            if (this.getCommandType(event.key) !== 'invalid-command') {
                return true;
            } else return false;
        }

        if (category === 'tab') return true;

        // Prevent default for Space (to avoid page scrolling)
        if (category === 'space') return true;

        // Preventing default for delete keys
        if (category === 'delete') return true;

        return false;
    }

    // Get current modifier state
    getCurrentModifiers(): ModifierState {
        return { ...this.modifierState };
    }

    /**
     * Create comprehensive outside dragging analysis with auto-scroll calculations
     * Used when mouse moves outside table during drag operations
     */
    createOutsideScrollAnalysis(
        mouseEvent: MouseEvent,
        tableContainer: HTMLDivElement,
        draggingContext: DraggingActionContext,
        gridDimensions?: { maxRow: number; maxCol: number }
    ): MouseEventAnalysis {
        const containerRect = tableContainer.getBoundingClientRect();
        const scrollAnalysis = this.analyzeScrollProximity(
            mouseEvent.clientX,
            mouseEvent.clientY,
            containerRect,
            gridDimensions
        );

        return {
            type: 'mouseenter', // Using mouseenter as placeholder for outside mouse movement
            componentType: undefined,
            position: undefined,
            navigationAction: 'continue-drag',
            selectionAction: 'none',
            draggingContext,
            outsideScrollAnalysis: scrollAnalysis
        };
    }

    /**
     * Create continue-drag analysis for auto-scroll selection updates
     * Used when auto-scroll moves pointer and needs to update selection
     */
    createContinueDragAnalysis(
        position: GridPosition,
        anchor: GridPosition
    ): MouseEventAnalysis {
        // Create a synthetic dragging context for continue-drag
        const syntheticContext: DraggingActionContext = {
            isOutsideDragging: false, // We're updating selection, not outside dragging
            dragType: 'cell', // Assume cell drag for auto-scroll
            dragOrigin: anchor
        };

        return {
            type: 'mouseenter', // Synthetic event type
            componentType: 'cell',
            position: position,
            navigationAction: 'continue-drag',
            selectionAction: 'update-selection',
            draggingContext: syntheticContext
        };
    }

    /**
     * Analyze scroll proximity and calculate auto-scroll parameters
     * Helper method for outside dragging analysis
     */
    private analyzeScrollProximity(
        mouseX: number,
        mouseY: number,
        containerRect: DOMRect,
        gridDimensions?: { maxRow: number; maxCol: number }
    ): OutsideScrollAnalysis {
        // Absolute limits
        const absoluteMinInterval = 10;   // Fastest possible scroll
        const absoluteMaxInterval = 200;  // Slowest possible scroll

        // Calculate dynamic limits based on table size
        // For very large tables, make minimum even smaller (faster scroll)
        const tableSizeFactor = gridDimensions
            ? Math.sqrt((gridDimensions.maxRow + 1) * (gridDimensions.maxCol + 1)) / 100
            : 1;

        // For large tables: smaller minimum interval (faster scroll)
        const minInterval = Math.max(absoluteMinInterval / Math.max(tableSizeFactor, 1), absoluteMinInterval * 0.5);
        const maxInterval = absoluteMaxInterval;

        // Calculate distances to each edge (positive when outside)
        const distanceTop = containerRect.top - mouseY;
        const distanceBottom = mouseY - containerRect.bottom;
        const distanceLeft = containerRect.left - mouseX;
        const distanceRight = mouseX - containerRect.right;

        // Initialize analysis result
        const analysis: OutsideScrollAnalysis = {
            direction: { row: 0, col: 0 },
            intervals: {},
            distances: {},
            edges: []
        };

        // Check vertical edges - NO THRESHOLD: scroll if mouse is outside (any distance)
        if (distanceTop > 0) {
            // Mouse above container - scroll up
            analysis.direction.row = -1;
            analysis.edges.push('top');
            analysis.distances.top = distanceTop;
            analysis.intervals.row = this.calculateScrollInterval(distanceTop, minInterval, maxInterval);
        } else if (distanceBottom > 0) {
            // Mouse below container - scroll down
            analysis.direction.row = 1;
            analysis.edges.push('bottom');
            analysis.distances.bottom = distanceBottom;
            analysis.intervals.row = this.calculateScrollInterval(distanceBottom, minInterval, maxInterval);
        }

        // Check horizontal edges - NO THRESHOLD: scroll if mouse is outside (any distance)
        if (distanceLeft > 0) {
            // Mouse to the left of container - scroll left
            analysis.direction.col = -1;
            analysis.edges.push('left');
            analysis.distances.left = distanceLeft;
            analysis.intervals.col = this.calculateScrollInterval(distanceLeft, minInterval, maxInterval);
        } else if (distanceRight > 0) {
            // Mouse to the right of container - scroll right
            analysis.direction.col = 1;
            analysis.edges.push('right');
            analysis.distances.right = distanceRight;
            analysis.intervals.col = this.calculateScrollInterval(distanceRight, minInterval, maxInterval);
        }

        return analysis;
    }

    /**
     * Calculate scroll interval based on distance from edge
     * The further from the edge = the smaller the interval (faster scroll)
     * No threshold - scrolls at any distance outside the table
     */
    private calculateScrollInterval(
        distance: number,
        minInterval: number,
        maxInterval: number
    ): number {
        // Use 50px as reference distance for speed calculation
        const referenceDistance = 50;

        // Normalize distance: 0 at edge, 1.0 at reference distance
        const normalizedDistance = Math.min(distance / referenceDistance, 1);

        // Linear interpolation: the further from the edge, the smaller the interval (faster scroll)
        // At the edge (distance = 0): maxInterval (slow)
        // At referenceDistance: minInterval (fast)
        const interval = maxInterval - (normalizedDistance * (maxInterval - minInterval));

        return Math.round(Math.max(minInterval, interval));
    }
}