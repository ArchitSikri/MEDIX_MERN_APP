const normalizeImageKitKey = (value = '') => {
    const key = String(value || '').trim().replace(/^['"]|['"]$/g, '').trim();
    if (!key) return '';
    return key.startsWith('private_') ? key : `private_${key.replace(/^private_/, '')}`;
};

const PRIVATE_KEY = normalizeImageKitKey(process.env.IMAGEKIT_PRIVATE_KEY)

function guessMime(fileName) {
    const name = (fileName || '').toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.jpg')) return 'image/jpg';
    if (name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.bmp')) return 'image/bmp';
    return 'image/jpeg';
}

async function uploadFile(buffer, fileName) {
    try {
        if (!PRIVATE_KEY) {
            throw new Error('ImageKit private key is missing. Set IMAGEKIT_PRIVATE_KEY in BACKEND/.env.');
        }

        const mime = guessMime(fileName);
        const blob = new Blob([buffer], { type: mime });

        const form = new FormData();
        form.append('file', blob, fileName || 'image');
        form.append('fileName', fileName || 'image');

        const auth = 'Basic ' + Buffer.from(`${PRIVATE_KEY}:`).toString('base64');

        const res = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            headers: { Authorization: auth },
            body: form,
        });

        if (!res.ok) {
            const rawText = await res.text();
            let errorMessage = rawText;

            try {
                const parsed = JSON.parse(rawText);
                errorMessage = parsed?.message || rawText;
            } catch {
                errorMessage = rawText;
            }

            const err = new Error(`ImageKit upload failed: ${res.status} ${errorMessage}`);
            err.status = res.status;

            if (/cannot be authenticated|unauthorized|invalid/i.test(errorMessage)) {
                err.message = 'ImageKit authentication failed. The current private key in BACKEND/.env is invalid or expired. Replace it with the correct ImageKit private key from the dashboard.';
            }

            throw err;
        }

        const json = await res.json();
        return { url: json.url, fileId: json.fileId };
    } catch (error) {
        console.error('Error uploading file to ImageKit:', error);
        throw error;
    }
}

module.exports = { uploadFile };