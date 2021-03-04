const tl = require('azure-pipelines-task-lib/task');

const restoreCache = async () => {
    try {
        const inputs = {
            key: tl.getInput('key', true),
            location: tl.getInput('location', true),
            bucket: tl.getInput('bucket', true)
        }
        console.log('Inside restoreCache')
        console.log('input key', inputs.key);
        console.log('input location', inputs.location);
        console.log('input bucket', inputs.bucket);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

restoreCache();
