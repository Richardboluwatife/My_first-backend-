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

interface UserBody {
    name: string;
    email: string;
    password: string;
}

interface VerifyOtpBody {
    email: string;
    otp: string;
}

/**
 * ------------------------
 * LOGIN
 * ------------------------
 */
/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid password
 *       404:
 *         description: User not found
 */
router.post("/login", async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body as LoginBody;

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        const user = result.rows[0];
        if (!user)
            return res.status(404).json({ message: "User not found" });

        // Check if the account is verified
        if (!user.verified) {
            return res.status(403).json({
                message: "Account not activated. Please check your email for the OTP to activate your account."
            });
        }

        const isValid = await bcryptjs.compare(password, user.password);
        if (!isValid)
            return res.status(401).json({ message: "Invalid password" });

        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || "mysecretkey",
            { expiresIn: "1h" }
        );

        res.json({ message: "Login successful", token });
    } catch (error: any) {
        res.status(500).json({ message: "Error logging in", error: error.message });
    }
});

/**
 * ------------------------
 * GET ALL USERS
 * ------------------------
 */
/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get("/users", async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            "SELECT id, name, email FROM users ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ message: "Error fetching users" });
    }
});

/**
 * ------------------------
 * CREATE USER
 * ------------------------
 */
/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
 */

router.post("/users", async (req: Request, res: Response) => {
    try {
        const { name, email, password } = req.body;

        // Hash password
        const hashed = await bcryptjs.hash(password, 10);

        // Generate OTP
        const otp = generateOTP();

        // Set expiry 5 minutes from now
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Save user with OTP and expiry
        const result = await pool.query(
            `INSERT INTO users (name, email, password, otp, otp_expires_at, verified)
             VALUES ($1, $2, $3, $4, $5, false)
             RETURNING id, name, email`,
            [name, email, hashed, otp, otpExpiresAt]
        );

        // Send OTP via email
        await sendOTPEmail(email, otp);

        res.status(201).json({
            message: "User created. Check email for OTP verification (expires in 5 min)",
            user: result.rows[0],
        });
    } catch (error: any) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
});

/**
 * ------------------------
 * VERIFY OTP
 * ------------------------
 */
/**
 * @swagger
 * /verify-otp:
 *   post:
 *     summary: Verify user account with OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Account verified successfully
 *       400:
 *         description: Invalid OTP
 */
router.post("/verify-otp", async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1 AND otp = $2",
            [email, otp]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        // Check if OTP expired
        const now = new Date();
        if (user.otp_expires_at < now) {
            return res.status(400).json({ message: "OTP expired. Please request a new one." });
        }

        // Mark user as verified and clear OTP
        await pool.query(
            "UPDATE users SET verified = true, otp = NULL, otp_expires_at = NULL WHERE email = $1",
            [email]
        );

        res.json({ message: "Account verified successfully" });
    } catch (error: any) {
        res.status(500).json({ message: "Error verifying OTP", error: error.message });
    }
});

/**
 * ------------------------
 * RESEND OTP
 * ------------------------
 */
/**
 * @swagger
 * /resend-otp:
 *   post:
 *     summary: Resend OTP to user email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: New OTP sent successfully
 *       400:
 *         description: User already verified
 *       404:
 *         description: User not found
 */
router.post("/resend-otp", async (req: Request, res: Response) => {
    try {
        const { email } = req.body;

        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        const user = result.rows[0];

        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.verified) return res.status(400).json({ message: "User already verified" });

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await pool.query(
            "UPDATE users SET otp = $1, otp_expires_at = $2 WHERE email = $3",
            [otp, otpExpiresAt, email]
        );

        await sendOTPEmail(email, otp);

        res.json({ message: "New OTP sent to email (expires in 5 min)" });
    } catch (error: any) {
        res.status(500).json({ message: "Error resending OTP", error: error.message });
    }
});

export default router;