# C++ Add Include Path

Right-click any folder in the VS Code Explorer and select **"Add to C/C++ Include Path"** to append it to `.vscode/c_cpp_properties.json`. Works for both C and C++. Creates the file with defaults if it doesn't exist.

## Install

```bash
npm install
npm run compile
```

Then press **F5** to launch a dev host, or package and install permanently:

```bash
npm install -g @vscode/vsce
vsce package
```

This produces a `.vsix` file. Install it via **Extensions: Install from VSIX...** in the command palette.
