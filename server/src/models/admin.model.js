import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        default: 'admin',
        immutable: true
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const AdminModel = mongoose.model('Admin', adminSchema, 'admins');

export default AdminModel;