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

// ─── Extension entry point ────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
    const cmd = vscode.commands.registerCommand(
        'cppInclude.addToIncludePath',
        async (uri: vscode.Uri | undefined) => {
            // uri is undefined if triggered from the command palette (no folder selected)
            if (!uri) {
                vscode.window.showWarningMessage(
                    'Right-click a folder in the Explorer to use this command.'
                );
                return;
            }

            const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Selected folder is outside the current workspace.');
                return;
            }

            const workspaceRoot = workspaceFolder.uri.fsPath;
            const includePath = buildIncludePath(workspaceRoot, uri.fsPath);

            const vscodeDir = path.join(workspaceRoot, '.vscode');
            const propertiesPath = path.join(vscodeDir, 'c_cpp_properties.json');

            // Read existing file or use defaults
            let properties: CppProperties;
            if (fs.existsSync(propertiesPath)) {
                try {
                    const raw = fs.readFileSync(propertiesPath, 'utf8');
                    properties = JSON.parse(raw) as CppProperties;
                } catch (e) {
                    vscode.window.showErrorMessage(
                        `Failed to parse c_cpp_properties.json: ${String(e)}`
                    );
                    return;
                }
            } else {
                properties = defaultProperties();
                if (!fs.existsSync(vscodeDir)) {
                    fs.mkdirSync(vscodeDir, { recursive: true });
                }
            }

            const { properties: updated, status } = applyIncludePath(properties, includePath);

            if (status === 'already_present') {
                vscode.window.showInformationMessage(
                    `Already in include path: ${includePath}`
                );
                return;
            }

            // Write back with 4-space indent to match what VS Code itself produces
            try {
                fs.writeFileSync(propertiesPath, JSON.stringify(updated, null, 4) + '\n', 'utf8');
                vscode.window.showInformationMessage(`Added to include path: ${includePath}`);
            } catch (e) {
                vscode.window.showErrorMessage(
                    `Failed to write c_cpp_properties.json: ${String(e)}`
                );
            }
        }
    );

    context.subscriptions.push(cmd);
}

export function deactivate(): void {}
