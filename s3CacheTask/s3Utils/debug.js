const tl = require('azure-pipelines-task-lib/task');

const debug = (stringToPrint) => {
    console.log(tl.getInput('debug', false))
    const shouldDebug = tl.getInput('debug', false) || process.env.SHOULD_DEBUG === 'true'
    console.log(shouldDebug)
    if (shouldDebug) console.log(stringToPrint);
    return;
};

module.exports = { debug };