import userModel from '../models/user.model.js';
import sessionModel from '../models/sessionn.model.js';
import BlacklistToken from '../models/blacklistToken.model.js';
import BlacklistedAccount from '../models/blacklistedAccount.model.js';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';
import crypto from 'crypto';
import { sendEmail } from '../services/email.service.js';
import otpModel from '../models/otp.model.js';
import { generateOtp, getOtpHtml } from '../utils/utils.js';
import { OAuth2Client } from 'google-auth-library';
import { deleteFile, uploadFile } from '../services/imagekit.service.js';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(googleClientId);
const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/user/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000
};

function getProfilePictureFileName(file) {
    const extension = file.originalname.match(/\.[a-zA-Z0-9]+$/)?.[0].toLowerCase() || '.jpg';
    return `user-profile-${crypto.randomUUID()}${extension}`;
}

export async function registerUser(req, res) {
    const { username, email, password } = req.body ?? {};
    if (
        typeof username !== 'string' || !username.trim() ||
        typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || !password
    ) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    const existingUser = await userModel.findOne({
        $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });
    if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
    }

    let profilePicture = '';
    let uploadedProfilePicture;
    if (req.file) {
        try {
            uploadedProfilePicture = await uploadFile(
                req.file.buffer,
                getProfilePictureFileName(req.file),
                req.file.mimetype
            );
            profilePicture = uploadedProfilePicture.url;
        } catch (error) {
            console.error('Failed to upload user profile picture:', error);
            return res.status(503).json({
                message: 'Unable to upload profile picture. Check ImageKit configuration and try again.'
            });
        }
    }

    const hashedPassword = await crypto.createHash('sha256').update(password).digest('hex');
    const newUser = new userModel({
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        profilePicture
    });
    const otp = generateOtp();
    const html = getOtpHtml(otp);
    try {
        await newUser.save();
        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
        await otpModel.create({
            email: normalizedEmail,
            user: newUser._id,
            otpHash
        });
    } catch (error) {
        if (!newUser.isNew) {
            await otpModel.deleteMany({ user: newUser._id });
            await userModel.findByIdAndDelete(newUser._id);
        }
        if (uploadedProfilePicture) {
            await deleteFile(uploadedProfilePicture.fileId);
        }
        throw error;
    }

    try {
        await sendEmail(normalizedEmail, "OTP Verification", `Your OTP code is ${otp}`, html);
    } catch (error) {
        await otpModel.deleteMany({ user: newUser._id });
        await userModel.findByIdAndDelete(newUser._id);
        if (uploadedProfilePicture) {
            await deleteFile(uploadedProfilePicture.fileId);
        }
        console.error('Failed to send verification email:', error);
        return res.status(503).json({ message: 'Unable to send verification email. Check the email configuration and try again.' });
    }

    return res.status(201).json({
        message: "User registered successfully",
        user: {
            username: newUser.username,
            email: newUser.email,
            profilePicture: newUser.profilePicture,
            verified: newUser.verified
        },
    })
};

export async function updateProfilePicture(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!req.file) {
        return res.status(400).json({ message: 'Profile picture file is required' });
    }

    const uploadedProfilePicture = await uploadFile(
        req.file.buffer,
        getProfilePictureFileName(req.file),
        req.file.mimetype
    );
    req.user.profilePicture = uploadedProfilePicture.url;

    try {
        await req.user.save();
    } catch (error) {
        await deleteFile(uploadedProfilePicture.fileId);
        throw error;
    }

    return res.status(200).json({
        message: 'Profile picture updated successfully',
        profilePicture: req.user.profilePicture
    });
}

export async function getMe(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    return res.status(200).json({
        message: "user fetched successfully",
        user: {
            username: req.user.username,
            email: req.user.email,
            profilePicture: req.user.profilePicture,
            rating : req.user.rating
        }
    })
};

export async function refreshToken(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token not found" });
    }
    let decoded;
    try {
        decoded = jwt.verify(refreshToken, config.JWT_SECRET);
    } catch {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
    const userId = decoded._id ?? decoded.id;
    if (typeof userId !== 'string') {
        return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await sessionModel.findOne({
        refreshTokenHash,
        user: userId,
        revoked: false
    });
    if (!session) {
        return res.status(401).json({ message: "Session not found" });
    }

    const user = await userModel.findById(userId);
    if (
        !user ||
        !user.active ||
        await BlacklistedAccount.exists({ accountType: 'user', accountId: userId })
    ) {
        return res.status(403).json({ message: 'User account is inactive' });
    }

    const newRefreshToken = jwt.sign({ _id: userId }, config.JWT_SECRET, { expiresIn: '7d' });
    session.refreshTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await session.save();
    const accessToken = jwt.sign(
        { _id: userId, sessionId: session._id },
        config.JWT_SECRET,
        { expiresIn: '15m' }
    );
    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

    return res.status(200).json({ message: "Access token refreshed successfully", accessToken });
};

export async function logout(req, res) {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ message: "Refresh token not found" });
    }
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await sessionModel.findOne({
        refreshTokenHash,
        user: req.user._id,
        revoked: false
    });
    if (!session) {
        return res.status(401).json({ message: "Session not found" });
    }
    session.revoked = true;
    await session.save();
    res.clearCookie('refreshToken', refreshCookieOptions);
    return res.status(200).json({ message: "Logged out successfully" });
};

export async function logoutAll(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    await sessionModel.updateMany({
        user: req.user._id,
        revoked: false
    }, {
        revoked: true
    })

    res.clearCookie("refreshToken", refreshCookieOptions)

    return res.status(200).json({
        message: "Logged out from all devices successfully"
    })

};

export async function login(req, res) {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim() || typeof password !== 'string' || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await userModel.findOne({ email: email.trim().toLowerCase() })

    if (!user) {
        return res.status(401).json({
            message: "Invalid email or password"
        })
    }

    if (
        !user.active ||
        await BlacklistedAccount.exists({ accountType: 'user', accountId: user._id })
    ) {
        return res.status(403).json({ message: 'User account is inactive' });
    }

    if (!user.verified) {
        return res.status(401).json({
            message: "Email not verified"
        })
    }

    const hashedPassword = crypto.createHash("sha256").update(password).digest("hex");

    const isPasswordValid = hashedPassword === user.password;

    if (!isPasswordValid) {
        return res.status(401).json({
            message: "Invalid email or password"
        })
    }

    const refreshToken = jwt.sign({
        _id: user._id
    }, config.JWT_SECRET,
        {
            expiresIn: "7d"
        }
    )

    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");

    const session = await sessionModel.create({
        user: user._id,
        refreshTokenHash,
        ip: req.ip,
        userAgent: req.headers["user-agent"] || 'unknown'
    })

    const accessToken = jwt.sign({
        _id: user._id,
        sessionId: session._id
    }, config.JWT_SECRET,
        {
            expiresIn: "15m"
        }
    )

    res.cookie("refreshToken", refreshToken, refreshCookieOptions)

    res.status(200).json({
        message: "Logged in successfully",
        user: {
            username: user.username,
            email: user.email,
        },
        accessToken,
    })
};

export async function verifyEmail(req, res) {
    const { otp, email } = req.body ?? {};
    if (typeof otp !== 'string' || typeof email !== 'string' || !otp || !email.trim()) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    const otpDoc = await otpModel.findOne({
        email: email.trim().toLowerCase(),
        otpHash,
        user: { $exists: true }
    })

    if (!otpDoc) {
        return res.status(400).json({
            message: "Invalid OTP"
        })
    }

    const user = await userModel.findByIdAndUpdate(
        otpDoc.user,
        { verified: true },
        { new: true }
    );
    if (!user) {
        await otpModel.deleteMany({ user: otpDoc.user });
        return res.status(404).json({ message: 'User not found' });
    }

    await otpModel.deleteMany({
        user: otpDoc.user
    })

    return res.status(200).json({
        message: "Email verified successfully",
        user: {
            username: user.username,
            email: user.email,
            verified: user.verified
        }
    })
};


export async function googleLogin(req, res) {
    if (!googleClientId) {
        return res.status(503).json({ message: 'Google login is not configured' });
    }

    const { credential } = req.body ?? {};
    if (typeof credential !== 'string' || !credential) {
        return res.status(400).json({ message: 'Google credential is required' });
    }

    let payload;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: googleClientId
        });
        payload = ticket.getPayload();
    } catch {
        return res.status(401).json({ message: 'Google login failed' });
    }

    if (!payload?.sub || !payload.email || !payload.email_verified) {
        return res.status(401).json({ message: 'Google account verification failed' });
    }

    let user = await userModel.findOne({ googleId: payload.sub });
    if (!user) {
        const email = payload.email.trim().toLowerCase();
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({
                message: 'This email already belongs to another account.'
            });
        }

        const baseUsername = (email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user').slice(0, 25);
        let username = baseUsername;
        let suffix = 1;
        while (await userModel.exists({ username })) {
            username = `${baseUsername}${suffix++}`;
        }

        user = await userModel.create({
            googleId: payload.sub,
            username,
            email,
            verified: true,
            profilePicture: payload.picture || ''
        });
    }

    if (
        !user.active ||
        await BlacklistedAccount.exists({ accountType: 'user', accountId: user._id })
    ) {
        return res.status(403).json({ message: 'User account is inactive' });
    }

    const refreshToken = jwt.sign({ _id: user._id }, config.JWT_SECRET, { expiresIn: '7d' });
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await sessionModel.create({
        user: user._id,
        refreshTokenHash,
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown'
    });
    const accessToken = jwt.sign(
        { _id: user._id, sessionId: session._id },
        config.JWT_SECRET,
        { expiresIn: '15m' }
    );

    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    return res.status(200).json({
        message: 'Google login successful',
        accessToken,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture
        }
    });
};

export async function toggleActive(req, res) {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const authorization = req.headers.authorization?.trim().split(/\s+/);
    const token = authorization?.[1];
    if (
        authorization?.[0]?.toLowerCase() !== 'bearer' ||
        !token ||
        authorization.length !== 2
    ) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    user.active = !user.active;
    await user.save();
    await BlacklistToken.create({ email: user.email, token });

    return res.status(200).json({
        message: `Account ${user.active ? 'activated' : 'deactivated'} successfully`,
        active: user.active
    });
}