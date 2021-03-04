const tl = require('azure-pipelines-task-lib/task');

const uploadCache = async () => {
    try {
        const inputs = {
            key: tl.getInput('key', true),
            location: tl.getInput('location', true),
            bucket: tl.getInput('bucket', true)
        }
        console.log('Inside uploadCache')
        console.log('input key', inputs.key);
        console.log('input location', inputs.location);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

uploadCache();
