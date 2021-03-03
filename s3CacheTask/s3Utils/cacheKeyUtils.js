const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const isPathyChar = (char) => {
    const globChars = ['*', '?', '[', ']'];
    const pathChars = ['/', ':'];
    const invalidFileChars = ['"', '<', '>', '|'];

    if (!char) return false;
    if (globChars.includes(char)) return true;
    if (pathChars.includes(char)) return true;
    return !invalidFileChars.includes(char);
};

const isPathyPart = (part) => {
    if (!part) return false;
    if (part.startsWith('"') && part.endsWith('"')) return false;
    if (part.split('').some(c => !isPathyChar(c))) return false;
    if (part.includes('.') && part.includes('/') && part.includes('\\')) return false;
    if (part.endsWith('.')) return false;
    return true;
};

const createHashFromFile = filePath => new Promise(resolve => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(filePath)
        .on('data', data => hash.update(data))
        .on('end', () => resolve(hash.digest('hex')));
});

const createHashFromString = inputString => {
    return crypto.createHash('sha256').update(inputString).digest("hex");
};

const hashFileOrString = async (part, workingDir) => {
    if (!isPathyPart(part)) return createHashFromString(part);

    const pathExists = [part, path.resolve(workingDir, part)].find(p => fs.existsSync(p));

    if (pathExists && fs.statSync(pathExists).isFile()) {
        return await createHashFromFile(pathExists);
    } else {
        return createHashFromString(part);
    };
};

module.exports = { isPathyChar, isPathyPart, createHashFromString, hashFileOrString };
