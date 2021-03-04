const tl = require('azure-pipelines-task-lib/task');
const uploadCache = require("./s3Utils/uploadCache");

const run = async () => {
    try {
        console.log('Simulate: Saving Cache');
        // TO DO - Use cache action in extention.
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();
