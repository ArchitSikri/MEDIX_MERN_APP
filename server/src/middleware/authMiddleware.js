import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import userModel from '../models/user.model.js';
import DoctorModel from '../models/doctor.model.js';
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

export async function authUser(req, res, next) {
    const token = getBearerToken(req);
    if (!token) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const userId = verifyToken(token, res);
    if (!userId) {
        return;
    }

    const user = await userModel.findById(userId);
    if (!user) {
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

    const doctorId = verifyToken(token, res);
    if (!doctorId) {
        return;
    }

    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    req.doctor = doctor;
    return next();
}
