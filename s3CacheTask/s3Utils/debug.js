const tl = require('azure-pipelines-task-lib/task');

const debug = (stringToPrint) => {
    if (tl.getInput('debug', false) || process.env.SHOULD_DEBUG === 'true') console.log(stringToPrint);
};

module.exports = { debug };