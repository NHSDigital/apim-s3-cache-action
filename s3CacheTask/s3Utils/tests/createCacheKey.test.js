const { hasUncaughtExceptionCaptureCallback } = require("process");

const { isPathyChar, hashPartIfPath, createCacheKey } = require('../createCacheKey');

describe('isPathyChar', () => {
    test('returns false for invalid file characters', () => {
        const invalidFileChars = ['"', '<', '>', '|'];
        invalidFileChars.forEach((c) => {
            expect(isPathyChar(c)).toBe(false);
        });
    });

    // Any way to test a more comprensive list?
    test('returns true for valid path character', () => {
        const validPathChars = ['*', '?', '[', ']', '/', ':', '1', '0', 'A', 'a' ];
        validPathChars.forEach((c) => {
            expect(isPathyChar(c)).toBe(true);
        });
    });
});
