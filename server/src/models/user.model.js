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
    UPI_Id: {
        type: String,
        default: null
    },
    Money_spend : {
        type : Number
    },
    socketid : {
        type : String
    },
    wallet : {
        type: Number,
        default: 0,
        min: 0
    },
    walletPaymentIds: {
        type: [String],
        default: [],
        select: false
    }
} , { timestamps: true } )

const userModel = mongoose.model("users", userSchema)

export default userModel;
