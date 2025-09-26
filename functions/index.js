const pick = require("../util/pick");
const fetch = require("node-fetch");
const shouldCompress = require("../util/shouldCompress");
const compress = require("../util/compress");

const DEFAULT_QUALITY = 40;

exports.handler = async (event, context) => {
    // Pastikan queryStringParameters ada
    const queryParams = event.queryStringParameters || {};
    let { url, jpeg, bw, l, w, q } = queryParams;

    // Log untuk debugging
    console.log("Query parameters:", queryParams);

    if (!url) {
        console.log("No URL provided, returning default response");
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
    const quality = parseInt(q, 10) || parseInt(l, 10) || DEFAULT_QUALITY; // Gunakan q, fallback ke l
    const width = parseInt(w, 10) || null; // Gunakan w, null jika tidak ada

    // Validasi parameter (opsional, hanya untuk keamanan)
    if (quality < 1 || quality > 100) {
        console.log("Invalid quality value:", quality);
        // Gunakan DEFAULT_QUALITY alih-alih error agar tidak mengganggu
        quality = DEFAULT_QUALITY;
    }
    if (width && (width < 1 || isNaN(width))) {
        console.log("Invalid width value:", width);
        width = null; // Abaikan width jika tidak valid
    }

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
                console.log(`Fetch failed with status ${res.status}: ${url}`);
                return {
                    statusCode: res.status || 502,
                    body: `Failed to fetch image: ${res.statusText}`,
                };
            }
            response_headers = res.headers;
            return {
                data: await res.buffer(),
                type: res.headers.get("content-type") || "",
            };
        });

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
                width, // Teruskan parameter width
                originSize
            );

            if (err) {
                console.log("Conversion failed: ", url, err);
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
        console.error("Error:", err);
        return {
            statusCode: 500,
            body: err.message || "Internal Server Error",
        };
    }
};