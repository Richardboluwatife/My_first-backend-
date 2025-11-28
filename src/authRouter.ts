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

/**
 * ------------------------
 * LOGIN
 * ------------------------
 */
/**
 * @swagger
 * /auth/login:
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
        const { email, password } = req.body;

        const userResult = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ message: "User not found" });

        // Check verification
        if (!user.verified) {
            return res.status(403).json({
                message:
                    "Account not activated. Check your email for OTP verification.",
            });
        }

        const validPassword = await bcryptjs.compare(password, user.password);
        if (!validPassword)
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
 * GET USERS
 * ------------------------
 */
/**
 * @swagger
 * /auth/users:
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
            "SELECT id, name, email, verified FROM users ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: "Error fetching users" });
    }
});

/**
 * @swagger
 * /auth/users/me:
 *   get:
 *     summary: Get the current logged-in user details
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 verified:
 *                   type: boolean
 *       401:
 *         description: Unauthorized (missing or invalid token)
 */
router.get("/users/me", authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id; // from token
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

/**
 * ------------------------
 * CREATE USER
 * ------------------------
 */
/**
 * @swagger
 * /auth/users:
 *   post:
 *     summary: Register a new user
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

        const hashedPassword = await bcryptjs.hash(password, 10);

        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const result = await pool.query(
            `INSERT INTO users (name, email, password, otp, otp_expires_at, verified)
         VALUES ($1, $2, $3, $4, $5, false)
         RETURNING id, name, email`,
            [name, email, hashedPassword, otp, otpExpiresAt]
        );

        await sendOTPEmail(email, otp);

        res.status(201).json({
            message: "User created. OTP sent (expires in 5 mins).",
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
 * /auth/verify-otp:
 *   post:
 *     summary: Verify user OTP
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

/**
 * ------------------------
 * RESEND OTP
 * ------------------------
 */
/**
 * @swagger
 * /auth/resend-otp:
 *   post:
 *     summary: Resend OTP
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

export default router;