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
        expect("\\".length).toBe(1);

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
        expect(isPathyPart("foo.")).toBe(false);
    });
});
