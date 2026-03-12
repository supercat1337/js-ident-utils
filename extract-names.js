#!/usr/bin/env node
// @ts-check

/**
 * @fileoverview Extracts safe-to-rename identifiers from JS files.
 * Supports glob patterns, ES6+, and cross-platform paths (Windows/Unix).
 */

import fs from 'fs/promises';
import fg from 'fast-glob';
import parseArgs from 'minimist';
import * as parser from '@babel/parser';
import babelTraverse from '@babel/traverse';
const traverse = babelTraverse.default;

/** @const {Object} Babel parser configuration */
const PARSER_CONFIG = {
  sourceType: 'module',
  plugins: ['jsx', 'typescript', 'classProperties', 'classPrivateProperties', 'dynamicImport']
};

/** @const {Set<string>} Browser and Node.js globals that must not be renamed */
const GLOBAL_IGNORE = new Set([
  'window', 'document', 'console', 'process', 'global', 'globalThis',
  'module', 'exports', 'require', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'requestAnimationFrame', 'fetch',
  'Promise', 'Map', 'Set', 'Object', 'Array', 'String', 'Number',
  'Math', 'JSON', 'Boolean', 'Symbol', 'Error', 'undefined', 'null'
]);

/**
 * Displays help message
 */
function showHelp() {
  console.log(`
Usage: extract-names <glob-patterns> [options]

Options:
  -o, --output <file>  Output JSON file path (default: names.json)
  --keep-exports       Ignore identifiers that are exported (default: true)
  -h, --help           Show this help message

Example:
  node extract-names.js "C:\\path\\to\\file.js" -o mapping.json
  node extract-names.js "src/**/*.js" --output names.json
  `);
}

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    alias: { o: 'output', h: 'help' },
    boolean: ['help', 'keep-exports'],
    default: { output: 'names.json', 'keep-exports': true }
  });

  if (argv.help || argv._.length === 0) {
    showHelp();
    process.exit(0);
  }

  try {
    // FIX: Normalize Windows paths (backslash to forward slash) for fast-glob
    const patterns = argv._.map(p => p.replace(/\\/g, '/'));
    const files = await fg(patterns);

    if (files.length === 0) {
      console.warn('⚠️ No files matched the provided patterns. If using Windows paths, ensure they are correct.');
      return;
    }

    const identifiers = new Set();

    for (const file of files) {
      const code = await fs.readFile(file, 'utf8');
      const ast = parser.parse(code, PARSER_CONFIG);

      traverse(ast, {
        BindingIdentifier(path) {
          const { name } = path.node;
          if (GLOBAL_IGNORE.has(name) || path.scope.hasGlobal(name)) return;

          if (argv['keep-exports']) {
            const isExported = path.findParent(p => 
              p.isExportNamedDeclaration() || 
              p.isExportDefaultDeclaration() || 
              p.isExportAllDeclaration()
            );
            if (isExported) return;
          }
          identifiers.add(name);
        },
        'ImportSpecifier|ImportDefaultSpecifier|ImportNamespaceSpecifier'(path) {
          identifiers.add(path.node.local.name);
        }
      });
    }

    const mapping = Object.fromEntries(
      Array.from(identifiers).sort().map(name => [name, name])
    );

    await fs.writeFile(argv.output, JSON.stringify(mapping, null, 2));
    console.log(`✅ Extracted ${identifiers.size} names from ${files.length} files.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();