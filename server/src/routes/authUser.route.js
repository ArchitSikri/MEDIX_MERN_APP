import { Router } from 'express';
import {
    getMe,
    getUserProfile,
    googleLogin,
    login,
    logout,
    logoutAll,
    refreshToken,
    registerUser,
    toggleActive,
    updateProfilePicture,
    updateUserProfile,
    createWalletTopupOrder,
    verifyWalletTopup,
    verifyEmail
} from '../controllers/authUser.controller.js';
import { authUser } from '../middleware/authMiddleware.js';
import { uploadUserProfilePicture } from '../middleware/multer.middleware.js';
import {
    createAppointment,
    listApprovedDoctors,
    listUserAppointments
} from '../controllers/appointment.controller.js';

const authRouter = Router();

authRouter.post('/register', uploadUserProfilePicture, registerUser);
authRouter.post('/verify-email', verifyEmail);
authRouter.post('/login', login);
authRouter.get('/me', authUser ,getMe);
authRouter.get('/doctors', authUser, listApprovedDoctors);
authRouter.get('/appointments', authUser, listUserAppointments);
authRouter.post('/appointments', authUser, createAppointment);
authRouter.get('/profile/:userId', authUser, getUserProfile);
authRouter.put('/profile/:userId', authUser, uploadUserProfilePicture, updateUserProfile);
authRouter.post('/wallet/topup/order', authUser, createWalletTopupOrder);
authRouter.post('/wallet/topup/verify', authUser, verifyWalletTopup);
authRouter.put('/profile-picture', authUser, uploadUserProfilePicture, updateProfilePicture);
authRouter.post('/refresh', refreshToken);
authRouter.post('/logout', authUser ,logout);
authRouter.post('/logout-all', authUser  ,logoutAll);
authRouter.post('/googlelogin', googleLogin);
authRouter.post('/toggle-active', authUser, toggleActive);

export default authRouter;