// test.mjs — runs with: node test.mjs
// Tests the pure functions exported from extension.ts via compiled JS.
// No VS Code runtime required.

import * as path from 'path';
import assert from 'assert';
import { buildIncludePath, applyIncludePath, defaultProperties } from './out/extension.js';

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e) {
        console.error(`  ✗ ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

// ─── buildIncludePath ─────────────────────────────────────────────────────────

console.log('\nbuildIncludePath');

test('posix path produces ${workspaceFolder}/rel', () => {
    const result = buildIncludePath('/workspace', '/workspace/src/include');
    assert.strictEqual(result, '${workspaceFolder}/src/include');
});

test('root-level folder produces ${workspaceFolder}/foldername', () => {
    const result = buildIncludePath('/workspace', '/workspace/drivers');
    assert.strictEqual(result, '${workspaceFolder}/drivers');
});

test('windows backslashes are normalised to forward slashes', () => {
    // Simulate windows-style relative path output from path.relative
    const result = buildIncludePath('C:\\workspace', 'C:\\workspace\\src\\hal');
    // path.relative on linux won't produce backslashes, but test the replace guard
    assert.ok(!result.includes('\\'), `Should not contain backslashes, got: ${result}`);
});

// ─── applyIncludePath ─────────────────────────────────────────────────────────

console.log('\napplyIncludePath');

test('adds path to a single config', () => {
    const props = defaultProperties();
    const { properties, status } = applyIncludePath(props, '${workspaceFolder}/src');
    assert.strictEqual(status, 'added');
    assert.ok(properties.configurations[0].includePath.includes('${workspaceFolder}/src'));
});

test('returns already_present when path already exists', () => {
    const props = defaultProperties();
    applyIncludePath(props, '${workspaceFolder}/src');
    const { status } = applyIncludePath(props, '${workspaceFolder}/src');
    assert.strictEqual(status, 'already_present');
});

test('adds to all configurations', () => {
    const props = {
        configurations: [
            { name: 'Debug',   includePath: [] },
            { name: 'Release', includePath: [] },
        ],
        version: 4,
    };
    const { properties, status } = applyIncludePath(props, '${workspaceFolder}/inc');
    assert.strictEqual(status, 'added');
    assert.ok(properties.configurations[0].includePath.includes('${workspaceFolder}/inc'));
    assert.ok(properties.configurations[1].includePath.includes('${workspaceFolder}/inc'));
});

test('handles missing includePath array gracefully', () => {
    const props = {
        configurations: [{ name: 'Default' }],  // no includePath field
        version: 4,
    };
    const { properties, status } = applyIncludePath(props, '${workspaceFolder}/inc');
    assert.strictEqual(status, 'added');
    assert.deepStrictEqual(properties.configurations[0].includePath, ['${workspaceFolder}/inc']);
});

test('partially-present path: adds to configs that are missing it, reports added', () => {
    // Config A already has it, Config B does not — overall status should be 'added'
    const props = {
        configurations: [
            { name: 'A', includePath: ['${workspaceFolder}/inc'] },
            { name: 'B', includePath: [] },
        ],
        version: 4,
    };
    const { properties, status } = applyIncludePath(props, '${workspaceFolder}/inc');
    assert.strictEqual(status, 'added');
    assert.ok(properties.configurations[1].includePath.includes('${workspaceFolder}/inc'));
});

// ─── defaultProperties ────────────────────────────────────────────────────────

console.log('\ndefaultProperties');

test('produces valid structure', () => {
    const props = defaultProperties();
    assert.ok(Array.isArray(props.configurations));
    assert.strictEqual(props.version, 4);
    assert.ok(Array.isArray(props.configurations[0].includePath));
});

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
