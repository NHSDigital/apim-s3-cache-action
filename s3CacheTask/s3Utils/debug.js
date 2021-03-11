const tl = require('azure-pipelines-task-lib/task');

const debug = (stringToPrint) => {
    const shouldDebug = tl.getInput('debug', true) === 'true' || process.env.SHOULD_DEBUG === 'true'

    if (shouldDebug) console.log(stringToPrint);
    return;
};

module.exports = { debug };