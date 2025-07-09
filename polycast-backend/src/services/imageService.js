// imageService.js
// Service for generating images using OpenAI's image generation API

const { OpenAI } = require('openai');
const config = require('../config/config');

const openai = new OpenAI({
    apiKey: config.openaiApiKey,
});

/**
 * Generates an image based on a prompt using OpenAI's image generation API.
 * @param {string} prompt - The text prompt to generate the image from.
 * @param {string} [size='1024x1024'] - The desired size of the image (1024x1024, 1792x1024, 1024x1792).
 * @param {string} [moderation='auto'] - Content filtering sensitivity ('auto' or 'low').
 * @returns {Promise<string>} - The URL of the generated image.
 */
async function generateImage(prompt, size = '1024x1024', moderation = 'auto') {
    console.log(`Generating image with prompt: "${prompt}", size: ${size}, moderation: ${moderation}`);
    try {
        // Use direct HTTP request to avoid unsupported parameters
        let fetchFn = global.fetch;
        if (!fetchFn) {
            fetchFn = (await import('node-fetch')).default;
        }
        const apiUrl = 'https://api.openai.com/v1/images/generations';
        const response = await fetchFn(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-image-1',
                prompt,
                n: 1,
                size,
                moderation,
            }),
        });
        const json = await response.json();
        if (!response.ok) {
            console.error('OpenAI image API error:', json);
            throw new Error(json.error?.message || 'Failed to generate image (HTTP)');
        }
        console.log('Image generated successfully via HTTP');

        const item = json?.data?.[0];

        // GPT‑image‑1 always returns b64_json
        if (item?.b64_json) {
            // Option A: return a data‑URI the front‑end can <img src="…">
            return `data:image/png;base64,${item.b64_json}`;

            // Option B (uncomment if you'd rather save a file and return a URL):
            // const buffer = Buffer.from(item.b64_json, 'base64');
            // const fileKey = `img_${Date.now()}.png`;
            // await fs.promises.writeFile(`/tmp/${fileKey}`, buffer);
            // return `https://your‑cdn/${fileKey}`;
        }

        console.warn('No b64_json in image response', json);
        throw new Error('OpenAI image response missing b64_json');
    } catch (error) {
        console.error('Error generating image:', error.message || error);
        throw new Error('Failed to generate image');
    }
}

module.exports = {
    generateImage,
};
