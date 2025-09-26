const pick = require("../util/pick");
const fetch = require("node-fetch");
const shouldCompress = require("../util/shouldCompress");
const compress = require("../util/compress");

const DEFAULT_QUALITY = 40;

exports.handler = async (event, context) => {
    let { url, jpeg, bw, l, w, q } = event.queryStringParameters;

    if (!url) {
        return {
            statusCode: 200,
            body: "bandwidth-hero-proxy",
        };
    }

    try {
        url = JSON.parse(url); // Jika url adalah JSON string
    } catch {
        // Biarkan url tetap string jika parsing gagal
    }

    if (Array.isArray(url)) {
        url = url.join("&url=");
    }

    // Bersihkan URL
    url = url.replace(/http:\/\/1\.1\.\d\.\d\/bmi\/(https?:\/\/)?/i, "http://");

    const webp = !jpeg;
    const grayscale = bw != 0;
    const quality = parseInt(q, 10) || parseInt(l, 10) || DEFAULT_QUALITY; // Gunakan q jika ada, fallback ke l
    const width = parseInt(w, 10) || null; // Ambil parameter w, null jika tidak ada

    try {
        let response_headers = {};
        const { data, type: originType } = await fetch(url, {
            headers: {
                ...pick(event.headers, ["cookie", "dnt", "referer"]),
                "user-agent": "Bandwidth-Hero Compressor",
                "x-forwarded-for": event.headers["x-forwarded-for"] || event.ip,
                via: "1.1 bandwidth-hero",
            },
        }).then(async (res) => {
            if (!res.ok) {
                return {
                    statusCode: res.status || 302,
                };
            }

            response_headers = res.headers;
            return {
                data: await res.buffer(),
                type: res.headers.get("content-type") || "",
            };
        });

        const originSize = data.length;

        if (shouldCompress(originType, originSize, webp)) {
            const { err, output, headers } = await compress(
                data,
                webp,
                grayscale,
                quality,
                width, // Teruskan parameter width
                originSize
            );

            if (err) {
                console.log("Conversion failed: ", url);
                throw err;
            }

            console.log(
                `From ${originSize}, Saved: ${
                    ((originSize - output.length) / originSize) * 100
                }%`
            );
            const encoded_output = output.toString("base64");
            return {
                statusCode: 200,
                body: encoded_output,
                isBase64Encoded: true,
                headers: {
                    "content-encoding": "identity",
                    ...response_headers,
                    ...headers,
                },
            };
        } else {
            console.log("Bypassing... Size: ", data.length);
            return {
                statusCode: 200,
                body: data.toString("base64"),
                isBase64Encoded: true,
                headers: {
                    "content-encoding": "identity",
                    ...response_headers,
                },
            };
        }
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: err.message || "",
        };
    }
};