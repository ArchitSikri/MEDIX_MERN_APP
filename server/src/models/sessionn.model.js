import mongoose, { model } from "mongoose";

const sessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: function () {
            return this.accountType === "user";
        }
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: function () {
            return this.accountType === "doctor";
        }
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        required: function () {
            return this.accountType === "admin";
        }
    },
    accountType: {
        type: String,
        enum: ["user", "doctor", "admin"],
        default: "user"
    },
    refreshTokenHash: {
        type: String,
        required: [ true, "Refresh token hash is required" ]
    },
    ip: {
        type: String,
        required: [ true, "IP address is required" ]
    },
    userAgent: {
        type: String,
        required: [ true, "User agent is required" ]
    },
    revoked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})

const sessionModel = mongoose.model("sessions", sessionSchema)


export default sessionModel