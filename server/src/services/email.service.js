import nodemailer from 'nodemailer';
import config from '../config/config.js';


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: config.GOOGLE_USER,
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        refreshToken: config.GOOGLE_REFRESH_TOKEN
    }
})

const emailConfigured = [
    config.GOOGLE_USER,
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_REFRESH_TOKEN
].every(Boolean);

export const sendEmail = async (to, subject, text, html) => {
    if (!emailConfigured) {
        throw new Error('Google OAuth email settings are missing from the environment');
    }

    const info = await transporter.sendMail({
        from: config.GOOGLE_USER,
        to,
        subject,
        text,
        html,
    });

    console.log('Message sent: %s', info.messageId);
};