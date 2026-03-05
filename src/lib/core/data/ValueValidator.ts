import type { CellValue, NumberFormat } from '../types/types.ts';

interface ValidationResult {
    isValid: boolean;
    value?: CellValue;
    error?: string;
    detectedType?: 'string' | 'number' | 'boolean' | 'null';
}

type ExpectedType = 'string' | 'number' | 'boolean' | 'auto';

export type { ValidationResult, ExpectedType };

export class ValueValidator {
    private numberFormat: NumberFormat;

    constructor(numberFormat: NumberFormat) {
        this.numberFormat = numberFormat;
    }

    validate(inputValue: string, expectedType?: ExpectedType): ValidationResult {
        if (inputValue.trim() === '') {
            return { isValid: true, value: '', detectedType: 'string' };
        }

        if (expectedType && expectedType !== 'auto') {
            return this.parseToSpecificType(inputValue, expectedType);
        }

        const numberResult = this.tryParseNumber(inputValue);
        if (numberResult.isValid) return numberResult;

        const boolResult = this.tryParseBoolean(inputValue);
        if (boolResult.isValid) return boolResult;

        return { isValid: true, value: inputValue, detectedType: 'string' };
    }

    validateHeader(inputValue: string): ValidationResult {
        const trimmed = inputValue.trim();

        if (trimmed === '') {
            return { isValid: false, error: 'Header value cannot be empty' };
        }

        if (trimmed.length > 100) {
            return { isValid: false, error: 'Header value is too long (max 100 characters)' };
        }

        const numberResult = this.tryParseNumber(trimmed);
        if (numberResult.isValid) return numberResult;

        return { isValid: true, value: trimmed, detectedType: 'string' };
    }

    private parseToSpecificType(inputValue: string, expectedType: 'string' | 'number' | 'boolean'): ValidationResult {
        switch (expectedType) {
            case 'string':
                return { isValid: true, value: inputValue, detectedType: 'string' };
            case 'number':
                return this.tryParseNumber(inputValue);
            case 'boolean':
                return this.tryParseBoolean(inputValue);
            default:
                return { isValid: false, error: `Unknown expected type: ${expectedType}` };
        }
    }

    private tryParseBoolean(inputValue: string): ValidationResult {
        const lower = inputValue.toLowerCase().trim();

        if (/^\d+$/.test(lower)) {
            return { isValid: false, error: 'Pure numeric value, should be parsed as number' };
        }

        if (['true', 'yes', 'y', 'on', 'sí', 'si'].includes(lower)) {
            return { isValid: true, value: true, detectedType: 'boolean' };
        }

        if (['false', 'no', 'n', 'off'].includes(lower)) {
            return { isValid: true, value: false, detectedType: 'boolean' };
        }

        return { isValid: false, error: 'Not a valid boolean value' };
    }

    private tryParseNumber(inputValue: string): ValidationResult {
        const trimmed = inputValue.trim();

        if (trimmed === '') {
            return { isValid: false, error: 'Empty input' };
        }

        if (trimmed.startsWith('.') || trimmed.startsWith(',')) {
            const withoutLeading = trimmed.substring(1);
            if (/^\d+$/.test(withoutLeading)) {
                const value = Number('0.' + withoutLeading);
                return { isValid: true, value, detectedType: 'number' };
            }
        }

        if (trimmed.endsWith('.') || trimmed.endsWith(',')) {
            const withoutTrailing = trimmed.substring(0, trimmed.length - 1);
            if (/^\d+$/.test(withoutTrailing)) {
                return { isValid: true, value: Number(withoutTrailing), detectedType: 'number' };
            }
        }

        if (/^-?\d+$/.test(trimmed)) {
            const value = Number(trimmed);
            if (!isNaN(value) && isFinite(value)) {
                return { isValid: true, value, detectedType: 'number' };
            }
        }

        const commaPositions = [...trimmed.matchAll(/,/g)].map(m => m.index!);
        const dotPositions   = [...trimmed.matchAll(/\./g)].map(m => m.index!);
        const commaCount = commaPositions.length;
        const dotCount   = dotPositions.length;

        if (commaCount === 0 && dotCount === 0) {
            return { isValid: false, error: 'Not a valid number' };
        }

        if (commaCount > 0 && dotCount > 0) {
            const lastComma = Math.max(...commaPositions);
            const lastDot   = Math.max(...dotPositions);

            if (lastComma > lastDot) {
                return this.validateAndParseLatinFormat(trimmed, dotPositions, lastComma);
            } else {
                return this.validateAndParseAngloFormat(trimmed, commaPositions, lastDot);
            }
        }

        if (commaCount > 1 && dotCount === 0) {
            return this.validateAndParseThousands(trimmed, commaPositions, 'anglo');
        }

        if (dotCount > 1 && commaCount === 0) {
            return this.validateAndParseThousands(trimmed, dotPositions, 'latin');
        }

        if ((commaCount === 1 && dotCount === 0) || (dotCount === 1 && commaCount === 0)) {
            return this.parseAmbiguousSeparator(trimmed);
        }

        return { isValid: false, error: 'Invalid number format' };
    }

    private validateAndParseLatinFormat(input: string, dotPositions: number[], decimalPos: number): ValidationResult {
        const beforeDecimal = input.substring(0, decimalPos);
        const afterDecimal  = input.substring(decimalPos + 1);

        if (!/^\d+$/.test(afterDecimal)) {
            return { isValid: false, error: 'Invalid decimal part' };
        }

        if (!this.validateThousandsPattern(beforeDecimal, dotPositions, '.')) {
            return { isValid: false, error: 'Invalid thousands pattern' };
        }

        const normalized = input.replace(/\./g, '').replace(',', '.');
        const value = Number(normalized);

        if (isNaN(value) || !isFinite(value)) {
            return { isValid: false, error: 'Failed to parse number' };
        }

        return { isValid: true, value, detectedType: 'number' };
    }

    private validateAndParseAngloFormat(input: string, commaPositions: number[], decimalPos: number): ValidationResult {
        const beforeDecimal = input.substring(0, decimalPos);
        const afterDecimal  = input.substring(decimalPos + 1);

        if (!/^\d+$/.test(afterDecimal)) {
            return { isValid: false, error: 'Invalid decimal part' };
        }

        if (!this.validateThousandsPattern(beforeDecimal, commaPositions, ',')) {
            return { isValid: false, error: 'Invalid thousands pattern' };
        }

        const normalized = input.replace(/,/g, '');
        const value = Number(normalized);

        if (isNaN(value) || !isFinite(value)) {
            return { isValid: false, error: 'Failed to parse number' };
        }

        return { isValid: true, value, detectedType: 'number' };
    }

    private validateAndParseThousands(input: string, positions: number[], format: NumberFormat): ValidationResult {
        const separator = format === 'latin' ? '.' : ',';

        if (!this.validateThousandsPattern(input, positions, separator)) {
            return { isValid: false, error: 'Invalid thousands pattern' };
        }

        const normalized = input.replace(new RegExp('\\' + separator, 'g'), '');
        const value = Number(normalized);

        if (isNaN(value) || !isFinite(value)) {
            return { isValid: false, error: 'Failed to parse number' };
        }

        return { isValid: true, value, detectedType: 'number' };
    }

    private validateThousandsPattern(input: string, positions: number[], separator: string): boolean {
        const parts = input.split(separator);

        if (!/^\d{1,3}$/.test(parts[0])) return false;

        for (let i = 1; i < parts.length; i++) {
            if (!/^\d{3}$/.test(parts[i])) return false;
        }

        return true;
    }

    private parseAmbiguousSeparator(input: string): ValidationResult {
        if (this.numberFormat === 'latin') {
            if (input.includes(',')) {
                const normalized = input.replace(',', '.');
                const value = Number(normalized);
                if (!isNaN(value) && isFinite(value)) {
                    return { isValid: true, value, detectedType: 'number' };
                }
            } else if (input.includes('.')) {
                const parts    = input.split('.');
                const afterDot = parts[1];

                if (afterDot.length === 3) {
                    const normalized = input.replace(/\./g, '');
                    const value = Number(normalized);
                    if (!isNaN(value) && isFinite(value)) {
                        return { isValid: true, value, detectedType: 'number' };
                    }
                } else {
                    const value = Number(input);
                    if (!isNaN(value) && isFinite(value)) {
                        return { isValid: true, value, detectedType: 'number' };
                    }
                }
            }
        } else {
            if (input.includes('.')) {
                const value = Number(input);
                if (!isNaN(value) && isFinite(value)) {
                    return { isValid: true, value, detectedType: 'number' };
                }
            } else if (input.includes(',')) {
                const parts      = input.split(',');
                const afterComma = parts[1];

                if (afterComma.length === 3) {
                    const normalized = input.replace(/,/g, '');
                    const value = Number(normalized);
                    if (!isNaN(value) && isFinite(value)) {
                        return { isValid: true, value, detectedType: 'number' };
                    }
                } else {
                    const normalized = input.replace(',', '.');
                    const value = Number(normalized);
                    if (!isNaN(value) && isFinite(value)) {
                        return { isValid: true, value, detectedType: 'number' };
                    }
                }
            }
        }

        return { isValid: false, error: 'Failed to parse ambiguous number' };
    }
}
