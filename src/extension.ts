import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CppConfiguration {
    name: string;
    includePath: string[];
    defines?: string[];
    compilerPath?: string;
    cStandard?: string;
    cppStandard?: string;
    intelliSenseMode?: string;
}

interface CppProperties {
    configurations: CppConfiguration[];
    version: number;
}

// ─── Core logic (exported for testing) ───────────────────────────────────────

export function buildIncludePath(workspaceRoot: string, folderFsPath: string): string {
    const rel = path.relative(workspaceRoot, folderFsPath).replace(/\\/g, '/');
    return `\${workspaceFolder}/${rel}`;
}

/** Directories to skip during recursive walk. */
const SKIP_DIRS = new Set(['.git', '.vscode', 'node_modules', '.cache', 'out', 'build', 'dist']);

/**
 * Recursively collect all subdirectories under rootPath (inclusive of rootPath itself).
 * Skips hidden directories and common non-source dirs.
 */
export function collectSubdirectories(rootPath: string): string[] {
    const results: string[] = [];

    function walk(dir: string): void {
        results.push(dir);
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!entry.isDirectory()) { continue; }
            if (entry.name.startsWith('.')) { continue; }
            if (SKIP_DIRS.has(entry.name)) { continue; }
            walk(path.join(dir, entry.name));
        }
    }

    walk(rootPath);
    return results;
}

export function applyIncludePath(properties: CppProperties, includePath: string): {
    properties: CppProperties;
    status: 'added' | 'already_present';
} {
    let anyAdded = false;

    for (const config of properties.configurations) {
        if (!Array.isArray(config.includePath)) {
            config.includePath = [];
        }
        if (!config.includePath.includes(includePath)) {
            config.includePath.push(includePath);
            anyAdded = true;
        }
    }

    return {
        properties,
        status: anyAdded ? 'added' : 'already_present',
    };
}

export function applyIncludePathBatch(properties: CppProperties, includePaths: string[]): {
    properties: CppProperties;
    addedCount: number;
} {
    let addedCount = 0;
    for (const p of includePaths) {
        const { status } = applyIncludePath(properties, p);
        if (status === 'added') { addedCount++; }
    }
    return { properties, addedCount };
}

export function defaultProperties(): CppProperties {
    return {
        configurations: [
            {
                name: 'Default',
                includePath: ['${workspaceFolder}/**'],
                defines: [],
                cStandard: 'c17',
                cppStandard: 'c++17',
                intelliSenseMode: 'gcc-arm',
            },
        ],
        version: 4,
    };
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function loadOrCreateProperties(propertiesPath: string, vscodeDir: string): CppProperties | null {
    if (fs.existsSync(propertiesPath)) {
        try {
            const raw = fs.readFileSync(propertiesPath, 'utf8');
            return JSON.parse(raw) as CppProperties;
        } catch (e) {
            vscode.window.showErrorMessage(
                `Failed to parse c_cpp_properties.json: ${String(e)}`
            );
            return null;
        }
    } else {
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }
        return defaultProperties();
    }
}

function writeProperties(propertiesPath: string, properties: CppProperties): boolean {
    try {
        fs.writeFileSync(propertiesPath, JSON.stringify(properties, null, 4) + '\n', 'utf8');
        return true;
    } catch (e) {
        vscode.window.showErrorMessage(
            `Failed to write c_cpp_properties.json: ${String(e)}`
        );
        return false;
    }
}

function resolveWorkspace(uri: vscode.Uri): { workspaceRoot: string; vscodeDir: string; propertiesPath: string } | null {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('Selected folder is outside the current workspace.');
        return null;
    }
    const workspaceRoot = workspaceFolder.uri.fsPath;
    const vscodeDir = path.join(workspaceRoot, '.vscode');
    const propertiesPath = path.join(vscodeDir, 'c_cpp_properties.json');
    return { workspaceRoot, vscodeDir, propertiesPath };
}

// ─── Extension entry point ────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {

    // ── Single folder ─────────────────────────────────────────────────────────
    const cmdSingle = vscode.commands.registerCommand(
        'cppInclude.addToIncludePath',
        async (uri: vscode.Uri | undefined) => {
            if (!uri) {
                vscode.window.showWarningMessage(
                    'Right-click a folder in the Explorer to use this command.'
                );
                return;
            }

            const resolved = resolveWorkspace(uri);
            if (!resolved) { return; }
            const { workspaceRoot, vscodeDir, propertiesPath } = resolved;

            const properties = loadOrCreateProperties(propertiesPath, vscodeDir);
            if (!properties) { return; }

            const includePath = buildIncludePath(workspaceRoot, uri.fsPath);
            const { properties: updated, status } = applyIncludePath(properties, includePath);

            if (status === 'already_present') {
                vscode.window.showInformationMessage(`Already in include path: ${includePath}`);
                return;
            }

            if (writeProperties(propertiesPath, updated)) {
                vscode.window.showInformationMessage(`Added to include path: ${includePath}`);
            }
        }
    );

    // ── Recursive ─────────────────────────────────────────────────────────────
    const cmdRecursive = vscode.commands.registerCommand(
        'cppInclude.addToIncludePathRecursive',
        async (uri: vscode.Uri | undefined) => {
            if (!uri) {
                vscode.window.showWarningMessage(
                    'Right-click a folder in the Explorer to use this command.'
                );
                return;
            }

            const resolved = resolveWorkspace(uri);
            if (!resolved) { return; }
            const { workspaceRoot, vscodeDir, propertiesPath } = resolved;

            const properties = loadOrCreateProperties(propertiesPath, vscodeDir);
            if (!properties) { return; }

            const subdirs = collectSubdirectories(uri.fsPath);
            const includePaths = subdirs.map(d => buildIncludePath(workspaceRoot, d));

            const { properties: updated, addedCount } = applyIncludePathBatch(properties, includePaths);

            if (addedCount === 0) {
                vscode.window.showInformationMessage('All paths already present in include path.');
                return;
            }

            if (writeProperties(propertiesPath, updated)) {
                vscode.window.showInformationMessage(
                    `Recursively added ${addedCount} path${addedCount !== 1 ? 's' : ''} to include path.`
                );
            }
        }
    );

    context.subscriptions.push(cmdSingle, cmdRecursive);
}

export function deactivate(): void {}
