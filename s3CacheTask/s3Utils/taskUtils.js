
const tl = require('azure-pipelines-task-lib/task');
const path = require('path');
const S3CacheAction = require('./s3CacheAction');
const { debug } = require('./debug');

/**
 * Append the pipeline definition ID to a hashed key for isolation.
 */
const addPipelineIdToKey = (key) => {
  const pipelineId = tl.getVariable('System.DefinitionId');
  if (!pipelineId) throw new Error('Pipeline ID undefined, check var: $(System.DefinitionId)');
  debug(`Isolated caching for pipeline: ${pipelineId}`);
  return pipelineId + '/' + key;
};

/**
 * Convert process.hrtime() tuple to a string in seconds.
 */
const parseHrtimeToSeconds = (hrtime) => {
  const seconds = (hrtime[0] + (hrtime[1] / 1e9)).toFixed(3);
  return seconds;
};

/**
 * Restore cache (download and extract) into the target location.
 */
const restoreCache = async (pipelineInput, s3Client) => {
  const { key, location, bucket, pipelineIsolated, alias, cacheHitVar, workingDirectory } = pipelineInput;

  const cacheAction = new S3CacheAction({ s3Client: s3Client, bucket: bucket });

  // Resolve working directory
  let workingDir = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
  if (workingDirectory && workingDirectory.length > 0) {
    workingDir = path.resolve(workingDir, workingDirectory);
  }
  const targetPath = path.resolve(workingDir, location);
  debug(`Extracting to: ${targetPath}`);

  // Create and set S3 cache key
  const hashedKey = await cacheAction.createCacheKey(key, workingDir);
  const formattedKey =
    pipelineIsolated === 'true'
      ? 'pipeline/' + addPipelineIdToKey(hashedKey)
      : 'global/' + hashedKey;

  debug(`Using S3 cache key: ${formattedKey}`);
  debug(`Evaluating S3 cache for path: s3://${bucket}/${formattedKey}`);

  // Look up cache entry in S3 bucket
  const startTime = process.hrtime();
  const cacheReport = await cacheAction.maybeGetCacheEntry(formattedKey, targetPath);
  const elapsedSeconds = parseHrtimeToSeconds(process.hrtime(startTime));
  debug(`Cache report from S3: ${cacheReport.message}`);

  // Report Cache in task
  let cacheRestoredValue = cacheReport.message === 'cache miss' ? 'false' : 'true';
  if (cacheRestoredValue === 'true') {
    debug(`Downloaded ${cacheReport.tarSize} bytes and extracted ${cacheReport.extractedSize} bytes in ${elapsedSeconds} seconds.`);
  }

  // task variables
  tl.setTaskVariable('cacheRestored', cacheRestoredValue);
  tl.setVariable(`cacheRestored`, cacheRestoredValue, undefined, true);

  // compatibility name for pipeline var
  const cacheRestoredName =
    (cacheHitVar && cacheHitVar.length > 0)
      ? cacheHitVar
      : (alias && alias.length > 0 ? `CacheRestored-${alias}` : `CacheRestored`);

  tl.setVariable(cacheRestoredName, cacheRestoredValue);
  debug(`Cache restored: ${cacheRestoredValue}`);

  return;
};

/**
 * Upload cache (tar and put to S3) from the target location.
 * When the hashed key cannot be constructed (e.g., pipelineInput.key is null),
 * we propagate an undefined Key to createCacheEntry to trigger the expected error:
 * "Missing required key 'Key' in params".
 */
const uploadCache = async (pipelineInput, s3Client) => {
  const { key, location, bucket, pipelineIsolated, alias, cacheHitVar, workingDirectory } = pipelineInput;

  const cacheRestored = tl.getTaskVariable('cacheRestored');

  // Determine cache upload
  if (cacheRestored === 'false') {
    const cacheAction = new S3CacheAction({ s3Client: s3Client, bucket: bucket });

    // Resolve working directory
    let workingDir = tl.getVariable('System.DefaultWorkingDirectory') || process.cwd();
    if (workingDirectory && workingDirectory.length > 0) {
      workingDir = path.resolve(workingDir, workingDirectory);
    }
    const targetPath = path.resolve(workingDir, location);
    debug(`Target path: ${targetPath}`);

    // Build hashed key; may be null if key input is null
    const hashedKey = await cacheAction.createCacheKey(key, workingDir);

    // NEW: propagate missing key by passing undefined to createCacheEntry
    let formattedKey;
    if (hashedKey) {
      formattedKey =
        pipelineIsolated === 'true'
          ? 'pipeline/' + addPipelineIdToKey(hashedKey)
          : 'global/' + hashedKey;
      debug(`Using S3 cache key: ${formattedKey}`);
      debug(`Evaluating S3 cache for path: s3://${bucket}/${formattedKey}`);
    } else {
      formattedKey = undefined; // this will trigger "Missing required key 'Key' in params"
      debug('No cache key provided (key is null/empty). Propagating as missing Key to S3.');
    }

    // Will throw if Bucket or Key is missing (as the tests expect)
    await cacheAction.createCacheEntry(targetPath, formattedKey);

    tl.setResult(
      tl.TaskResult.Succeeded,
      'Uploaded to cache.'
    );
    debug('Uploaded to cache.');
    return;
  } else if (!cacheRestored) {
    tl.setResult(
      tl.TaskResult.Skipped,
      'No cache reported. Upload skipped.'
    );
    return;
  } else {
    tl.setResult(
      tl.TaskResult.Skipped,
      'Cache exists. Upload skipped.'
    );
    return;
  }
};

module.exports = { addPipelineIdToKey, restoreCache, uploadCache };
