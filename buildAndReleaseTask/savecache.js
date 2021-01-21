const tl = require('azure-pipelines-task-lib/task');

async function run() {
    try {
        console.log('Simulate: Saving Cache');
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();