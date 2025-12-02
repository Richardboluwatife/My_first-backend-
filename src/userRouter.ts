import express, { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { authenticateToken } from "./authMiddleware";
import pool from "./db";
import { generateOTP, sendOTPEmail } from "./otpUtils";

// Cloudinary + Multer
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";

// --------------------
// Cloudinary Config
// --------------------
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// --------------------
// Multer Storage (Cloudinary)
// --------------------
const storage = new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => ({
        folder: "user_profiles",
        allowed_formats: ["jpg", "jpeg", "png"],
        public_id: `${Date.now()}-${file.originalname}`,
    }),
});

const upload = multer({ storage });

// --------------------
// Router
// --------------------
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
            return res.status(400).json({
                message: "Email, password, and user_type are required",
            });
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

        const hashedPassword = await bcryptjs.hash(password, 10);
        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const result = await pool.query(
            `INSERT INTO users (email, password, user_type, otp, otp_expires_at, verified)
             VALUES ($1, $2, $3, $4, $5, false)
             RETURNING id, email, user_type`,
            [email, hashedPassword, user_type, otp, otpExpiresAt]
        );

        // Send OTP email
        sendOTPEmail(email, otp).catch(err =>
            console.error("Failed to send OTP email:", err)
        );

        res.status(201).json({
            message: "User created. OTP sent (expires in 5 minutes).",
            user: result.rows[0],
        });
    } catch (error: any) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
});

// ========================
// Update current logged-in user
// ========================
router.patch(
    "/me",
    authenticateToken,
    upload.single("user_image"), // Cloudinary image
    async (req: Request, res: Response) => {
        try {
            const userId = (req as any).user.id;

            const {
                first_name,
                middle_name,
                last_name,
                phone_number,
                personal_house_address,
            } = req.body;

            const updates: string[] = [];
            const values: any[] = [];
            let i = 1;

            if (first_name) { updates.push(`first_name = $${i++}`); values.push(first_name); }
            if (middle_name) { updates.push(`middle_name = $${i++}`); values.push(middle_name); }
            if (last_name) { updates.push(`last_name = $${i++}`); values.push(last_name); }
            if (phone_number) { updates.push(`phone_number = $${i++}`); values.push(phone_number); }
            if (personal_house_address) {
                updates.push(`personal_house_address = $${i++}`);
                values.push(personal_house_address);
            }

            // Cloudinary Image Upload
            if (req.file) {
                updates.push(`user_image = $${i++}`);
                values.push((req.file as any).path); // Cloudinary returns a URL here
            }

            if (updates.length === 0) {
                return res.status(400).json({ message: "No fields to update" });
            }

            values.push(userId);

            const sql = `
                UPDATE users
                SET ${updates.join(", ")}
                WHERE id = $${i}
                RETURNING *
            `;

            const result = await pool.query(sql, values);

            res.json({
                message: "User updated",
                user: result.rows[0],
            });

        } catch (error: any) {
            console.error("Update error:", error);
            res.status(500).json({ message: "Error updating user", error: error.message });
        }
    }
);

export default router;