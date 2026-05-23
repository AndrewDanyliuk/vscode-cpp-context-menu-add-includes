# C++ Add Include Path

Right-click any folder in the VS Code Explorer to add it to `.vscode/c_cpp_properties.json`. Works for both C and C++. Creates the file with defaults if it doesn't exist.

## Commands

| Context menu item | Behaviour |
|---|---|
| **Add to C/C++ Include Path** | Adds the selected folder only |
| **Recursively Add to C/C++ Include Path** | Walks all subdirectories and adds each one |

Skipped during recursive walk: `.git`, `.vscode`, `node_modules`, `.cache`, `out`, `build`, `dist`, and any hidden directory (`.`-prefixed). Duplicate paths are never added twice.

## Install

```bash
npm install
npm run compile
```

Press **F5** to launch a dev host and test, or package and install permanently:

```bash
npm install -g @vscode/vsce
vsce package
```

Install the resulting `.vsix` via **Extensions: Install from VSIX...** in the command palette.

## License

This is free and unencumbered software released into the public domain. See [LICENSE](LICENSE).
