import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import DoctorModel from '../models/doctor.model.js';
import BlacklistedAccount from '../models/blacklistedAccount.model.js';
import userModel from '../models/user.model.js';
import sessionModel from '../models/sessionn.model.js';
import otpModel from '../models/otp.model.js';
import config from '../config/config.js';
import { sendEmail } from '../services/email.service.js';
import { deleteFile, uploadFile } from '../services/imagekit.service.js';
import { generateOtp, getOtpHtml } from '../utils/utils.js';

const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/doctor/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function doctorResponse(doctor) {
    return {
        id: doctor._id,
        username: doctor.username,
        email: doctor.email,
        profilePicture: doctor.profilePicture,
        specialization: doctor.specialization,
        status: doctor.status,
        verified: doctor.verified
    };
}

function getDoctorDocumentFiles(files = {}) {
    const requiredFields = [
        'medical_license',
        'Adhar_Card',
        'pancard',
        'UG_Degree_certificate',
        'Photo'
    ];
    const missingFields = requiredFields.filter((field) => !files[field]?.[0]);
    return { requiredFields, missingFields };
}

function createUploadFileName(field, originalName) {
    const extension = originalName.match(/\.[a-zA-Z0-9]+$/)?.[0].toLowerCase() || '.jpg';
    return `${field}-${crypto.randomUUID()}${extension}`;
}

async function deleteUploadedFiles(files) {
    const results = await Promise.allSettled(files.map(({ fileId }) => deleteFile(fileId)));
    for (const result of results) {
        if (result.status === 'rejected') {
            console.error('Failed to clean up doctor document from ImageKit:', result.reason);
        }
    }
}

export async function registerDoctor(req, res) {
    const body = req.body ?? {};
    const requiredTextFields = [
        'username',
        'email',
        'password',
        'specialization',
        'licenseNumber'
    ];

    if (requiredTextFields.some((field) => typeof body[field] !== 'string' || !body[field].trim())) {
        return res.status(400).json({
            message: `Required fields: ${requiredTextFields.join(', ')}`
        });
    }

    const { missingFields } = getDoctorDocumentFiles(req.files);
    if (missingFields.length > 0) {
        return res.status(400).json({
            message: `Required image files: ${missingFields.join(', ')}`
        });
    }

    const email = body.email.trim().toLowerCase();
    const username = body.username.trim();
    const duplicateDoctor = await DoctorModel.findOne({
        $or: [
            { email },
            { username },
            { licenseNumber: body.licenseNumber.trim() }
        ]
    });
    if (duplicateDoctor || await userModel.exists({ $or: [{ email }, { username }] })) {
        return res.status(409).json({ message: 'Email, username, or license number is already registered' });
    }

    const uploadedFiles = {};
    const uploadedAssets = [];

    try {
        for (const [field, files] of Object.entries(req.files ?? {})) {
            const file = files[0];
            const uploaded = await uploadFile(
                file.buffer,
                createUploadFileName(field, file.originalname),
                file.mimetype
            );
            uploadedFiles[field] = uploaded.url;
            uploadedAssets.push(uploaded);
        }
    } catch (error) {
        await deleteUploadedFiles(uploadedAssets);
        console.error('Failed to upload doctor registration documents:', error);
        return res.status(503).json({
            message: 'Unable to upload doctor documents. Check ImageKit configuration and try again.'
        });
    }

    let doctor;
    const otp = generateOtp();
    try {
        doctor = await DoctorModel.create({
            username,
            email,
            password: hashPassword(body.password),
            profilePicture: uploadedFiles.profilePicture || '',
            specialization: body.specialization.trim(),
            qualifications: Array.isArray(body.qualifications) ? body.qualifications : [],
            experienceYears: body.experienceYears ?? 0,
            licenseNumber: body.licenseNumber.trim(),
            consultationFee: body.consultationFee ?? 0,
            bio: body.bio,
            clinicAddress: body.clinicAddress,
            medical_license: uploadedFiles.medical_license,
            Adhar_Card: uploadedFiles.Adhar_Card,
            pancard: uploadedFiles.pancard,
            UG_Degree_certificate: uploadedFiles.UG_Degree_certificate,
            PG_Degree_certificate: uploadedFiles.PG_Degree_certificate,
            Photo: uploadedFiles.Photo,
            status: 'PENDING',
            verified: false,
            active: true
        });

        await otpModel.create({ email, doctor: doctor._id, otpHash: hashPassword(otp) });
    } catch (error) {
        if (doctor) {
            await otpModel.deleteMany({ doctor: doctor._id });
            await DoctorModel.findByIdAndDelete(doctor._id);
        }
        await deleteUploadedFiles(uploadedAssets);
        throw error;
    }

    try {
        await sendEmail(email, 'OTP Verification', `Your OTP code is ${otp}`, getOtpHtml(otp));
    } catch (error) {
        await otpModel.deleteMany({ doctor: doctor._id });
        await DoctorModel.findByIdAndDelete(doctor._id);
        await deleteUploadedFiles(uploadedAssets);
        console.error('Failed to send doctor verification email:', error);
        return res.status(503).json({
            message: 'Unable to send verification email. Check the email configuration and try again.'
        });
    }

    return res.status(201).json({
        message: 'Doctor registered. Verify your email and wait for admin approval before logging in.',
        doctor: doctorResponse(doctor)
    });
}

export async function verifyDoctorEmail(req, res) {
    const { otp, email } = req.body ?? {};
    if (typeof otp !== 'string' || typeof email !== 'string' || !otp || !email.trim()) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const otpDoc = await otpModel.findOne({
        email: email.trim().toLowerCase(),
        otpHash: hashPassword(otp),
        doctor: { $exists: true }
    });
    if (!otpDoc) {
        return res.status(400).json({ message: 'Invalid OTP' });
    }

    const doctor = await DoctorModel.findByIdAndUpdate(
        otpDoc.doctor,
        { verified: true },
        { new: true, runValidators: true }
    );
    await otpModel.deleteMany({ doctor: otpDoc.doctor });
    if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found' });
    }

    return res.status(200).json({
        message: 'Email verified. Your account is waiting for admin approval.',
        doctor: doctorResponse(doctor)
    });
}

export async function loginDoctor(req, res) {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const doctor = await DoctorModel.findOne({ email: email.trim().toLowerCase() });
    if (!doctor || doctor.password !== hashPassword(password)) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!doctor.verified) {
        return res.status(403).json({ message: 'Email not verified' });
    }
    if (doctor.status !== 'APPROVED') {
        return res.status(403).json({ message: `Doctor account is ${doctor.status.toLowerCase()}` });
    }
    if (
        !doctor.active ||
        await BlacklistedAccount.exists({ accountType: 'doctor', accountId: doctor._id })
    ) {
        return res.status(403).json({ message: 'Doctor account is inactive' });
    }

    const refreshToken = jwt.sign({ _id: doctor._id }, config.JWT_SECRET, { expiresIn: '7d' });
    const session = await sessionModel.create({
        doctor: doctor._id,
        accountType: 'doctor',
        refreshTokenHash: hashRefreshToken(refreshToken),
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    });
    const accessToken = jwt.sign(
        { _id: doctor._id, sessionId: session._id },
        config.JWT_SECRET,
        { expiresIn: '15m' }
    );

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    return res.status(200).json({
        message: 'Doctor logged in successfully',
        accessToken,
        doctor: doctorResponse(doctor)
    });
}

export async function refreshDoctorToken(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token not found' });
    }

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, config.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const doctorId = decoded._id ?? decoded.id;
    if (typeof doctorId !== 'string') {
        return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const session = await sessionModel.findOne({
        refreshTokenHash: hashRefreshToken(refreshToken),
        doctor: doctorId,
        accountType: 'doctor',
        revoked: false
    });
    if (!session) {
        return res.status(401).json({ message: 'Session not found' });
    }

    const doctor = await DoctorModel.findById(doctorId);
    if (
        !doctor ||
        !doctor.active ||
        !doctor.verified ||
        doctor.status !== 'APPROVED' ||
        await BlacklistedAccount.exists({ accountType: 'doctor', accountId: doctorId })
    ) {
        return res.status(403).json({ message: 'Doctor account is not approved or active' });
    }

    const newRefreshToken = jwt.sign({ _id: doctorId }, config.JWT_SECRET, { expiresIn: '7d' });
    session.refreshTokenHash = hashRefreshToken(newRefreshToken);
    await session.save();
    const accessToken = jwt.sign(
        { _id: doctorId, sessionId: session._id },
        config.JWT_SECRET,
        { expiresIn: '15m' }
    );

    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);
    return res.status(200).json({ message: 'Access token refreshed successfully', accessToken });
}

export async function getDoctorMe(req, res) {
    return res.status(200).json({
        message: 'Doctor fetched successfully',
        doctor: doctorResponse(req.doctor)
    });
}

export async function logoutDoctor(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token not found' });
    }

    const session = await sessionModel.findOne({
        refreshTokenHash: hashRefreshToken(refreshToken),
        doctor: req.doctor._id,
        accountType: 'doctor',
        revoked: false
    });
    if (!session) {
        return res.status(401).json({ message: 'Session not found' });
    }

    session.revoked = true;
    await session.save();
    res.clearCookie('refreshToken', refreshCookieOptions);
    return res.status(200).json({ message: 'Doctor logged out successfully' });
}

export async function logoutAllDoctorSessions(req, res) {
    await sessionModel.updateMany(
        { doctor: req.doctor._id, accountType: 'doctor', revoked: false },
        { revoked: true }
    );
    res.clearCookie('refreshToken', refreshCookieOptions);
    return res.status(200).json({ message: 'Logged out from all doctor sessions successfully' });
}
