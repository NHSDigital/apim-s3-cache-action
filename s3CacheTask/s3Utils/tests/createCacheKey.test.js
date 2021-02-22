const { isPathyChar, isPathyPart, hashPartIfPath, createCacheKey } = require('../createCacheKey');

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
    // returns hash of string if path to dir
    // returns hash of file not string if path to file
    // What happens if can't find workingDir?
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
});

describe('createCacheKey', () => {
    // returns key hashed to sha256.
    // If input stays the same so should output
    // What happens if can't find workingDir?
    // What happens if invalid key type?
});
