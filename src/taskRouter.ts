import { Router, Request, Response } from "express";
import pool from "./db";

const router = Router();

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks
 *     tags: [Tasks]
 */
router.get("/", async (req, res) => {
    const result = await pool.query("SELECT * FROM tasks ORDER BY id ASC");
    res.json(result.rows);
});

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 */
router.post("/", async (req: Request, res: Response) => {
    const { title, description, status } = req.body;

    const result = await pool.query(
        `INSERT INTO tasks (title, description, status)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [title, description, status || "pending"]
    );

    res.status(201).json({ task: result.rows[0] });
});

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
 */
router.get("/:id", async (req: Request, res: Response) => {
    const taskId = Number(req.params.id);

    const result = await pool.query(
        "SELECT * FROM tasks WHERE id = $1",
        [taskId]
    );

    if (!result.rows[0])
        return res.status(404).json({ message: "Task not found" });

    res.json(result.rows[0]);
});

export default router;
