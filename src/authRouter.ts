import { Router, Request, Response } from "express";
import bcryptjs from "bcryptjs";
import pool from "./db";
import jwt from "jsonwebtoken";
import { generateOTP, sendOTPEmail } from "./otpUtils";
import { authenticateToken } from "./authMiddleware";

const router = Router();

interface LoginBody {
    email: string;
    password: string;
}

interface UserBody {
    name: string;
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

router.get("/users", async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email, verified FROM users ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users" });
    }
});



router.get("/users/me", authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const result = await pool.query(
            "SELECT id, name, email, verified FROM users WHERE id = $1",
            [userId]
        );
        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error: any) {
        res.status(500).json({ message: "Error fetching user", error: error.message });
    }
});

router.post("/users", async (req: Request, res: Response) => {
    try {
        const { email, password, user_type } = req.body;

        if (!["landlord", "tenant"].includes(user_type)) {
            return res.status(400).json({ message: "user_type must be 'landlord' or 'tenant'" });
        }

        // Check if user exists
        const check = await pool.query(
            "SELECT * FROM users WHERE email = $1 AND user_type = $2",
            [email, user_type]
        );

        if (check.rows.length > 0) {
            return res.status(400).json({
                message: `A ${user_type} account with this email already exists`,
            });
        }

        // Hash password
        const hashedPassword = await bcryptjs.hash(password, 10);

        // Generate OTP
        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Insert new user
        const result = await pool.query(
            `INSERT INTO users (email, password, user_type, otp, otp_expires_at, verified)
             VALUES ($1, $2, $3, $4, $5, false)
             RETURNING id, email, user_type`,
            [email, hashedPassword, user_type, otp, otpExpiresAt]
        );

        // Send OTP via email
        try {
            await sendOTPEmail(email, otp);
        } catch (err) {
            console.error("Failed to send OTP email:", err);
        }

        res.status(201).json({
            message: "User created. OTP sent (expires in 5 mins).",
            user: result.rows[0],
        });
    } catch (error: any) {
        console.error(error);
        res.status(500).json({ message: "Error creating user", error: error.message });
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