import { Router } from 'express';
import {
    getMe,
    googleLogin,
    login,
    logout,
    logoutAll,
    refreshToken,
    registerUser,
    toggleActive,
    updateProfilePicture,
    verifyEmail
} from '../controllers/authUser.controller.js';
import { authUser } from '../middleware/authMiddleware.js';
import { uploadUserProfilePicture } from '../middleware/multer.middleware.js';

const authRouter = Router();

authRouter.post('/register', uploadUserProfilePicture, registerUser);
authRouter.post('/verify-email', verifyEmail);
authRouter.post('/login', login);
authRouter.get('/me', authUser ,getMe);
authRouter.put('/profile-picture', authUser, uploadUserProfilePicture, updateProfilePicture);
authRouter.post('/refresh', refreshToken);
authRouter.post('/logout', authUser ,logout);
authRouter.post('/logout-all', authUser  ,logoutAll);
authRouter.post('/googlelogin', googleLogin);
authRouter.post('/toggle-active', authUser, toggleActive);

export default authRouter;