import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import authRouter from './src/routes/authUser.route.js';
import doctorAuthRouter from './src/routes/doctorAuth.route.js';
import adminRouter from './src/routes/admin.route.js';

const app = express();


app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use('/api/user/auth', authRouter);
app.use('/api/doctor/auth', doctorAuthRouter);
app.use('/api/admin', adminRouter);


export default app;