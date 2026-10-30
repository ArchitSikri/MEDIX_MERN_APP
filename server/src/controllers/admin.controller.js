import mongoose from 'mongoose';
import DoctorModel from '../models/doctor.model.js';
import userModel from '../models/user.model.js';
import sessionModel from '../models/sessionn.model.js';
import BlacklistedAccount from '../models/blacklistedAccount.model.js';

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
    if (req.user?._id.equals(userId)) {
        return res.status(403).json({ message: 'Admins cannot blacklist their own account' });
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