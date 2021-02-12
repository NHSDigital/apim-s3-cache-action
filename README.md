# APIM S3 Cache Action

## Overview
The S3 cache action is an Azure Pipelines extension to be used with build pipelines in Azure DevOps to give us better control of our caching when deploying APIs.
This is currently at a proof of concept stage.

## Testing
To test the s3 functionality locally run the below commands. These will install dependancies then start localstack in a docker container using docker compose and run the tests in Jest.

```
make install
make test
```
