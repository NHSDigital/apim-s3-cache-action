# APIM S3 Cache Action

## Overview
The S3 cache action is an Azure Pipelines extension to be used with build pipelines in Azure DevOps to give us better control of our caching when deploying APIs.  

This is currently at a proof of concept stage.  

  
## Testing
To test the s3 interactions locally run the below commands. These will install dependancies then start localstack in a docker container using docker compose and run the tests in Jest.

```
make install
make test
```
  

## S3CacheAction Class

### Requirements
The S3 Cache Task uses the S3CacheAction class for interacting with S3.  

The class can be instantiated using an `options` object to set up the AWS client and bucket.  

```
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

The `createCacheKey` method will then hash the key parts an join them seperated by '/' characters, which creates a file tree within the provided S3 bucket.  

If the key part is a file it will hash the file, otherwise it will hash the string.  

```
// Identifier | Target Path | File Pattern

// Examples

// Input
'"node modules" | { path_to_node_modules } | node_modules'
// Output
a08e14f4ae7761bd5b85b22f235f9b2e6a489ed7b71904daf8069c225abf983c/45549dbb28f29efdb4b8aeb2b69088d8fa34693a2cc3597fe2389eecc8b17742/dba27c31aad935787bb275c3e5e4e957708f15386de599eff1db476022cd7e4c

// Input
'Test data | { path_to_test_data_file } | testData/test.json'
// Output
e27c8214be8b7cf5bccc7c08247e3cb0c1514a48ee1f63197fe4ef3ef51d7e6f/8a4f7378bf9f77ee01e78ff0dc31ff5669358a6fe0198be9a6f859999b9d50f2/8253544304dab00d2a070de771567c2bf6c5decc4120424324dfbc8169c4e63a
```
  

#### createCacheEntry
The `createCacheEntry` method uploads a file or directory as cache entry in S3. It requires a `targetPath` (path to file or directory you want to cache) and a `keyName`, which should the key hashed using the createCacheKey method.  
The method packs the file or directory into a tar and streams the tar to S3
  

#### maybeGetCacheEntry
The `maybeGetCacheEntry` method retrieves a cache entry from S3 using the hashed key it was uploaded with. It requires the hashed `keyName`, which should the key hashed using the createCacheKey method. It also requires a `destination`, which is the destination for the cache entry to be extracted to.  
  
The method calls the `findCacheEntry` method, which returns a stream of the desired cache entry and the pipes the stream to the destination directory. It will report a cache hit on a success.  

##### Cache miss
If there is no matching cache entry of the provided key the function does not error but reports a cache miss so that the task can decide to then upload the cache entry in this situation.

##### Fix Python env
In the situation returned cache entry is a 'python virtual environment' the `maybeFixPythonVenv` method will check for python files with a 'shebang path' and rewrite the path to specify the path the cache entry has been extracted to.  
  

  