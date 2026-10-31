import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
    googleId: {
      type: String,
      unique: true,
      sparse: true
    },
    username: {
        type: String,
        required: [ true, "Username is required" ],
        unique: [ true, "Username must be unique" ]
    },
    email: {
        type: String,
        required: [ true, "Email is required" ],
        unique: [ true, "Email must be unique" ]
    },
    password: {
        type: String,
        required: function () {
            return !this.googleId;
        }
    },
    verified: {
        type: Boolean,
        default: false
    },
    profilePicture: {
      type: String,
      default: ""
    },
    Ratings : {
        type : Number,
        default : 0
    },
    active :{
        type : Boolean,
        default : true
    },
    role : {
        type : String,
        default : "Doctor"
    },
    specialization: { type: String, required: true, index: true },
    qualifications: [{ type: String }],
    experienceYears: { type: Number, default: 0, min: 0 },
    licenseNumber: { type: String, required: true, unique: true },
    consultationFee: { type: Number, default: 0, min: 0 },
    bio: { type: String, maxlength: 1000 },
    clinicAddress: { type: String },
    medical_license : {
        type : String,
        required : true
    },
    Adhar_Card : {
        type : String,
        required : true
    },
    pancard : {
       type : String,
       required : true
    },
    UG_Degree_certificate : {
        type : String,
        required : true
    },
    PG_Degree_certificate : {
        type : String
    },
    Photo : {
        type  : String,
        required : true
    },
     status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
     razorpayAccountId: {
        type: String,
        default: null
    },

    razorpayAccountStatus: {
        type: String,
        enum: ['NOT_CREATED', 'PENDING', 'ACTIVATED', 'SUSPENDED'],
        default: 'NOT_CREATED'
    },
    Money_earned : {
        type : Number
    },
    socketId : {
        type : String
    }
}, {
    timestamps: true, toJSON: { virtuals: true }
});

const DoctorModel = mongoose.model('Doctor', doctorSchema, 'doctors');

export default DoctorModel;