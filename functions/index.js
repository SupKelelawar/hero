const pick = require("../util/pick");
const fetch = require("node-fetch");
const shouldCompress = require("../util/shouldCompress");
const compress = require("../util/compress");

const DEFAULT_QUALITY = 40;

exports.handler = async (event, context) => {
    const { w, q, url, jpeg, bw, l } = event.queryStringParameters;

    // Validasi w dan q di awal
    const quality = parseInt(q, 10) || parseInt(l, 10) || DEFAULT_QUALITY;
    const width = parseInt(w, 10) || null;

    if (quality < 1 || quality > 100) {
        return {
            statusCode: 400,
            body: "Quality (q) must be between 1 and 100",
        };
    }
    if (width && (width < 1 || isNaN(width))) {
        return {
            statusCode: 400,
            body: "Width (w) must be a positive number",
        };
    }

    // Periksa apakah URL ada
    if (!url) {
        return {
            statusCode: 200,
            body: "bandwidth-hero-proxy",
        };
    }

    let processedUrl = url;
    try {
        processedUrl = JSON.parse(url); // Jika url adalah JSON string
    } catch {
        // Biarkan url tetap string jika parsing gagal
    }

    if (Array.isArray(processedUrl)) {
        processedUrl = processedUrl.join("&url=");
    }

    // Bersihkan URL
    processedUrl = processedUrl.replace(/http:\/\/1\.1\.\d\.\d\/bmi\/(https?:\/\/)?/i, "http://");

    const webp = !jpeg;
    const grayscale = bw != 0;

    try {
        let response_headers = {};
        const { data, type: originType } = await fetch(processedUrl, {
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

        // Jika fetch gagal (status code dikembalikan), kembalikan respons
        if (data.statusCode) {
            return data;
        }

        const originSize = data.length;

        if (shouldCompress(originType, originSize, webp)) {
            const { err, output, headers } = await compress(
                data,
                webp,
                grayscale,
                quality,
                width,
                originSize
            );

            if (err) {
                console.log("Conversion failed: ", processedUrl);
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