import express, { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import { authenticateToken } from "./authMiddleware";
import { generateOTP, sendOTPEmail } from "../otpUtils";
import User  from "../models/user"; // Your Sequelize User model

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
    params: async (_req, file) => ({
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
router.get("/", async (_req: Request, res: Response) => {
    try {
        const users = await User.findAll({
            attributes: [
                "id",
                "first_name",
                "middle_name",
                "last_name",
                "email",
                "phone_number",
                "personal_house_address",
                "user_image",
                "verified",
                "user_type",
            ],
            order: [["id", "ASC"]],
        });

        res.json(users);
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

        const user = await User.findByPk(userId, {
            attributes: [
                "id",
                "first_name",
                "middle_name",
                "last_name",
                "email",
                "phone_number",
                "personal_house_address",
                "user_image",
                "verified",
                "user_type",
            ],
        });

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

        const existingUser = await User.findOne({ where: { email, user_type } });
        if (existingUser) {
            return res.status(400).json({ message: `A ${user_type} account with this email already exists` });
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);

        const newUser = await User.create({
            email,
            password: hashedPassword,
            user_type,
            otp,
            otp_expires_at: otpExpiresAt,
            verified: false,
        });

        await sendOTPEmail(email, otp).catch(err => console.error("Failed to send OTP email:", err));

        res.status(201).json({
            message: "User created. OTP sent (expires in 5 minutes).",
            user: { id: newUser.id, email: newUser.email, user_type: newUser.user_type },
        });
    } catch (error: any) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
});

// ========================
// Update current logged-in user
// ========================
router.patch("/me", authenticateToken, upload.single("user_image"), async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const { first_name, middle_name, last_name, phone_number, personal_house_address } = req.body;

        const updates: any = {};

        if (first_name) updates.first_name = first_name;
        if (middle_name) updates.middle_name = middle_name;
        if (last_name) updates.last_name = last_name;
        if (phone_number) updates.phone_number = phone_number;
        if (personal_house_address) updates.personal_house_address = personal_house_address;
        if (req.file) updates.user_image = (req.file as any).path;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No fields to update" });
        }

        const [_, [updatedUser]] = await User.update(updates, {
            where: { id: userId },
            returning: true,
        });

        res.json({ message: "User updated", user: updatedUser });
    } catch (error: any) {
        console.error("Update error:", error);
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
});

export default router;