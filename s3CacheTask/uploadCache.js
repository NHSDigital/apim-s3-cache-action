const tl = require('azure-pipelines-task-lib/task');
const { uploadCache } = require('./s3Utils/taskUtils');

const run = async () => {
    try {
        const inputs = {
            key: tl.getInput('key', true),
            location: tl.getInput('location', true),
            bucket: tl.getInput('bucket', true)
        };
        console.log('running uploadCache');
        await uploadCache(inputs, null);
    }
    catch (err) {
        console.log(err.stack)
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
};

run();
