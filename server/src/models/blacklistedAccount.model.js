import mongoose from 'mongoose';

const blacklistedAccountSchema = new mongoose.Schema({
    accountId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    accountType: {
        type: String,
        enum: ['user', 'doctor'],
        required: true
    },
    email: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

blacklistedAccountSchema.index({ accountType: 1, accountId: 1 }, { unique: true });

const BlacklistedAccount = mongoose.model('BlacklistedAccount', blacklistedAccountSchema);

export default BlacklistedAccount;
