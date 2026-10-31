import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import userModel from '../models/user.model.js';
import DoctorModel from '../models/doctor.model.js';
import AdminModel from '../models/admin.model.js';
import sessionModel from '../models/sessionn.model.js';
import BlacklistToken from '../models/blacklistToken.model.js';
import BlacklistedAccount from '../models/blacklistedAccount.model.js';
import config from '../config/config.js';

function getBearerToken(req) {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return null;
    }

    const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length > 0) {
        return null;
    }

    return token;
}

function verifyToken(token, res) {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        const userId = decoded._id ?? decoded.id;
        if (typeof userId !== 'string' || !mongoose.isValidObjectId(userId)) {
            res.status(401).json({ message: 'Unauthorized' });
            return null;
        }

        return userId;
    } catch {
        res.status(401).json({ message: 'Unauthorized' });
        return null;
    }
}

async function rejectBlacklistedToken(token, res) {
    const blacklistedToken = await BlacklistToken.exists({ token });
    if (blacklistedToken) {
        res.status(401).json({ message: 'Unauthorized' });
        return true;
    }

    return false;
}

export async function authUser(req, res, next) {
    const token = getBearerToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (await rejectBlacklistedToken(token, res)) {
        return;
    }

    const userId = verifyToken(token, res);
    if (!userId) {
        return;
    }

    const user = await userModel.findById(userId);
    if (
        !user ||
        !user.active ||
        await BlacklistedAccount.exists({ accountType: 'user', accountId: userId })
    ) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = user;
    return next();
}

export async function authDoctor(req, res, next) {
    const token = getBearerToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (await rejectBlacklistedToken(token, res)) {
        return;
    }

    const doctorId = verifyToken(token, res);
    if (!doctorId) {
        return;
    }

    const doctor = await DoctorModel.findById(doctorId);
    if (
        !doctor ||
        !doctor.active ||
        doctor.status !== 'APPROVED' ||
        await BlacklistedAccount.exists({ accountType: 'doctor', accountId: doctorId })
    ) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    req.doctor = doctor;
    return next();
}

export async function authAdmin(req, res, next) {
    const token = getBearerToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (await rejectBlacklistedToken(token, res)) {
        return;
    }

    let decoded;
    try {
        decoded = jwt.verify(token, config.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (
        !decoded ||
        typeof decoded !== 'object' ||
        decoded.role !== 'admin' ||
        decoded.tokenType !== 'admin' ||
        typeof decoded._id !== 'string' ||
        !mongoose.isValidObjectId(decoded._id)
    ) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (
        typeof decoded.sessionId !== 'string' ||
        !mongoose.isValidObjectId(decoded.sessionId)
    ) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const session = await sessionModel.findOne({
        _id: decoded.sessionId,
        admin: decoded._id,
        accountType: 'admin',
        revoked: false
    });
    if (!session) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const admin = await AdminModel.findById(decoded._id);
    if (!admin || !admin.active) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    req.admin = admin;
    return next();
}

export function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    if (typeof req.user.role !== 'string' || req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }

    return next();
}
