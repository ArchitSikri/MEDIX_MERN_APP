import mongoose from 'mongoose';
import AppointmentModel from '../models/appointment.model.js';
import DoctorModel from '../models/doctor.model.js';

export async function listApprovedDoctors(req, res) {
    const doctors = await DoctorModel.find({
        active: true,
        verified: true,
        status: 'APPROVED'
    })
        .select('username profilePicture specialization qualifications experienceYears consultationFee bio clinicAddress Ratings')
        .sort({ specialization: 1, username: 1 })
        .lean();

    return res.status(200).json({ doctors });
}

export async function createAppointment(req, res) {
    const { doctorId, scheduledAt, reason } = req.body ?? {};
    if (
        typeof doctorId !== 'string' ||
        !mongoose.isValidObjectId(doctorId) ||
        typeof scheduledAt !== 'string' ||
        (reason != null && typeof reason !== 'string')
    ) {
        return res.status(400).json({ message: 'A valid doctor and appointment date/time are required' });
    }

    const appointmentDate = new Date(scheduledAt);
    if (!Number.isFinite(appointmentDate.getTime()) || appointmentDate <= new Date()) {
        return res.status(400).json({ message: 'Choose a future appointment date and time' });
    }
    if (reason?.trim().length > 500) {
        return res.status(400).json({ message: 'Appointment note cannot exceed 500 characters' });
    }

    const doctor = await DoctorModel.findOne({
        _id: doctorId,
        active: true,
        verified: true,
        status: 'APPROVED'
    }).select('_id');
    if (!doctor) {
        return res.status(404).json({ message: 'This doctor is not available for appointments' });
    }

    const conflictingAppointment = await AppointmentModel.exists({
        doctor: doctor._id,
        scheduledAt: appointmentDate,
        status: { $in: ['PENDING', 'CONFIRMED'] }
    });
    if (conflictingAppointment) {
        return res.status(409).json({ message: 'This time has already been requested. Choose another time.' });
    }

    const appointment = await AppointmentModel.create({
        user: req.user._id,
        doctor: doctor._id,
        scheduledAt: appointmentDate,
        reason: reason?.trim() || ''
    });

    return res.status(201).json({
        message: 'Appointment request sent to the doctor',
        appointment
    });
}

export async function listUserAppointments(req, res) {
    const appointments = await AppointmentModel.find({ user: req.user._id })
        .populate('doctor', 'username profilePicture specialization consultationFee')
        .sort({ scheduledAt: -1 })
        .lean();
    return res.status(200).json({ appointments });
}

export async function listDoctorAppointments(req, res) {
    const appointments = await AppointmentModel.find({ doctor: req.doctor._id })
        .populate('user', 'username email profilePicture')
        .sort({ scheduledAt: 1 })
        .lean();
    return res.status(200).json({ appointments });
}

export async function updateAppointmentStatus(req, res) {
    const { appointmentId } = req.params;
    const { status } = req.body ?? {};
    if (!mongoose.isValidObjectId(appointmentId) || !['CONFIRMED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'Valid appointment ID and status are required' });
    }

    const appointment = await AppointmentModel.findOneAndUpdate(
        { _id: appointmentId, doctor: req.doctor._id, status: 'PENDING' },
        { $set: { status } },
        { new: true, runValidators: true }
    ).populate('user', 'username email profilePicture');

    if (!appointment) {
        return res.status(404).json({ message: 'Pending appointment not found for this doctor' });
    }

    return res.status(200).json({
        message: `Appointment ${status.toLowerCase()}`,
        appointment
    });
}
