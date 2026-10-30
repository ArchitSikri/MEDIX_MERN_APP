import express from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import authRouter from './src/routes/authUser.route.js';

const app = express();


app.use(express.json());
app.use(morgan("dev"));
app.use(cookieParser());
app.use('/api/user/auth', authRouter);


export default app;