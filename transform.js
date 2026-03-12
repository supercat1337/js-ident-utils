#!/usr/bin/env node
// @ts-check

/**
 * @fileoverview Replaces identifiers in JS files using a dictionary.
 * Supports Windows paths and prevents collisions with global APIs.
 */

import fs from 'fs/promises';
import path from 'path';
import parseArgs from 'minimist';
import * as parser from '@babel/parser';
import babelTraverse from '@babel/traverse';
const traverse = babelTraverse.default;
import babelGenerate from '@babel/generator';
const generate = babelGenerate.default;

/** @const {Object} Babel parser configuration */
const PARSER_CONFIG = {
    sourceType: 'module',
    plugins: ['jsx', 'typescript', 'classProperties', 'classPrivateProperties', 'dynamicImport'],
};

/**
 * Manages name distribution from dictionary with conflict resolution
 */
class NameProvider {
    /**
     * @param {string[]} dictionary
     * @param {Record<string, string>} manualMap
     * @param {Set<string>} forbidden
     */
    constructor(dictionary, manualMap, forbidden) {
        // Ensure unique dictionary words
        this.dictionary = [...new Set(dictionary)];
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

/**
 * Displays help message
 */
function showHelp() {
    console.log(`
Usage: transform <input-file> [options]

Options:
  -m, --map <file>   JSON mapping file (from extract-names)
  -d, --dict <file>  Text file with words for renaming
  -o, --output <file> Output file path
  -h, --help         Show this help message
  `);
}

async function main() {
    const argv = parseArgs(process.argv.slice(2), {
        alias: { m: 'map', d: 'dict', o: 'output', h: 'help' },
        string: ['map', 'dict', 'output'],
        boolean: ['help'],
    });

    if (argv.help || argv._.length === 0) {
        showHelp();
        process.exit(0);
    }

    const inputPath = path.normalize(argv._[0]);

    try {
        const code = await fs.readFile(inputPath, 'utf8');

        // Load and validate manual map
        const manualMap = argv.map
            ? JSON.parse(await fs.readFile(path.normalize(argv.map), 'utf8'))
            : {};

        // --- NEW: Duplicate check in mapping ---
        const mappedValues = Object.values(manualMap);
        const uniqueValues = new Set(mappedValues);
        if (uniqueValues.size !== mappedValues.length) {
            console.warn('⚠️  Warning: The mapping file contains duplicate target names.');
            console.warn('   This might cause conflicts if variables share the same scope.\n');
        }
        // ---------------------------------------

        const dictionary = argv.dict
            ? (await fs.readFile(path.normalize(argv.dict), 'utf8')).split(/\s+/).filter(Boolean)
            : [];

        const ast = parser.parse(code, PARSER_CONFIG);

        // Pass 1: Collect forbidden names (existing properties & globals)
        const forbidden = new Set();
        traverse(ast, {
            MemberExpression(path) {
                if (!path.node.computed && path.node.property.type === 'Identifier') {
                    forbidden.add(path.node.property.name);
                }
            },
            Identifier(path) {
                if (path.scope.hasGlobal(path.node.name)) {
                    forbidden.add(path.node.name);
                }
            },
        });

        const nameProvider = new NameProvider(dictionary, manualMap, forbidden);

        // Pass 2: Renaming
        traverse(ast, {
            Scopable(path) {
                for (const [oldName] of Object.entries(path.scope.bindings)) {
                    if (manualMap[oldName] || dictionary.length > 0) {
                        const newName = nameProvider.getNewName(oldName);
                        path.scope.rename(oldName, newName);
                    }
                }
            },
        });

        const outputCode = generate(ast, { compact: false, comments: true }).code;
        const outputPath = argv.output
            ? path.normalize(argv.output)
            : inputPath.replace(/\.js$/, '.min.js');

        await fs.writeFile(outputPath, outputCode);
        console.log(`✅ Success: ${outputPath}`);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

main();
