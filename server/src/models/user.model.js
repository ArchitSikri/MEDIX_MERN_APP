import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
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
        default : "user"
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
    Money_spend : {
        type : Number
    }
} , { timestamps: true } )

const userModel = mongoose.model("users", userSchema)

export default userModel;
