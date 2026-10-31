import { Router } from 'express';
import {
    approveDoctor,
    blacklistDoctor,
    blacklistUser,
    listPendingDoctors,
    loginAdmin,
    registerAdmin,
    refreshAdminToken,
    logoutAdmin
} from '../controllers/admin.controller.js';
import { authAdmin } from '../middleware/authMiddleware.js';

const adminRouter = Router();

adminRouter.post('/register', registerAdmin);
adminRouter.post('/login', loginAdmin);
adminRouter.post('/refresh', refreshAdminToken);
adminRouter.post('/logout', authAdmin, logoutAdmin);
adminRouter.get('/doctors/pending', authAdmin, listPendingDoctors);
adminRouter.patch('/doctors/:doctorId/approve', authAdmin, approveDoctor);
adminRouter.patch('/doctors/:doctorId/blacklist', authAdmin, blacklistDoctor);
adminRouter.patch('/users/:userId/blacklist', authAdmin, blacklistUser);

export default adminRouter;
