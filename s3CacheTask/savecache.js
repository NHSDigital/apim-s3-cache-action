const tl = require('azure-pipelines-task-lib/task');
const uploadCache = require("./s3Utils/uploadCache");

const run = async () => {
    try {
        console.log('Simulate: Saving Cache');
        // tl - get path and credentials, bucketName, keyName from pipeline input
        // const resp = await uploadCacheFile(targetPath, credentials, bucketName, keyName);
        // tl.setResult(tl.TaskResult.Succeeded, `{resp["Key"] successfully uploaded to {resp["Bucket"]}}`);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();
