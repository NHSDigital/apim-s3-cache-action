const tl = require('azure-pipelines-task-lib/task');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

async function run() {
    try {
        const inputString = tl.getInput('samplestring', true);
        if (inputString == 'bad') {
            tl.setResult(tl.TaskResult.Failed, 'Bad input was given');
            return;
        }
        console.log('Simulate: Caching ', inputString);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();