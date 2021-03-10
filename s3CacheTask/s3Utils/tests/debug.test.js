const { debug } = require('../debug');

describe('debug', () => {
    beforeEach(() => {
        global.console = {
            log: jest.fn()
        };
        delete process.env.SHOULD_DEBUG
    });

    afterEach(() => {
        delete process.env.SHOULD_DEBUG
    });

    test('prints input when SHOULD_DEBUG bool set true', () => {
        const input = 'foo';
        process.env.SHOULD_DEBUG = true;

        debug(input);

        expect(global.console.log).toHaveBeenCalledWith(
            'foo'
        );
    });

    test('does not print input when SHOULD_DEBUG bool not set', () => {
        const input = 'foo';

        debug(input);

        expect(global.console.log).not.toHaveBeenCalledWith(
            'foo'
        );
    });
});