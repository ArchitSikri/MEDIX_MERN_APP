import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRouter from './src/routes/authUser.route.js';
import doctorAuthRouter from './src/routes/doctorAuth.route.js';
import adminRouter from './src/routes/admin.route.js';

const app = express();
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);


app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Origin is not allowed by CORS'));
    },
    credentials: true
}));
app.use('/api/user/auth', authRouter);
app.use('/api/doctor/auth', doctorAuthRouter);
app.use('/api/admin', adminRouter);


export default app;