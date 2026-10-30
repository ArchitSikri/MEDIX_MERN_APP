import multer from 'multer';

const allowedImageTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp'
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!allowedImageTypes.has(file.mimetype)) {
            const error = new Error('Only JPEG, PNG, GIF, WEBP, and BMP image files are allowed');
            error.status = 415;
            return cb(error);
        }

        return cb(null, true);
    },
});

const parseDoctorDocuments = upload.fields([
    { name: 'profilePicture', maxCount: 1 },
    { name: 'medical_license', maxCount: 1 },
    { name: 'Adhar_Card', maxCount: 1 },
    { name: 'pancard', maxCount: 1 },
    { name: 'UG_Degree_certificate', maxCount: 1 },
    { name: 'PG_Degree_certificate', maxCount: 1 },
    { name: 'Photo', maxCount: 1 }
]);

function handleUpload(parser, req, res, next) {
    parser(req, res, (error) => {
        if (!error) {
            return next();
        }

        if (error instanceof multer.MulterError) {
            const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            return res.status(status).json({ message: error.message });
        }

        if (error.status === 415) {
            return res.status(415).json({ message: error.message });
        }

        return next(error);
    });
}

export function uploadDoctorDocuments(req, res, next) {
    return handleUpload(parseDoctorDocuments, req, res, next);
}

export function uploadUserProfilePicture(req, res, next) {
    return handleUpload(upload.single('profilePicture'), req, res, next);
}