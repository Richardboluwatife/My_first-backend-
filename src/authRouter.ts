import { Router, Request, Response } from "express";
import bcryptjs from "bcryptjs";
import pool from "./db";
import jwt from "jsonwebtoken";
import { generateOTP, sendOTPEmail } from "./otpUtils";

const router = Router();

interface LoginBody {
    email: string;
    password: string;
}

interface VerifyOtpBody {
    email: string;
    otp: string;
}

router.post("/login", async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: "User not found" });
        if (!user.verified)
            return res.status(403).json({ message: "Account not activated" });

        const valid = await bcryptjs.compare(password, user.password);
        if (!valid) return res.status(401).json({ message: "Invalid password" });

        // Create tokens
        const access = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || "mysecretkey", { expiresIn: "1h" });
        const refresh = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET || "myrefreshkey", { expiresIn: "7d" });

        res.json({ access, refresh });
    } catch (err: any) {
        res.status(500).json({ message: "Error logging in", error: err.message });
    }
});

router.post("/verify-otp", async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1 AND otp = $2",
            [email, otp]
        );

        const user = result.rows[0];
        if (!user) return res.status(400).json({ message: "Invalid OTP" });

        if (user.otp_expires_at < new Date())
            return res.status(400).json({ message: "OTP expired" });

        await pool.query(
            "UPDATE users SET verified = true, otp = NULL, otp_expires_at = NULL WHERE email = $1",
            [email]
        );

        res.json({ message: "Account verified successfully" });
    } catch (error: any) {
        res.status(500).json({ message: "Error verifying OTP", error: error.message });
    }
});


router.post("/resend-otp", async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        const userResult = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        const user = userResult.rows[0];

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.verified)
            return res.status(400).json({ message: "User already verified" });

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await pool.query(
            "UPDATE users SET otp = $1, otp_expires_at = $2 WHERE email = $3",
            [otp, otpExpiresAt, email]
        );

        await sendOTPEmail(email, otp);

        res.json({ message: "New OTP sent" });
    } catch (error: any) {
        res.status(500).json({ message: "Error resending OTP", error: error.message });
    }
});

router.post("/refresh", async (req: Request, res: Response) => {
    const { refresh } = req.body;
    if (!refresh) return res.status(401).json({ message: "No refresh token" });

    try {
        const payload = jwt.verify(refresh, process.env.JWT_REFRESH_SECRET || "myrefreshkey") as any;
        const access = jwt.sign({ id: payload.id }, process.env.JWT_SECRET || "mysecretkey", { expiresIn: "1h" });
        res.json({ access });
    } catch {
        res.status(401).json({ message: "Invalid refresh token" });
    }
});

export default router;