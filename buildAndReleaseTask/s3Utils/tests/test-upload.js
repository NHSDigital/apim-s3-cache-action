const fs = require('fs');
const path = require('path');
const uploadCacheFile = require('../uploadCache');

const testUpload = () => {
   const filePath = path.resolve(__dirname, 'test.txt');
   const fileStream = fs.createReadStream(filePath);
   const now = new Date();
   const fileName = `test-${now.toISOString()}.tx`;
   uploadCacheFile(fileStream, fileName).then((response) => {
      console.log(":)");
      console.log(response);
   }).catch((err) => {
      console.log(":|");
      console.log(err);
   })
}

testUpload();
