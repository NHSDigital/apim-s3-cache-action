# APIM S3 Cache Action

## Azure Task Extension
The S3 cache action is an Azure Pipelines extension to be used with build pipelines in Azure DevOps to give us better control of our caching dependencies when deploying APIs. The task is not exclusive to dependencies and can cache a given file or folder.   

## How to use
The s3-cache-action task is designed to add an easy way to provide caching of dependencies. To demonstrate, let's examine the following build definition snippet:
```yaml
  - task: s3-cache-action@1
    inputs:
        key: 'node | s3CacheTask/package-lock.json'
        location: 's3CacheTask/node_modules'
    displayName: cache node modules

  - bash: npm install
    condition: ne(variables['CacheRestored'], 'true')
    displayName: Install node dependencies
```
The task will internally hash the key to create a path to give to S3 and check for a cache hit. On a first run of the build the action will report a cache miss (as they have never been cached), the install dependencies step will run and the task will run a post-build job to upload the dependencies to S3. On the second run of the build the task will report cache hit, as the key exists in S3. This will extract the dependencies, use them and skip the install and post build steps. 

*Note: Using a condition on the install step is optional, as the install will report that the dependencies are already installed. The conditional logic can be used to be more explicit in the pipeline*    

### Inputs
- `key` (required) : Key that will be hashed in S3. Pattern: Id (optional) | working directory | file pattern. Use file pattern to point to package-lock.json or poetry.lock to check changes to dependencies.
- `location` (required) : Path to file or folder to be cached.
- `bucket` (optional) : S3 bucket for cache task to use. By default uses environment to cache to NHSD pipeline bucket.
- `pipelineIsolated` (optional) : Adds pipeline id to S3 to make cache only valid for the pipeline using it. Set false by default.
- `debug` (optional) : Set true to turn on logging information for the task. Set false by default.
- `alias` (optional): This must be used if using the task more than once in a pipeline. This is appended to the 'CacheRestored' variable and should then be used in the condition for the install step. (Example below).

```yaml
  - task: s3-cache-action@1
    inputs:
        key: 'node | s3CacheTask/package-lock.json'
        location: 's3CacheTask/node_modules'
        pipelineIsolated: false
        debug: true
        alias: 'NodeModules'
    displayName: cache node modules

  - bash: npm install
    condition: ne(variables['CacheRestored-NodeModules'], 'true')
    displayName: Install node dependencies

  - task: s3-cache-action@1
    inputs:
        key: 'python venv | ./poetry.lock'
        location: '.venv'
        pipelineIsolated: false
        debug: true
        alias: 'Poetry'
    displayName: cache virtual env

  - bash: poetry install
    condition: ne(variables['CacheRestored-Poetry'], 'true')
    displayName: Install poetry dependencies
```

  
## Testing the task code
To test the s3 interactions locally run the below commands. These will install dependencies then start localstack in a docker container using docker compose and run the tests in Jest.

```bash
make install
make test
```

## Making changes to the apim-s3-cache-action repo
Any changes made in the 's3CacheTask' folder MUST be then re-exported and uploaded to the extension marketplace for the changes to be applied to the task.

### Re-exporting and Re-installing the task
- Increment the version number in the 'vss-extension.json' and 's3CacheTask/task.json' files.
- Run the following command in the command line to package the task
```bash
tfx extension create --manifest-globs vss-extension.json
```
- Sign in to the Azure extention marketplace and upload/update the extension. https://marketplace.visualstudio.com/
- Share the extension with organisation 'NHSD-APIM'.
- Ask the NHSD-APIM admin to install the exetension.
(Note: To ensure the task has updated resharing and reinstalling the task may be needed)   
    

## S3CacheAction Class

### Requirements
The S3 Cache Task uses the S3CacheAction class for interacting with S3.  

The class can be instantiated using an `options` object to set up the AWS client and bucket.  

```javascript
const options = {
    s3Client: new AWS.S3({
            credentials: {
                accessKeyId: 'test-id',
                secretAccessKey: 'test-secret',
            }
        }),
    bucket: 'example-bucket'
}
```

If you have your AWS credentials globally configured then s3Client option can be left blank and will use your credentials ambiently.  
  


### Methods
#### createCacheKey
The S3CacheAction caching interractions must be provided with a key string with a specific format.  

The `createCacheKey` method will then hash the key parts an join them separated by '/' characters, which creates a file tree within the provided S3 bucket.  

If the key part is a file it will hash the file, otherwise it will hash the string.  

```bash
// Identifier | Working Directory | File Pattern

// Examples

// Input
'"node modules" | $(System.DefaultWorkingDirectory) | package-lock.json'
// Output
a08e14f4ae7761bd5b85b22f235f9b2e6a489ed7b71904daf8069c225abf983c/45549dbb28f29efdb4b8aeb2b69088d8fa34693a2cc3597fe2389eecc8b17742/dba27c31aad935787bb275c3e5e4e957708f15386de599eff1db476022cd7e4c

// Input
'Test data | $(System.DefaultWorkingDirectory) | testData/test.json'
// Output
e27c8214be8b7cf5bccc7c08247e3cb0c1514a48ee1f63197fe4ef3ef51d7e6f/8a4f7378bf9f77ee01e78ff0dc31ff5669358a6fe0198be9a6f859999b9d50f2/8253544304dab00d2a070de771567c2bf6c5decc4120424324dfbc8169c4e63a
```
  

#### createCacheEntry
The `createCacheEntry` method uploads a file or directory as cache entry in S3. It requires a `targetPath` (path to file or directory you want to cache) and a `keyName`, which should the key hashed using the `createCacheKey` method.  
The method packs the file or directory into a tar and streams the tar to S3
  

#### maybeGetCacheEntry
The `maybeGetCacheEntry` method retrieves a cache entry from S3 using the hashed key it was uploaded with. It requires the hashed `keyName`, which should the key hashed using the `createCacheKey` method. It also requires a `destination`, which is the destination for the cache entry to be extracted to.  
  
The method calls the `findCacheEntry` method, which returns a stream of the desired cache entry and the pipes the stream to the destination directory. It will report a cache hit on a success.  

##### Cache miss
If there is no matching cache entry of the provided key the function does not error but reports a cache miss so that the task can decide to then upload the cache entry in this situation.

##### Fix Python env
In the situation returned cache entry is a 'python virtual environment' the `maybeFixPythonVenv` method will check for python files with a 'shebang path' and rewrite the path to specify the path the cache entry has been extracted to.  
  

  