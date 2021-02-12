const AWS = require("aws-sdk");
const fs = require("fs");
const tar = require("tar-fs");
const tarStream = require("tar-stream");

const createCacheEntry = async (targetPath, credentials, bucketName, keyName) => {
   try {
      const useLocal = process.env.AWS_ENV === "localstack";
      const endpoint = useLocal ? "http://localhost:4566" : undefined;
      if (!credentials) console.log("No credentials provided. Using ambient credentials.")
      if (!targetPath) throw SyntaxError("Missing targetPath. A targetPath must be provided.");
      const s3client = new AWS.S3({
         credentials: credentials ? credentials : {},
         endpoint,
         s3ForcePathStyle: useLocal
      });

      const pathIsDir = fs.statSync(targetPath).isDirectory();
      let stream;

      if (pathIsDir) {
         stream = tar.pack(targetPath);
      } else {
         const pathArr = targetPath.split("/");
         const fileName = pathArr[pathArr.length -1];
         const tarStrPacked = await tarStream.pack();
         await tarStrPacked.entry({name: fileName}, fs.readFileSync(targetPath));
         tarStrPacked.finalize();
         stream = tarStrPacked;
      }
      
      return await s3client.upload(
         {
            Bucket: bucketName,
            Key: keyName,
            Body: stream,
         }
      ).promise()

   } catch (err) {
      return err;
   };
};

module.exports = createCacheEntry;
