import type {
    GridPosition,
    ModifierState,
    RawKeyboardAnalysis,
    NavigationAnalysis,
    CommandAnalysis,
    ClickAnalysis,
    KeyCategory,
    CellMouseEvent,
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

    // PHASE 2: Specialized click analysis
    analyzeMouseEvent(event: CellMouseEvent): ClickAnalysis {
        const modifiers = event ? this.analyzeMouseModifiers(event.mouseEvent) : { shift: false, ctrl: false, alt: false };
        const clickType = event.type === 'dblclick' ? 'double' : this.determineClickType(event.mouseEvent);
        return {
            type: event.type,
            position: event.position,
            modifiers,
            clickType,
        };
    }

    // Analyze mouse event and extract modifier state
    analyzeMouseModifiers(event: MouseEvent): ModifierState {
        return {
            shift: event.shiftKey,
            ctrl: event.ctrlKey,
            alt: event.altKey
        };
    }

    // Determine click type from mouse event
    private determineClickType(event: MouseEvent): 'normal' | 'double' | 'right' | 'wheel' {
        if (event.button === 2) return 'right';
        if (event.button === 1) return 'wheel';
        if (event.detail === 2) return 'double';
        return 'normal';
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