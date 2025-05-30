const debug = (stringToPrint) => {
    const shouldDebug = process.env.SHOULD_DEBUG === 'true'

    if (shouldDebug) console.log(stringToPrint);
    return;
};

module.exports = { debug };