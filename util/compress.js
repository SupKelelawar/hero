const sharp = require("sharp");

function compress(input, webp, grayscale, quality, width, originSize) {
    const format = webp ? "webp" : "jpeg";

    // Validasi parameter
    const qualityValue = Math.max(1, Math.min(100, parseInt(quality) || 80)); // Default quality: 80
    const widthValue = width ? Math.max(1, parseInt(width)) : null; // Pastikan width positif atau null

    const sharpInstance = sharp(input).grayscale(grayscale);

    // Terapkan resize jika width diberikan
    if (widthValue) {
        sharpInstance.resize({ width: widthValue });
    }

    return sharpInstance
        .toFormat(format, {
            quality: qualityValue,
            progressive: true,
            optimizeScans: true,
        })
        .toBuffer({ resolveWithObject: true })
        .then(({ data: output, info }) => {
            return {
                err: null,
                headers: {
                    "content-type": `image/${format}`,
                    "content-length": info.size,
                    "x-original-size": originSize,
                    "x-bytes-saved": originSize - info.size,
                },
                output: output,
            };
        })
        .catch((err) => {
            return {
                err: err,
            };
        });
}

module.exports = compress;