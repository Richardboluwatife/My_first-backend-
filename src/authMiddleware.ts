// src/authMiddleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
    id: number;
    email: string;
}

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer token

    if (!token) return res.status(401).json({ message: "Token missing" });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || "mysecretkey") as JwtPayload;
        (req as any).user = payload; // attach payload to request
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
};