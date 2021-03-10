const tl = require('azure-pipelines-task-lib/task');
const { restoreCache, debug } = require('./s3Utils/taskUtils');

const run = async () => {
    try {
        const bucket = tl.getInput('bucket', false) || tl.getVariable('PIPELINE_CACHE_BUCKET') || '';
        if (bucket === '') {
            tl.setResult(tl.TaskResult.Failed, `bucket input or $PIPELINE_CACHE_BUCKET required`);
            return
        }
        
        const inputs = {
            key: tl.getInput('key', true),
            location: tl.getInput('location', true),
            bucket: bucket,
            pipelineIsolated: tl.getInput('pipelineIsolated', false)
        };
        
        debug('Running: restoreCache');
        
        await restoreCache(inputs, null);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, `Error message: ${err.message}. Error stack: ${err.stack}. Error: ${err}`);
    }
};

run();
