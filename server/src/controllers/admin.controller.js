import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import jwt from 'jsonwebtoken';
import AdminModel from '../models/admin.model.js';
import DoctorModel from '../models/doctor.model.js';
import userModel from '../models/user.model.js';
import sessionModel from '../models/sessionn.model.js';
import BlacklistedAccount from '../models/blacklistedAccount.model.js';
import config from '../config/config.js';

const scrypt = promisify(crypto.scrypt);
const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/admin',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

function hashRefreshToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derivedKey = await scrypt(password, salt, 64);
    return `${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
    if (typeof storedHash !== 'string') {
        return false;
    }

    const [saltHex, hashHex, ...extra] = storedHash.split(':');
    if (
        extra.length > 0 ||
        !/^[a-f\d]{32}$/i.test(saltHex) ||
        !/^[a-f\d]{128}$/i.test(hashHex)
    ) {
        return false;
    }

    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

function safeEqual(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length &&
        crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function registerAdmin(req, res) {
    const { username, email, password, adminSecretKey } = req.body ?? {};
    if (
        typeof username !== 'string' || !username.trim() ||
        typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || !password ||
        typeof adminSecretKey !== 'string' || !adminSecretKey
    ) {
        return res.status(400).json({
            message: 'Username, email, password, and admin secret key are required'
        });
    }

    if (!config.ADMIN_SECRET_KEY) {
        return res.status(503).json({ message: 'Admin registration is not configured' });
    }
    if (!safeEqual(adminSecretKey, config.ADMIN_SECRET_KEY)) {
        return res.status(403).json({ message: 'Invalid admin secret key' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    if (await AdminModel.exists({
        $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    })) {
        return res.status(409).json({ message: 'An admin with this email or username already exists' });
    }

    const admin = await AdminModel.create({
        username: normalizedUsername,
        email: normalizedEmail,
        password: await hashPassword(password)
    });

    return res.status(201).json({
        message: 'Admin registered successfully',
        admin: {
            id: admin._id,
            username: admin.username,
            email: admin.email
        }
    });
}

export async function loginAdmin(req, res) {
    const { email, password, adminSecretKey } = req.body ?? {};
    if (
        typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || !password ||
        typeof adminSecretKey !== 'string' || !adminSecretKey
    ) {
        return res.status(400).json({ message: 'Email, password, and admin secret key are required' });
    }
    if (!config.ADMIN_SECRET_KEY) {
        return res.status(503).json({ message: 'Admin login is not configured' });
    }
    if (!safeEqual(adminSecretKey, config.ADMIN_SECRET_KEY)) {
        return res.status(403).json({ message: 'Invalid admin secret key' });
    }

    const admin = await AdminModel.findOne({
        email: email.trim().toLowerCase()
    }).select('+password');
    if (!admin || !admin.active || !await verifyPassword(password, admin.password)) {
        return res.status(401).json({ message: 'Invalid email or password' });
    }

    const refreshToken = jwt.sign(
        { _id: admin._id.toString(), tokenType: 'admin' },
        config.JWT_SECRET,
        { expiresIn: '7d', jwtid: crypto.randomUUID() }
    );
    const session = await sessionModel.create({
        admin: admin._id,
        accountType: 'admin',
        refreshTokenHash: hashRefreshToken(refreshToken),
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    });
    const accessToken = jwt.sign(
        {
            _id: admin._id.toString(),
            sessionId: session._id,
            role: 'admin',
            tokenType: 'admin'
        },
        config.JWT_SECRET,
        { expiresIn: '15m' }
    );

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    return res.status(200).json({
        message: 'Admin logged in successfully',
        admin: {
            id: admin._id,
            username: admin.username,
            email: admin.email
        },
        accessToken
    });
}

export async function refreshAdminToken(req, res) {
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

    const adminId = decoded._id ?? decoded.id;
    if (
        decoded.tokenType !== 'admin' ||
        typeof adminId !== 'string' ||
        !mongoose.isValidObjectId(adminId)
    ) {
        return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const session = await sessionModel.findOne({
        refreshTokenHash: hashRefreshToken(refreshToken),
        admin: adminId,
        accountType: 'admin',
        revoked: false
    });
    if (!session) {
        return res.status(401).json({ message: 'Session not found' });
    }

    const admin = await AdminModel.findById(adminId);
    if (!admin || !admin.active) {
        return res.status(403).json({ message: 'Admin account is inactive' });
    }

    const newRefreshToken = jwt.sign(
        { _id: adminId, tokenType: 'admin' },
        config.JWT_SECRET,
        { expiresIn: '7d', jwtid: crypto.randomUUID() }
    );
    session.refreshTokenHash = hashRefreshToken(newRefreshToken);
    await session.save();

    const accessToken = jwt.sign(
        {
            _id: adminId,
            sessionId: session._id,
            role: 'admin',
            tokenType: 'admin'
        },
        config.JWT_SECRET,
        { expiresIn: '15m' }
    );

    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);
    return res.status(200).json({
        message: 'Access token refreshed successfully',
        accessToken
    });
}

export async function logoutAdmin(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token not found' });
    }

    const session = await sessionModel.findOne({
        refreshTokenHash: hashRefreshToken(refreshToken),
        admin: req.admin._id,
        accountType: 'admin',
        revoked: false
    });
    if (!session) {
        return res.status(401).json({ message: 'Session not found' });
    }

    session.revoked = true;
    await session.save();
    res.clearCookie('refreshToken', refreshCookieOptions);
    return res.status(200).json({ message: 'Admin logged out successfully' });
}

export async function listPendingDoctors(req, res) {
    const doctors = await DoctorModel.find({ status: 'PENDING' })
        .select('-password')
        .sort({ createdAt: 1 });

    return res.status(200).json({ doctors });
}

export async function approveDoctor(req, res) {
    const { doctorId } = req.params;
    if (!mongoose.isValidObjectId(doctorId)) {
        return res.status(400).json({ message: 'Invalid doctor ID' });
    }

    const doctor = await DoctorModel.findOneAndUpdate(
        { _id: doctorId, status: 'PENDING' },
        { status: 'APPROVED' },
        { new: true, runValidators: true }
    ).select('-password');

    if (doctor) {
        return res.status(200).json({
            message: 'Doctor approved successfully',
            doctor
        });
    }

    if (!await DoctorModel.exists({ _id: doctorId })) {
        return res.status(404).json({ message: 'Doctor not found' });
    }

    return res.status(409).json({ message: 'Only pending doctors can be approved' });
}

export async function blacklistDoctor(req, res) {
    const { doctorId } = req.params;
    if (!mongoose.isValidObjectId(doctorId)) {
        return res.status(400).json({ message: 'Invalid doctor ID' });
    }

    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found' });
    }
    if (!doctor.active) {
        return res.status(409).json({ message: 'Doctor is already blacklisted' });
    }

    await BlacklistedAccount.create({
        accountId: doctor._id,
        accountType: 'doctor',
        email: doctor.email
    });
    doctor.active = false;
    await doctor.save();
    await sessionModel.updateMany(
        { doctor: doctor._id, accountType: 'doctor', revoked: false },
        { revoked: true }
    );

    return res.status(200).json({
        message: 'Doctor blacklisted successfully',
        doctor: {
            id: doctor._id,
            email: doctor.email,
            active: doctor.active,
            status: doctor.status
        }
    });
}

export async function blacklistUser(req, res) {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await userModel.findById(userId);
    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }
    if (!user.active) {
        return res.status(409).json({ message: 'User is already blacklisted' });
    }

    await BlacklistedAccount.create({
        accountId: user._id,
        accountType: 'user',
        email: user.email
    });
    user.active = false;
    await user.save();
    await sessionModel.updateMany(
        { user: user._id, accountType: 'user', revoked: false },
        { revoked: true }
    );

    return res.status(200).json({
        message: 'User blacklisted successfully',
        user: {
            id: user._id,
            email: user.email,
            active: user.active
        }
    });
}