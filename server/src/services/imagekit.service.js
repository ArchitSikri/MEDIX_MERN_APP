const normalizeImageKitKey = (value = '') => {
    const key = String(value || '').trim().replace(/^['"]|['"]$/g, '').trim();
    if (!key) return '';
    return key.startsWith('private_') ? key : `private_${key.replace(/^private_/, '')}`;
};

function guessMime(fileName) {
    const name = (fileName || '').toLowerCase();
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.jpg')) return 'image/jpeg';
    if (name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.bmp')) return 'image/bmp';
    return 'image/jpeg';
}

function getAuthorizationHeader() {
    const privateKey = normalizeImageKitKey(process.env.IMAGEKIT_PRIVATE_KEY);
    if (!privateKey) {
        throw new Error('ImageKit private key is missing. Set IMAGEKIT_PRIVATE_KEY in BACKEND/.env.');
    }

    return `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`;
}

async function getErrorMessage(response) {
    const rawText = await response.text();
    try {
        const parsed = JSON.parse(rawText);
        return parsed?.message || rawText;
    } catch {
        return rawText;
    }
}

export async function uploadFile(buffer, fileName, mimeType = guessMime(fileName)) {
    try {
        const blob = new Blob([buffer], { type: mimeType });
        const form = new FormData();
        form.append('file', blob, fileName || 'image');
        form.append('fileName', fileName || 'image');

        const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            headers: { Authorization: getAuthorizationHeader() },
            body: form
        });

        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            const error = new Error(`ImageKit upload failed: ${response.status} ${errorMessage}`);
            error.status = response.status;

            if (/cannot be authenticated|unauthorized|invalid/i.test(errorMessage)) {
                error.message = 'ImageKit authentication failed. Check IMAGEKIT_PRIVATE_KEY in BACKEND/.env.';
            }

            throw error;
        }

        const result = await response.json();
        if (typeof result.url !== 'string' || typeof result.fileId !== 'string') {
            throw new Error('ImageKit upload response did not include a file URL and ID.');
        }

        return { url: result.url, fileId: result.fileId };
    } catch (error) {
        console.error('Error uploading file to ImageKit:', error);
        throw error;
    }
}

export async function deleteFile(fileId) {
    const response = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
        method: 'DELETE',
        headers: { Authorization: getAuthorizationHeader() }
    });

    if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        throw new Error(`ImageKit file deletion failed: ${response.status} ${errorMessage}`);
    }
}