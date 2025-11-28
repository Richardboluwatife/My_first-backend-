import crypto from "crypto";
import nodemailer from "nodemailer";

/** Generate numeric OTP */
export function generateOTP(length = 6) {
    return crypto.randomInt(0, 10 ** length).toString().padStart(length, "0");
}

/** Send OTP to email */
export async function sendOTPEmail(to: string, otp: string) {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER, // your Gmail
            pass: process.env.EMAIL_PASS, // Gmail App password
        },
    });

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to,
        subject: "Your OTP for registration",
        text: `Your OTP code is: ${otp}\n\nThis OTP will expire in 5 minutes. Please use it before it expires.`,
    };

    await transporter.sendMail(mailOptions);
}