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
    MouseActionContext,
    NavigationAction,
    SelectionAction,
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
    analyzeMouseEvent(event: CellMouseEvent | HeaderMouseEvent, context: MouseActionContext
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
        const navigationAction = this.createNavigationAction(event, context, componentType, modifiers);

        // Selection action coordinated with navigation
        const selectionAction = this.createSelectionAction(event, context, modifiers);

        return {
            type: event.type as 'mousedown' | 'mouseenter' | 'mouseup' | 'dblclick',
            componentType,
            position,
            navigationAction,
            selectionAction,
        };
    }

    // CRITICAL: Navigation action analysis - translated from processMouseNavigation logic
    private createNavigationAction(
        event: CellMouseEvent | HeaderMouseEvent,
        context: MouseActionContext,
        componentType: 'cell' | 'header',
        modifiers: ModifierState
    ): NavigationAction {
        const eventType = event.type;

        // MOUSEDOWN: Based on original processMouseNavigation logic
        if (eventType === 'mousedown') {
            if (modifiers.shift && !modifiers.ctrl) {
                // SHIFT+MOUSEDOWN: Update pointer but keep anchor (shift logic)
                if (context.isDragging) {
                    // Already dragging, return current position (no navigation change)
                    return 'none';
                }
                // Move pointer and start dragging
                return componentType === 'cell' ? 'update-drag' :
                       (event.position as HeaderPosition).headerType === 'row' ? 'start-row-drag' : 'start-col-drag';
            } else {
                // NORMAL/CTRL MOUSEDOWN: Set anchor and pointer (normal logic)
                if (context.isDragging) {
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
            if (context.isDragging) {
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
        context: MouseActionContext,
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
            if (context.isDragging) {
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
}