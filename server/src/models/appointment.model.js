import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true,
        index: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor',
        required: true,
        index: true
    },
    scheduledAt: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['PENDING', 'CONFIRMED', 'REJECTED'],
        default: 'PENDING',
        index: true
    },
    reason: {
        type: String,
        maxlength: 500,
        default: ''
    }
}, { timestamps: true });

appointmentSchema.index({ doctor: 1, scheduledAt: 1, status: 1 });

const AppointmentModel = mongoose.model('Appointment', appointmentSchema);

export default AppointmentModel;
