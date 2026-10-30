import mongoose, { model } from "mongoose";

const sessionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
        required: function () {
            return this.accountType !== "doctor";
        }
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: function () {
            return this.accountType === "doctor";
        }
    },
    accountType: {
        type: String,
        enum: ["user", "doctor"],
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