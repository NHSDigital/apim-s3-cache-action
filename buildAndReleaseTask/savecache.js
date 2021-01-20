const tl = require('azure-pipelines-task-lib/task');
const axios = require('axios');

async function run() {
    try {
        const inputString = tl.getInput('samplestring', true);
        if (inputString == 'bad') {
            tl.setResult(tl.TaskResult.Failed, 'Bad input was given');
            return;
        }
        console.log('Simulating: Saving -', inputString);
        await axios.get('https://internal-dev.api.service.nhs.uk/canary-api/_ping');
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();