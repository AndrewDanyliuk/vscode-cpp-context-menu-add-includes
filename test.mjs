// test.mjs — node test.mjs
import * as path from 'path';
import * as fs from 'fs';
import assert from 'assert';
import { buildIncludePath, applyIncludePath, applyIncludePathBatch, collectSubdirectories, defaultProperties } from './out/extension.js';

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✓ ${name}`); passed++; }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

// ─── buildIncludePath ─────────────────────────────────────────────────────────
console.log('\nbuildIncludePath');
test('nested path', () => assert.strictEqual(buildIncludePath('/ws', '/ws/src/include'), '${workspaceFolder}/src/include'));
test('root-level folder', () => assert.strictEqual(buildIncludePath('/ws', '/ws/drivers'), '${workspaceFolder}/drivers'));
test('no backslashes in output', () => assert.ok(!buildIncludePath('C:\\ws', 'C:\\ws\\src\\hal').includes('\\')));

// ─── applyIncludePath ─────────────────────────────────────────────────────────
console.log('\napplyIncludePath');
test('adds to single config', () => {
    const p = defaultProperties();
    const { status } = applyIncludePath(p, '${workspaceFolder}/src');
    assert.strictEqual(status, 'added');
    assert.ok(p.configurations[0].includePath.includes('${workspaceFolder}/src'));
});
test('deduplicates', () => {
    const p = defaultProperties();
    applyIncludePath(p, '${workspaceFolder}/src');
    const { status } = applyIncludePath(p, '${workspaceFolder}/src');
    assert.strictEqual(status, 'already_present');
});
test('adds to all configs', () => {
    const p = { configurations: [{ name: 'Debug', includePath: [] }, { name: 'Release', includePath: [] }], version: 4 };
    applyIncludePath(p, '${workspaceFolder}/inc');
    assert.ok(p.configurations[0].includePath.includes('${workspaceFolder}/inc'));
    assert.ok(p.configurations[1].includePath.includes('${workspaceFolder}/inc'));
});
test('handles missing includePath array', () => {
    const p = { configurations: [{ name: 'Default' }], version: 4 };
    applyIncludePath(p, '${workspaceFolder}/inc');
    assert.deepStrictEqual(p.configurations[0].includePath, ['${workspaceFolder}/inc']);
});

// ─── applyIncludePathBatch ────────────────────────────────────────────────────
console.log('\napplyIncludePathBatch');
test('adds multiple paths, returns correct count', () => {
    const p = defaultProperties();
    const paths = ['${workspaceFolder}/a', '${workspaceFolder}/b', '${workspaceFolder}/c'];
    const { addedCount } = applyIncludePathBatch(p, paths);
    assert.strictEqual(addedCount, 3);
    for (const ip of paths) assert.ok(p.configurations[0].includePath.includes(ip));
});
test('skips duplicates in batch, counts only new', () => {
    const p = defaultProperties();
    applyIncludePath(p, '${workspaceFolder}/a');
    const { addedCount } = applyIncludePathBatch(p, ['${workspaceFolder}/a', '${workspaceFolder}/b']);
    assert.strictEqual(addedCount, 1);
});
test('all duplicates returns addedCount 0', () => {
    const p = defaultProperties();
    applyIncludePath(p, '${workspaceFolder}/a');
    const { addedCount } = applyIncludePathBatch(p, ['${workspaceFolder}/a']);
    assert.strictEqual(addedCount, 0);
});

// ─── collectSubdirectories ────────────────────────────────────────────────────
console.log('\ncollectSubdirectories');

const tmp = fs.mkdtempSync(path.join(import.meta.dirname ?? '.', 'tmp-test-'));
fs.mkdirSync(path.join(tmp, 'src'));
fs.mkdirSync(path.join(tmp, 'src', 'hal'));
fs.mkdirSync(path.join(tmp, 'src', 'hal', 'deep'));
fs.mkdirSync(path.join(tmp, 'include'));
fs.mkdirSync(path.join(tmp, '.git'));
fs.mkdirSync(path.join(tmp, 'node_modules'));
fs.writeFileSync(path.join(tmp, 'src', 'main.c'), '');

test('includes root and all non-skipped subdirs', () => {
    const result = collectSubdirectories(tmp);
    const normalized = result.map(p => p.replace(tmp, '').replace(/\\/g, '/'));
    assert.ok(normalized.includes(''), 'root');
    assert.ok(normalized.includes('/src'), 'src');
    assert.ok(normalized.includes('/src/hal'), 'src/hal');
    assert.ok(normalized.includes('/src/hal/deep'), 'src/hal/deep');
    assert.ok(normalized.includes('/include'), 'include');
});
test('skips .git', () => assert.ok(!collectSubdirectories(tmp).some(p => p.includes('.git'))));
test('skips node_modules', () => assert.ok(!collectSubdirectories(tmp).some(p => p.includes('node_modules'))));
test('does not include files', () => assert.ok(!collectSubdirectories(tmp).some(p => p.endsWith('main.c'))));
test('returns correct total count', () => assert.strictEqual(collectSubdirectories(tmp).length, 5));

fs.rmSync(tmp, { recursive: true, force: true });

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
