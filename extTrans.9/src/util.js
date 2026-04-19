// utils.js
// Utility functions for the Chrome extension.

/**
 * Detects the type of a given DOM element.
 *
 * @param {Element|Node} element - The DOM element or node to inspect.
 * @returns {string} The detected element type. Possible values:
 *   'text'          – plain text node (no input/select/textarea/checkbox etc.)
 *   'input:text'    – <input type="text">
 *   'input:password' – <input type="password">
 *   'input:email'  – <input type="email">
 *   'input:number' – <input type="number">
 *   'input:checkbox' – <input type="checkbox">
 *   'input:radio'  – <input type="radio">
 *   'select'        – <select> element
 *   'textarea'      – <textarea> element
 *   'checkbox'      – synonym for 'input:checkbox'
 *   'radio'         – synonym for 'input:radio'
 *   'unknown'       – any other element type
 */
function detectElementType(element) {
    console.log('detectElementType called with', element);

    if (!element) {
        return 'unknown';
    }

    // If it's a Text node (nodeType === 3) and not within an input-like element
    if (element.nodeType === Node.TEXT_NODE) {
        return 'text';
    }

    if (element instanceof HTMLInputElement) {
        const type = element.type.toLowerCase();
        switch (type) {
            case 'text':
                return 'input:text';
            case 'password':
                return 'input:password';
            case 'email':
                return 'input:email';
            case 'number':
                return 'input:number';
            case 'checkbox':
                return 'input:checkbox';
            case 'radio':
                return 'input:radio';
            default:
                return `input:${type}`;
        }
    }

    if (element instanceof HTMLSelectElement) {
        return 'select';
    }

    if (element instanceof HTMLTextAreaElement) {
        return 'textarea';
    }

    // Additional explicit shortcuts for checkbox/radio when they might be passed as generic element
    if (element.tagName === 'INPUT') {
        const type = element.getAttribute('type')?.toLowerCase();
        if (type === 'checkbox') return 'checkbox';
        if (type === 'radio') return 'radio';
    }

    return 'unknown';
}

/**
 * Converts a raw value to a format suitable for a target element type.
 *
 * @param {*} value - The raw value (string, number, boolean, etc.).
 * @param {string} targetType - The target element type string as returned by `detectElementType`.
 * @returns {*} The converted value appropriate for the target element.
 */
function convertValue(value, targetType) {
    console.log('convertValue called with', { value, targetType });

    if (targetType === 'checkbox' || targetType === 'input:checkbox' || targetType === 'radio' || targetType === 'input:radio') {
        if (typeof value === 'string') {
            const lowered = value.trim().toLowerCase();
            return lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on';
        }
        return Boolean(value);
    }

    if (targetType === 'input:number') {
        const num = Number(value);
        return Number.isNaN(num) ? 0 : num;
    }

    // For other input types, ensure the value is a string (most form fields expect string values)
    if (typeof value !== 'string') {
        return String(value);
    }

    return value;
}
