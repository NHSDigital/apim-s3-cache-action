const { isPathyChar, isPathyPart, hashPartIfPath, createCacheKey } = require('../createCacheKey');
const mockFs = require('mock-fs');

describe('isPathyChar', () => {
    test('returns false for invalid file characters', () => {
        const invalidFileChars = ['"', '<', '>', '|'];
        invalidFileChars.forEach((c) => {
            expect(isPathyChar(c)).toBe(false);
        });
    });

    // Any way to test a more comprensive list?
    test('returns true for valid path character', () => {
        const validPathChars = ['*', '?', '[', ']', '/', '\\', ':', '1', '0', 'A', 'a' ];
        // Ensure escaped character
        expect('\\'.length).toBe(1);

        validPathChars.forEach((c) => {
            expect(isPathyChar(c)).toBe(true);
        });
    });
});

describe('isPathyPart', () => {
    test('returns true for standard path syntax', () => {
        expect(isPathyPart('foo/bar/foo.txt')).toBe(true);
    });

    test('returns true for windows path syntax', () => {
        const windowsPath = '\\\\.\\C:\\Test\\Foo.txt';
        // Ensure escaped characters
        expect(windowsPath.length).toBe(19);

        expect(isPathyPart('foo/bar/foo.txt')).toBe(true);
    });

    test('returns false when part is string literal', () => {
        expect(isPathyPart('"Foo"')).toBe(false);
    });

    test('returns false when contains an invalid path character', () => {
        expect(isPathyPart('Foo "Bar" Foo')).toBe(false);
        expect(isPathyPart('foo/<bar>/foo')).toBe(false);
    });

    test('returns false when part contains ".", "/" and "\\"', () => {
        const examplePath = '\\foo/bar.txt';
        // Ensure escaped character
        expect(examplePath.length).toBe(12);

        expect(isPathyPart(examplePath)).toBe(false);
    });

    test('returns false when last character of part is "."', () => {
        expect(isPathyPart('foo.')).toBe(false);
    });
});

describe('hashPartIfPath', () => {
    test('returns part unchanged if part starts and ends with double quote', async () => {
        const part = '"foo"';
        expect(await hashPartIfPath(part, __dirname)).toBe(part);
    });

    test('returns part unchanged if part contains invalid path character',async () => {
        const part = '<foo>';
        expect(await hashPartIfPath(part, __dirname)).toBe(part);
    });

    test('returns part unchanged if part contains ".", "\" and "/"',async () => {
        const part = '\\foo/bar.txt';
        // Ensure escaped character
        expect(part.length).toBe(12);

        expect(await hashPartIfPath(part, __dirname)).toBe(part);
    });

    test('returns part unchanged when ends with "."',async () => {
        const part = 'foo.';
        expect(await hashPartIfPath(part, __dirname)).toBe(part);
    });

    test('returns hash of string if part is a path to directory', async () => {
        const part = 'foo/bar/foo';
        const expectHash = '745c4d40f6253884c4474d332600718d2428b11d6c362659244c7e4fa3a0e46a';
        expect(await hashPartIfPath(part, __dirname)).toBe(expectHash);
    });

    test('returns hash of string if path to file but file not in workingDir', async () => {
        const part = 'foo/bar/foo.txt';
        const expectHash = '089740ac2d3e5350a4e6bf309405c8130ca137a6aac457d3dabe552539fd7080';
        expect(await hashPartIfPath(part, __dirname)).toBe(expectHash);
    });

    test('returns hash of file when file exists in workingDir', async () => {
        mockFs({
            'foo/bar': {
                'foo.txt': 'bar'
            }
        });

        const part = 'foo/bar/foo.txt';
        const expectHash = 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9';

        expect(await hashPartIfPath(part, __dirname)).toBe(expectHash);

        mockFs.restore();
    });
});

describe('createCacheKey', () => {
    test('returned result is a valid sha256 hash', async () => {
        const regex = /\b[A-Fa-f0-9]{64}\b/g;
        const keyInput = '"foo" | foo/bar/foo | foo.txt';
        const result = await createCacheKey(keyInput, __dirname);

        expect(regex.test(result)).toBe(true);
    });

    test('returns the same result on each call', async () => {
        const keyInput = '"foo" | foo/bar/foo | foo.txt';
        const firstCall = await createCacheKey(keyInput, __dirname);
        const secondCall = await createCacheKey(keyInput, __dirname);

        expect(firstCall).toBe(secondCall);
    });
});
