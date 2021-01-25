const fs = require('fs');
const path = require('path');
const uploadCacheFile = require('../uploadCache');
require('dotenv').config();

const testUpload = () => {
   const filePath = path.resolve(__dirname, 'test.txt');
   const fileStream = fs.createReadStream(filePath);
   const now = new Date();
   const fileName = `test-${now.toISOString()}.tx`;
   const credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_KEY,
   };   
   const bucketName = process.env.AWS_BUCKET_NAME;

   return uploadCacheFile(fileStream, credentials, bucketName, fileName).then((resp) => {
      return resp
   }).catch((err) => {
      return(err)
   })
}



testUpload().then((result) => { console.log(result) })
