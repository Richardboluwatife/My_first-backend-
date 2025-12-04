import { Router, Request, Response } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateOTP, sendOTPEmail } from "../otpUtils";
import User from "../models/user"; // Sequelize User model

const router = Router();

interface LoginBody {
    email: string;
    password: string;
}

interface VerifyOtpBody {
    email: string;
    otp: string;
}

// --------------------------
// LOGIN
// --------------------------
router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body as LoginBody;

    try {
        const user = await User.findOne({ where: { email } });

        if (!user) return res.status(404).json({ message: "User not found" });
        if (!user.verified)
            return res.status(403).json({ message: "Account not activated" });

        const valid = await bcryptjs.compare(password, user.password);
        if (!valid) return res.status(401).json({ message: "Invalid password" });

        // Create JWT tokens
        const access = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || "mysecretkey",
            { expiresIn: "1h" }
        );

        const refresh = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET || "myrefreshkey",
            { expiresIn: "7d" }
        );

        res.json({ access, refresh });
    } catch (err: any) {
        res.status(500).json({ message: "Error logging in", error: err.message });
    }
});

// --------------------------
// VERIFY OTP
// --------------------------
router.post("/verify-otp", async (req: Request, res: Response) => {
    const { email, otp } = req.body as VerifyOtpBody;

    try {
        const user = await User.findOne({ where: { email, otp } });

        if (!user) return res.status(400).json({ message: "Invalid OTP" });
        if (user.otp_expires_at && user.otp_expires_at < new Date())
            return res.status(400).json({ message: "OTP expired" });

        await user.update({ verified: true, otp: null, otp_expires_at: null });

        res.json({ message: "Account verified successfully" });
    } catch (error: any) {
        res.status(500).json({ message: "Error verifying OTP", error: error.message });
    }
});

// --------------------------
// RESEND OTP
// --------------------------
router.post("/resend-otp", async (req: Request, res: Response) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ where: { email } });

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.verified)
            return res.status(400).json({ message: "User already verified" });

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        await user.update({ otp, otp_expires_at: otpExpiresAt });
        await sendOTPEmail(email, otp);

        res.json({ message: "New OTP sent" });
    } catch (error: any) {
        res.status(500).json({ message: "Error resending OTP", error: error.message });
    }
});

// --------------------------
// REFRESH TOKEN
// --------------------------
router.post("/refresh", async (req: Request, res: Response) => {
    const { refresh } = req.body;
    if (!refresh) return res.status(401).json({ message: "No refresh token" });

    try {
        const payload = jwt.verify(
            refresh,
            process.env.JWT_REFRESH_SECRET || "myrefreshkey"
        ) as any;

        const access = jwt.sign(
            { id: payload.id },
            process.env.JWT_SECRET || "mysecretkey",
            { expiresIn: "1h" }
        );

        res.json({ access });
    } catch {
        res.status(401).json({ message: "Invalid refresh token" });
    }
});

export default router;