import { Router } from 'express';
import {
    getMe,
    googleLogin,
    login,
    logout,
    logoutAll,
    refreshToken,
    registerUser,
    verifyEmail
} from '../controllers/authUser.controller.js';
import { authUser } from '../middleware/authMiddleware.js';

const authRouter = Router();

authRouter.post('/register', registerUser);
authRouter.post('/verify-email', verifyEmail);
authRouter.post('/login', login);
authRouter.get('/me', authUser ,getMe);
authRouter.post('/refresh', refreshToken);
authRouter.post('/logout', authUser ,logout);
authRouter.post('/logout-all', authUser  ,logoutAll);
authRouter.post('/googlelogin', googleLogin);

export default authRouter;