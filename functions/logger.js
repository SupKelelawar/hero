const pick = require("../util/pick");
const fetch = require("node-fetch");
const shouldCompress = require("../util/shouldCompress");
const compress = require("../util/compress");

exports.handler = async (event, context) => {
    console.error("Reached here...");
    console.log(event);
    let { url } = event.queryStringParameters;
    const { jpeg, bw, l } = event.queryStringParameters;

    try {
        if( true )
            throw Error("Hi");
    } catch (err) {
        console.error(err);
    }

    try {
        if( true )
            throw Error("Test");
    } catch {
        console.error("test faile");
    }

    return {
        statusCode: 200,
        body: JSON.stringify({DEFAULT_QUALITY, event, context})
    }
}
