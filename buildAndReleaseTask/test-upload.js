const fs = require('fs');
const path = require('path');
const saveCacheFile = require('./aws');

const testUpload = () => {
   const filePath = path.resolve(__dirname, 'test.txt');
   const fileStream = fs.createReadStream(filePath);
   const now = new Date();
   const fileName = `test-${now.toISOString()}.tx`;
   saveCacheFile(fileStream, fileName).then((response) => {
      console.log(":)");
      console.log(response);
   }).catch((err) => {
      console.log(":|");
      console.log(err);
   })
}

testUpload();
