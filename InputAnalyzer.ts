import type {
    GridPosition,
    ModifierState,
    RawKeyboardAnalysis,
    NavigationAnalysis,
    ClickAnalysis,
    KeyCategory,
} from './types';

export default class InputAnalyzer {
    private modifierState: ModifierState = { shift: false, ctrl: false, alt: false };

    // PHASE 1: Basic analysis for event categorization
    analyzeEvent(event: KeyboardEvent): RawKeyboardAnalysis {
        this.updateModifierState(event);

        return {
            key: event.key,
            modifiers: { ...this.modifierState },
            keyCategory: this.categorizeKey(event.key),
            isRepeating: event.repeat,
            shouldPreventDefault: this.shouldPreventDefault(event)
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

    // PHASE 2: Specialized click analysis
    analyzeClick(event: MouseEvent | undefined, position: GridPosition): ClickAnalysis {
        const modifiers = event ? this.analyzeMouseEvent(event) : { shift: false, ctrl: false, alt: false };
        return {
            position,
            modifiers,
            clickType: event ? this.determineClickType(event) : 'normal',
        };
    }

    // Analyze mouse event and extract modifier state
    analyzeMouseEvent(event: MouseEvent): ModifierState {
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
        if (['Enter', 'Tab'].includes(key)) return 'confirm';
        if (['Escape'].includes(key)) return 'cancel';
        if (['Delete', 'Backspace'].includes(key)) return 'delete';
        if (key === ' ') return 'space';
        if (key.length === 1 && /[a-zA-Z0-9]/.test(key)) return 'alphanumeric';
        return 'other';
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

    // Determine click type from mouse event
    private determineClickType(event: MouseEvent): 'normal' | 'double' | 'right' {
        if (event.button === 2) return 'right';
        if (event.detail === 2) return 'double';
        return 'normal';
    }

    // Determine if default behavior should be prevented
    private shouldPreventDefault(event: KeyboardEvent): boolean {
        const key = event.key;

        // Prevent default for arrow keys (to avoid scrolling)
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return true;

        // Prevent default for Tab (to avoid focus changes)
        if (key === 'Tab') return true;

        // Prevent default for Space (to avoid page scrolling)
        if (key === ' ') return true;

        return false;
    }

    // Get current modifier state
    getCurrentModifiers(): ModifierState {
        return { ...this.modifierState };
    }
}