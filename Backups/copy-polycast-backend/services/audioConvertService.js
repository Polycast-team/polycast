const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Convert a buffer of audio (webm) to wav using ffmpeg, returning a Promise that resolves to a Buffer.
 * @param {Buffer} inputBuffer - The webm audio buffer
 * @returns {Promise<Buffer>} - The converted wav audio buffer
 */
async function convertWebmToWav(inputBuffer) {
    // Write inputBuffer to a temporary file
    const inputPath = path.join(os.tmpdir(), `polycast_input_${Date.now()}.webm`);
    const outputPath = path.join(os.tmpdir(), `polycast_output_${Date.now()}.wav`);
    fs.writeFileSync(inputPath, inputBuffer);

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('wav')
            .on('end', function() {
                fs.readFile(outputPath, (err, data) => {
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                    if (err) reject(err);
                    else resolve(data);
                });
            })
            .on('error', function(err) {
                fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                reject(err);
            })
            .save(outputPath);
    });
}

module.exports = { convertWebmToWav };
