const mockFs = require('mock-fs');
const { isPathyChar,
        isPathyPart,
        createHashFromString,
        hashFileOrString,
        } = require('../cacheKeyUtils');

describe('isPathyChar', () => {
    test('returns false for invalid file characters', () => {
        const invalidFileChars = ['"', '<', '>', '|'];
        invalidFileChars.forEach((c) => {
            expect(isPathyChar(c)).toBe(false);
        });
    });

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

describe('hashFileOrString', () => {
    test('returns hash of string if part isnt pathy', async () => {
        const part = '"foo"';
        const expectHash = 'b2213295d564916f89a6a42455567c87c3f480fcd7a1c15e220f17d7169a790b'
        expect(await hashFileOrString(part, __dirname)).toBe(expectHash);
    });

    test('returns hash of string if part is a path to directory', async () => {
        const part = 'foo/bar/foo';
        const expectHash = '745c4d40f6253884c4474d332600718d2428b11d6c362659244c7e4fa3a0e46a';
        expect(await hashFileOrString(part, __dirname)).toBe(expectHash);
    });

    test('returns hash of string if path to file but file not in workingDir', async () => {
        const part = 'foo/bar/foo.txt';
        const expectHash = '089740ac2d3e5350a4e6bf309405c8130ca137a6aac457d3dabe552539fd7080';
        expect(await hashFileOrString(part, __dirname)).toBe(expectHash);
    });

    test('returns hash of file when file exists in workingDir', async () => {
        mockFs({
            'foo/bar': {
                'foo.txt': 'bar'
            }
        });

        const part = 'foo/bar/foo.txt';
        const expectHash = 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9';

        expect(await hashFileOrString(part, __dirname)).toBe(expectHash);

        mockFs.restore();
    });
});

describe('createHashFromString', () => {
    test('returned result is a valid sha256 hash', async () => {
        const hashRegex = /^[A-Fa-f0-9]{64}$/g;
        const keyExample = '"foo" | bar.';
        const hashResult = createHashFromString(keyExample);

        expect(hashRegex.test(hashResult)).toBe(true);
    });
});
