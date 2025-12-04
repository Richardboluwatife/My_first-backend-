// import { Router, Request, Response } from "express";
// import Task from "../models/estate"; // Sequelize model
// import sequelize from "../config/sequelize";

// const router = Router();

// // Get all tasks
// router.get("/", async (req: Request, res: Response) => {
//     try {
//         const tasks = await Task.findAll({ order: [["id", "ASC"]] });
//         res.json(tasks);
//     } catch (error: any) {
//         console.error("Error fetching tasks:", error);
//         res.status(500).json({ message: "Error fetching tasks", error: error.message });
//     }
// });

// export default router;