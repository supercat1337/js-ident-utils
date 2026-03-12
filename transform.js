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

const PARSER_CONFIG = {
  sourceType: 'module',
  plugins: ['jsx', 'typescript', 'classProperties', 'classPrivateProperties', 'dynamicImport']
};

class NameProvider {
  constructor(dictionary, manualMap, forbidden) {
    this.dictionary = [...new Set(dictionary)];
    this.manualMap = manualMap;
    this.used = new Set([...forbidden, ...Object.values(manualMap)]);
    this.cursor = 0;
    this.fallbackCounter = 0;
  }

  getNewName(oldName) {
    if (this.manualMap[oldName] && this.manualMap[oldName] !== oldName) {
      return this.manualMap[oldName];
    }

    while (this.cursor < this.dictionary.length) {
      const candidate = this.dictionary[this.cursor++];
      if (!this.used.has(candidate)) {
        this.used.add(candidate);
        return candidate;
      }
    }

    let fallback;
    do {
      const base = this.dictionary.length > 0 ? this.dictionary[this.fallbackCounter % this.dictionary.length] : 'v';
      fallback = `${base}_${Math.floor(this.fallbackCounter / this.dictionary.length)}`;
      this.fallbackCounter++;
    } while (this.used.has(fallback));

    this.used.add(fallback);
    return fallback;
  }
}

function showHelp() {
  console.log(`
Usage: transform <input-file> [options]

Options:
  -m, --map <file>   JSON mapping file
  -d, --dict <file>  Dictionary text file
  -o, --output <file> Output path
  -h, --help         Show this help message
  `);
}

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    alias: { m: 'map', d: 'dict', o: 'output', h: 'help' },
    string: ['map', 'dict', 'output'],
    boolean: ['help']
  });

  if (argv.help || argv._.length === 0) {
    showHelp();
    process.exit(0);
  }

  // Normalize path for Windows
  const inputPath = path.normalize(argv._[0]);

  try {
    const code = await fs.readFile(inputPath, 'utf8');
    const manualMap = argv.map ? JSON.parse(await fs.readFile(path.normalize(argv.map), 'utf8')) : {};
    const dictionary = argv.dict 
      ? (await fs.readFile(path.normalize(argv.dict), 'utf8')).split(/\s+/).filter(Boolean)
      : [];

    const ast = parser.parse(code, PARSER_CONFIG);

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
      }
    });

    const nameProvider = new NameProvider(dictionary, manualMap, forbidden);

    traverse(ast, {
      Scopable(path) {
        for (const [oldName] of Object.entries(path.scope.bindings)) {
          if (manualMap[oldName] || dictionary.length > 0) {
            path.scope.rename(oldName, nameProvider.getNewName(oldName));
          }
        }
      }
    });

    const outputCode = generate(ast, { compact: false, comments: true }).code;
    const outputPath = argv.output ? path.normalize(argv.output) : inputPath.replace(/\.js$/, '.min.js');

    await fs.writeFile(outputPath, outputCode);
    console.log(`✅ Transformed: ${outputPath}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();