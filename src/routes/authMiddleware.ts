// src/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
    id: number;
    email?: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];

    if (!token) return res.status(401).json({ message: "Token missing" });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || "mysecretkey") as JwtPayload;
        (req as any).user = payload;
        next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};