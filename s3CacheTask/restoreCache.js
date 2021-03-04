const tl = require('azure-pipelines-task-lib/task');
const { restoreCache } = require('./s3Utils/taskUtils');

const run = async () => {
    try {
        const inputs = {
            key: tl.getInput('key', true),
            location: tl.getInput('location', true),
            bucket: tl.getInput('bucket', true)
        };
        await restoreCache(inputs, null);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
};

run();
