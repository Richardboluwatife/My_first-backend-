import express, { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { authenticateToken } from "./authMiddleware";
import pool from "./db";
import { generateOTP, sendOTPEmail } from "./otpUtils";

const router = express.Router();

// ========================
// Get all users
// ========================
router.get("/", async (req: Request, res: Response) => {
    try {
        const result = await pool.query(
            "SELECT id, first_name, middle_name, last_name, phone_number, personal_house_address, user_image, verified, user_type FROM users ORDER BY id ASC"
        );
        res.json(result.rows);
    } catch (error: any) {
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
});

// ========================
// Get current logged-in user
// ========================
router.get("/me", authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const result = await pool.query(
            "SELECT id, first_name, middle_name, last_name, phone_number, personal_house_address, user_image, verified, user_type FROM users WHERE id = $1",
            [userId]
        );

        const user = result.rows[0];
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user);
    } catch (error: any) {
        res.status(500).json({ message: "Error fetching user", error: error.message });
    }
});

// ========================
// Register a new user
// ========================
router.post("/", async (req: Request, res: Response) => {
    try {
        const { email, password, user_type } = req.body;

        if (!email || !password || !user_type) {
            return res.status(400).json({ message: "Email, password, and user_type are required" });
        }

        if (!["landlord", "tenant"].includes(user_type)) {
            return res.status(400).json({ message: "user_type must be 'landlord' or 'tenant'" });
        }

        // Check if user exists
        const check = await pool.query(
            "SELECT id FROM users WHERE email = $1 AND user_type = $2",
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
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        // Insert user
        const result = await pool.query(
            `INSERT INTO users (email, password, user_type, otp, otp_expires_at, verified)
       VALUES ($1, $2, $3, $4, $5, false)
       RETURNING id, email, user_type`,
            [email, hashedPassword, user_type, otp, otpExpiresAt]
        );

        // Send OTP email (non-blocking)
        sendOTPEmail(email, otp).catch(err => console.error("Failed to send OTP email:", err));

        res.status(201).json({
            message: "User created. OTP sent (expires in 5 mins).",
            user: result.rows[0],
        });
    } catch (error: any) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
});

// ========================
// Update current logged-in user
// ========================
router.patch("/me", authenticateToken, async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const {
            first_name,
            middle_name,
            last_name,
            phone_number,
            personal_house_address,
            user_image,
        } = req.body;

        const updates: string[] = [];
        const values: any[] = [];
        let idx = 1;

        if (first_name) { updates.push(`first_name = $${idx++}`); values.push(first_name); }
        if (middle_name) { updates.push(`middle_name = $${idx++}`); values.push(middle_name); }
        if (last_name) { updates.push(`last_name = $${idx++}`); values.push(last_name); }
        if (phone_number) { updates.push(`phone_number = $${idx++}`); values.push(phone_number); }
        if (personal_house_address) { updates.push(`personal_house_address = $${idx++}`); values.push(personal_house_address); }
        if (user_image) { updates.push(`user_image = $${idx++}`); values.push(user_image); }

        if (updates.length === 0) return res.status(400).json({ message: "No fields to update" });

        values.push(userId);

        const query = `
          UPDATE users
          SET ${updates.join(", ")}
          WHERE id = $${idx}
          RETURNING id, first_name, middle_name, last_name, phone_number, personal_house_address, user_image, verified, user_type
        `;

        const result = await pool.query(query, values);

        res.json({ message: "User updated", user: result.rows[0] });
    } catch (error: any) {
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
});

export default router;