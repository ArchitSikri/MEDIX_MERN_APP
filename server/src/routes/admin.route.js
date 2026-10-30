import { Router } from 'express';
import {
    approveDoctor,
    blacklistDoctor,
    blacklistUser,
    listPendingDoctors
} from '../controllers/admin.controller.js';
import { authUser, requireAdmin } from '../middleware/authMiddleware.js';

const adminRouter = Router();

adminRouter.get('/doctors/pending', authUser, requireAdmin, listPendingDoctors);
adminRouter.patch('/doctors/:doctorId/approve', authUser, requireAdmin, approveDoctor);
adminRouter.patch('/doctors/:doctorId/blacklist', authUser, requireAdmin, blacklistDoctor);
adminRouter.patch('/users/:userId/blacklist', authUser, requireAdmin, blacklistUser);

export default adminRouter;
