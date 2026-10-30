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
        type : string,
        required : true
    },
    Adhar_Card : {
        type : string,
        required : true
    },
    pancard : {
       type : string,
       reuqired : true
    },
    UG_Degree_certificate : {
        type : string,
        reuqired : true
    },
    PG_Degree_certificate : {
        type : string
    },
    Photo : {
        type  : string,
        required : true
    },
     status: {
      type: String,
      enum: ["REGISTERED", "KYC_SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"],
      default: "REGISTERED",
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
    }
}, {
    timestamps: true, toJSON: { virtuals: true }
});

const DoctorModel = mongoose.model('Doctor', doctorSchema, 'doctors');

export default DoctorModel;