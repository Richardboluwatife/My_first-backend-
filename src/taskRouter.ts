import { Router, Request, Response } from "express";
import pool from "./db";

const router = Router();


router.get("/", async (req, res) => {
    const result = await pool.query("SELECT * FROM tasks ORDER BY id ASC");
    res.json(result.rows);
});


// router.post("/", async (req: Request, res: Response) => {
//     const { title, description, status } = req.body;

//     const result = await pool.query(
//         `INSERT INTO tasks (title, description, status)
//          VALUES ($1, $2, $3)
//          RETURNING *`,
//         [title, description, status || "pending"]
//     );

//     res.status(201).json({ task: result.rows[0] });
// });


// router.get("/:id", async (req: Request, res: Response) => {
//     const taskId = Number(req.params.id);

//     const result = await pool.query(
//         "SELECT * FROM tasks WHERE id = $1",
//         [taskId]
//     );

//     if (!result.rows[0])
//         return res.status(404).json({ message: "Task not found" });

//     res.json(result.rows[0]);
// });

export default router;
