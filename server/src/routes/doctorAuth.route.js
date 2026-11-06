import { Router } from 'express';
import {
    getDoctorMe,
    loginDoctor,
    logoutAllDoctorSessions,
    logoutDoctor,
    refreshDoctorToken,
    registerDoctor,
    verifyDoctorEmail
} from '../controllers/doctorAuth.controller.js';
import { authDoctor } from '../middleware/authMiddleware.js';
import { uploadDoctorDocuments } from '../middleware/multer.middleware.js';
import {
    listDoctorAppointments,
    updateAppointmentStatus
} from '../controllers/appointment.controller.js';

const doctorAuthRouter = Router();

doctorAuthRouter.post('/register', uploadDoctorDocuments, registerDoctor);
doctorAuthRouter.post('/verify-email', verifyDoctorEmail);
doctorAuthRouter.post('/login', loginDoctor);
doctorAuthRouter.post('/refresh', refreshDoctorToken);
doctorAuthRouter.get('/me', authDoctor, getDoctorMe);
doctorAuthRouter.get('/appointments', authDoctor, listDoctorAppointments);
doctorAuthRouter.patch('/appointments/:appointmentId', authDoctor, updateAppointmentStatus);
doctorAuthRouter.post('/logout', authDoctor, logoutDoctor);
doctorAuthRouter.post('/logout-all', authDoctor, logoutAllDoctorSessions);

export default doctorAuthRouter;
