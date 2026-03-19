// @ts-check

/**
 * JS Reserved Keywords (ESNext)
 */
const JS_RESERVED_WORDS = new Set([
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'debugger',
    'default',
    'delete',
    'do',
    'else',
    'enum',
    'export',
    'extends',
    'false',
    'finally',
    'for',
    'function',
    'if',
    'import',
    'in',
    'instanceof',
    'new',
    'null',
    'return',
    'super',
    'switch',
    'this',
    'throw',
    'true',
    'try',
    'typeof',
    'var',
    'void',
    'while',
    'with',
    'yield',
    'await',
    'let',
    'static',
    'public',
    'private',
    'protected',
    'interface',
]);

// Common Global Objects to avoid as property names
const GLOBAL_OBJECTS = new Set([
    'window',
    'document',
    'location',
    'top',
    'parent',
    'globalThis',
    'console',
    'Object',
    'Array',
    'String',
    'Number',
    'Boolean',
    'Function',
    'Symbol',
]);

/**
 * 
 * @param {string[]} array 
 */
function shuffle(array) {
  array.sort(() => Math.random() - 0.5);
}

/**
 * Manages name distribution from dictionary with conflict resolution
 */
export class NameProvider {
    /**
     * @param {string[]} dictionary
     * @param {Record<string, string>} manualMap
     * @param {Set<string>} forbidden
     */
    constructor(dictionary, manualMap, forbidden) {
        // Ensure unique dictionary words
        let items = dictionary.filter(
            item => !(GLOBAL_OBJECTS.has(item) || JS_RESERVED_WORDS.has(item))
        );

        shuffle(items);

        this.dictionary = [...new Set(items)];
        this.manualMap = manualMap;
        // Set of names that are already in use (globals, properties, and map values)
        this.used = new Set([...forbidden, ...Object.values(manualMap)]);

        this.cursor = 0;
        this.fallbackCounter = 0;
    }

    /**
     * Returns a valid unique name for the identifier
     * @param {string} oldName
     * @returns {string}
     */
    getNewName(oldName) {
        // 1. Priority: Manual mapping
        if (this.manualMap[oldName] && this.manualMap[oldName] !== oldName) {
            return this.manualMap[oldName];
        }

        // 2. Dictionary usage
        while (this.cursor < this.dictionary.length) {
            const candidate = this.dictionary[this.cursor++];
            if (!this.used.has(candidate)) {
                this.used.add(candidate);
                return candidate;
            }
        }

        // 3. Fallback logic
        let fallback;
        do {
            const base =
                this.dictionary.length > 0
                    ? this.dictionary[this.fallbackCounter % this.dictionary.length]
                    : 'v';
            fallback = `${base}_${Math.floor(this.fallbackCounter / this.dictionary.length)}`;
            this.fallbackCounter++;
        } while (this.used.has(fallback));

        this.used.add(fallback);
        return fallback;
    }
}
