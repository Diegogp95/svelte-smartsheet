import type { HeaderPosition, HeaderValue } from '../types/types.ts';

/**
 * Value object representing a single header value change.
 * Immutable by convention — never mutate after construction.
 */
export class HeaderChange {
    constructor(
        public readonly position: HeaderPosition,
        public readonly oldValue: HeaderValue,
        public readonly newValue: HeaderValue,
    ) {}

    getType(): 'header' {
        return 'header';
    }

    getPositionKey(): string {
        return `header-${this.position.headerType}-${this.position.index}`;
    }

    hasValueChanged(): boolean {
        return this.oldValue !== this.newValue;
    }

    toString(): string {
        return `Header(${this.position.headerType}[${this.position.index}]): ${this.oldValue} → ${this.newValue}`;
    }
}
