const tl = require('azure-pipelines-task-lib/task');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function run() {
    try {
        console.log('Simulate: Saving Cache');
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();