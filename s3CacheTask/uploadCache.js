const tl = require('azure-pipelines-task-lib/task');
const { debug } = require('./s3Utils/debug');
const { uploadCache} = require('./s3Utils/taskUtils');

const run = async () => {
    try {
        const bucket = tl.getInput('bucket', false) || tl.getVariable('PIPELINE_CACHE_BUCKET') || '';
        if (bucket === '') {
            tl.setResult(tl.TaskResult.Failed, `bucket input or $PIPELINE_CACHE_BUCKET required`);
            return;
        };

        process.env.SHOULD_DEBUG = tl.getInput('debug', true);

        const inputs = {
            location: tl.getInput('location', true),
            bucket: bucket,
            alias: tl.getInput('alias', false)
        };

        debug('Running: uploadCache');

        await uploadCache(inputs, null);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, `Error message: ${err.message}. Error stack: ${err.stack}. Error: ${err}`);
    }
};

run();
