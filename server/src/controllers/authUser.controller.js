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
    const { username, email, password, UPI_Id } = req.body ?? {};
    if (
        typeof username !== 'string' || !username.trim() ||
        typeof email !== 'string' || !email.trim() ||
        typeof password !== 'string' || !password
    ) {
        return res.status(400).json({ message: 'Username, email, and password are required' });
    }
    if (UPI_Id != null && typeof UPI_Id !== 'string') {
        return res.status(400).json({ message: 'UPI ID must be text' });
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
        profilePicture,
        UPI_Id: UPI_Id?.trim() || null
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

function getUserProfilePayload(user) {
    return {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        UPI_Id: user.UPI_Id,
        wallet: Number(user.wallet) || 0
    };
}

function isOwnProfile(req, res) {
    if (req.params.userId !== String(req.user._id)) {
        res.status(403).json({ message: 'You can only access your own profile' });
        return false;
    }

    return true;
}

export async function getUserProfile(req, res) {
    if (!isOwnProfile(req, res)) {
        return;
    }

    return res.status(200).json({
        user: getUserProfilePayload(req.user)
    });
}

export async function updateUserProfile(req, res) {
    if (!isOwnProfile(req, res)) {
        return;
    }

    const username = req.body?.username;
    const upiId = req.body?.UPI_Id;
    if (typeof username !== 'string' || !username.trim()) {
        return res.status(400).json({ message: 'Name is required' });
    }
    if (upiId != null && typeof upiId !== 'string') {
        return res.status(400).json({ message: 'UPI ID must be text' });
    }
    if (typeof upiId === 'string' && upiId.trim().length > 100) {
        return res.status(400).json({ message: 'UPI ID cannot exceed 100 characters' });
    }

    const normalizedUsername = username.trim();
    if (await userModel.exists({ username: normalizedUsername, _id: { $ne: req.user._id } })) {
        return res.status(409).json({ message: 'That name is already in use' });
    }

    let uploadedProfilePicture;
    if (req.file) {
        try {
            uploadedProfilePicture = await uploadFile(
                req.file.buffer,
                getProfilePictureFileName(req.file),
                req.file.mimetype
            );
        } catch (error) {
            console.error('Failed to upload user profile picture:', error);
            return res.status(503).json({
                message: 'Unable to upload profile picture. Check ImageKit configuration and try again.'
            });
        }
    }

    req.user.username = normalizedUsername;
    req.user.UPI_Id = upiId?.trim() || null;
    if (uploadedProfilePicture) {
        req.user.profilePicture = uploadedProfilePicture.url;
    }

    try {
        await req.user.save();
    } catch (error) {
        if (uploadedProfilePicture) {
            await deleteFile(uploadedProfilePicture.fileId);
        }
        if (error.code === 11000) {
            return res.status(409).json({ message: 'That name is already in use' });
        }
        throw error;
    }

    return res.status(200).json({
        message: 'Profile updated successfully',
        user: getUserProfilePayload(req.user)
    });
}

const walletTopupPaise = 200000;

function getRazorpayCredentials(res) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        res.status(503).json({ message: 'Wallet top-up is not configured yet' });
        return null;
    }
    if (!keyId.startsWith('rzp_test_')) {
        res.status(503).json({ message: 'Wallet top-up only supports Razorpay test-mode keys' });
        return null;
    }

    return { keyId, keySecret };
}

async function razorpayRequest(path, { keyId, keySecret, method = 'GET', body } = {}) {
    const response = await fetch(`https://api.razorpay.com/v1${path}`, {
        method,
        headers: {
            Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json();
    if (!response.ok) {
        const error = new Error(result.error?.description || `Razorpay request failed with status ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return result;
}

export async function createWalletTopupOrder(req, res) {
    const credentials = getRazorpayCredentials(res);
    if (!credentials) {
        return;
    }

    try {
        const order = await razorpayRequest('/orders', {
            ...credentials,
            method: 'POST',
            body: {
                amount: walletTopupPaise,
                currency: 'INR',
                receipt: `wallet-${crypto.randomUUID()}`,
                notes: { userId: String(req.user._id) }
            }
        });

        return res.status(201).json({
            keyId: credentials.keyId,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency
        });
    } catch (error) {
        console.error('Failed to create Razorpay wallet order:', error);
        const message = error.status === 401
            ? 'Razorpay rejected the test credentials. Check that the Key ID and Key Secret are a matching test-mode pair in server/.env.'
            : `Unable to start wallet payment: ${error.message || 'Razorpay request failed'}`;
        return res.status(502).json({ message });
    }
}

export async function verifyWalletTopup(req, res) {
    const credentials = getRazorpayCredentials(res);
    if (!credentials) {
        return;
    }

    const { orderId, paymentId, signature } = req.body ?? {};
    if (
        typeof orderId !== 'string' || !orderId ||
        typeof paymentId !== 'string' || !paymentId
    ) {
        return res.status(400).json({ message: 'Razorpay order ID and payment ID are required' });
    }

    if (signature != null) {
        if (typeof signature !== 'string' || !/^[a-f\d]{64}$/i.test(signature)) {
            return res.status(400).json({ message: 'Payment signature is invalid' });
        }

        const expectedSignature = crypto
            .createHmac('sha256', credentials.keySecret)
            .update(`${orderId}|${paymentId}`)
            .digest();
        const providedSignature = Buffer.from(signature, 'hex');
        if (
            expectedSignature.length !== providedSignature.length ||
            !crypto.timingSafeEqual(expectedSignature, providedSignature)
        ) {
            return res.status(400).json({ message: 'Payment signature verification failed' });
        }
    }

    let verificationStep = 'order verification';
    let paymentCaptured = false;
    try {
        const order = await razorpayRequest(`/orders/${encodeURIComponent(orderId)}`, credentials);
        if (
            order.amount !== walletTopupPaise ||
            order.currency !== 'INR' ||
            order.notes?.userId !== String(req.user._id)
        ) {
            return res.status(403).json({ message: 'This payment order does not belong to your account' });
        }

        verificationStep = 'payment verification';
        const payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`, credentials);
        if (
            payment.order_id !== orderId ||
            payment.amount !== walletTopupPaise ||
            payment.currency !== 'INR' ||
            !['authorized', 'captured'].includes(payment.status)
        ) {
            return res.status(400).json({ message: 'Payment does not match this wallet top-up' });
        }

        let capturedPayment = payment;
        if (payment.status !== 'captured') {
            verificationStep = 'payment capture';
            try {
                capturedPayment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, {
                    ...credentials,
                    method: 'POST',
                    body: { amount: walletTopupPaise, currency: 'INR' }
                });
            } catch (captureError) {
                const latestPayment = await razorpayRequest(
                    `/payments/${encodeURIComponent(paymentId)}`,
                    credentials
                );
                if (latestPayment.status !== 'captured') {
                    throw captureError;
                }
                capturedPayment = latestPayment;
            }
        }
        if (
            capturedPayment.status !== 'captured' ||
            capturedPayment.amount !== walletTopupPaise ||
            capturedPayment.currency !== 'INR'
        ) {
            return res.status(402).json({ message: 'Payment has not been captured successfully' });
        }
        paymentCaptured = true;

        verificationStep = 'wallet credit';
        const walletUpdate = await userModel.collection.updateOne(
            { _id: req.user._id, walletPaymentIds: { $ne: paymentId } },
            [{
                $set: {
                    wallet: {
                        $add: [
                            {
                                $convert: {
                                    input: { $ifNull: ['$wallet', 0] },
                                    to: 'double',
                                    onError: 0,
                                    onNull: 0
                                }
                            },
                            walletTopupPaise / 100
                        ]
                    },
                    walletPaymentIds: {
                        $setUnion: [
                            { $ifNull: ['$walletPaymentIds', []] },
                            { $literal: [paymentId] }
                        ]
                    }
                }
            }]
        );

        if (walletUpdate.modifiedCount !== 1) {
            const alreadyCredited = await userModel.exists({
                _id: req.user._id,
                walletPaymentIds: paymentId
            });
            if (!alreadyCredited) {
                return res.status(404).json({ message: 'User account not found' });
            }

            const currentUser = await userModel.findById(req.user._id).select('wallet');
            return res.status(200).json({
                message: 'This payment was already added to your wallet',
                wallet: Number(currentUser?.wallet) || 0
            });
        }

        const user = await userModel.findById(req.user._id).select('wallet');
        if (!user) {
            return res.status(404).json({ message: 'User account not found' });
        }

        return res.status(200).json({
            message: '₹2,000 added to your wallet',
            wallet: Number(user.wallet) || 0
        });
    } catch (error) {
        console.error(`Failed during wallet ${verificationStep}:`, error);
        if (paymentCaptured) {
            console.error('Wallet credit database error:', error);
            return res.status(503).json({
                message: `Razorpay captured payment ${paymentId}, but the wallet database update failed: ${error.message || 'unknown database error'}. Retry verification using the same order ID and payment ID.`
            });
        }
        return res.status(502).json({
            message: `Wallet ${verificationStep} failed: ${error.message || 'Razorpay request failed'}. No wallet credit was made.`
        });
    }
}

export async function getMe(req, res) {
    if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    return res.status(200).json({
        message: "user fetched successfully",
        user: {
            id: req.user._id,
            username: req.user.username,
            email: req.user.email,
            profilePicture: req.user.profilePicture,
            UPI_Id: req.user.UPI_Id,
            wallet: Number(req.user.wallet) || 0,
            rating: req.user.rating
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
            id: user._id,
            username: user.username,
            email: user.email,
            profilePicture: user.profilePicture,
            UPI_Id: user.UPI_Id,
            wallet: Number(user.wallet) || 0
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
            profilePicture: user.profilePicture,
            UPI_Id: user.UPI_Id,
            wallet: Number(user.wallet) || 0
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