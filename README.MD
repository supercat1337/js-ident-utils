# JS Ident Utils 🛠️

A lightweight, cross-platform toolkit for extracting and renaming JavaScript identifiers. Designed for smart obfuscation using dictionaries, while maintaining safety for global APIs, object properties, and ESM exports.

## Features

- **Smart Renaming**: Use a custom dictionary (`.txt`) or a manual mapping (`.json`).
- **Infinite Fallback**: If the dictionary is exhausted, it generates new names using suffixes.
- **Safety First**: Automatically protects global APIs, object properties, and public exports.
- **Modern JS Support**: ES6+ (ESM), TypeScript, JSX, and Legacy ES5.
- **Windows Friendly**: Native support for backslashes and cross-platform path normalization.

---

## Installation

```bash
git clone https://github.com/supercat1337/js-ident-utils.git
cd js-ident-utils
npm install
npm link
```

---

## Core Workflow

### 1. Extract Identifiers

Scans your source files and collects identifiers that are safe to rename.

```bash
ident-extract "src/**/*.js" --output names.json

```

### 2. Transform Code

Applies renaming to the target bundle.

```bash
ident-rename bundle.js --map names.json --dict words.txt --output bundle.min.js

```

---

## Advanced Mapping & Dictionary Logic

The `ident-rename` utility operates with a specific priority system to give you full control over the output names.

### Priority Levels:

1. **Manual Map (`--map`)**: If an identifier exists in the JSON file and has a different value, this value is used first.
2. **Dictionary (`--dict`)**: If an identifier is not in the map (or is mapped to itself), the tool picks the next unique word from the dictionary.
3. **Fallback**: If the dictionary is exhausted, the tool generates a name like `word_1`, `word_2`, etc.

### Usage Scenarios:

#### Scenario A: Precise Renaming (Map Only)

If you want to rename **only specific** variables and leave everything else as is, provide only the `--map` file:

```bash
ident-rename input.js --map names.json

```

- `secretKey` → `k` (if defined in JSON)
- `internalVar` → `internalVar` (remains unchanged)

#### Scenario B: Hybrid Mode (Map + Dictionary)

If you want specific names for key functions but want to obfuscate everything else with "pretty" words:

```bash
ident-rename input.js --map names.json --dict words.txt

```

- `mainHandler` → `init` (from Map)
- `temp_123` → `apple` (from Dictionary)

#### Scenario C: Randomize All (Dictionary Only)

To completely obfuscate the code using only your dictionary:

```bash
ident-rename input.js --dict words.txt

```

---

## Collision Protection

The tool is "context-aware". It will **never** use a name from your dictionary or map if:

- It is a **Global API** (like `window` or `fetch`).
- It is already used as an **Object Property** in your code (e.g., if your code has `user.name`, the tool will skip the word `name` to avoid breaking logic).

## License

MIT
