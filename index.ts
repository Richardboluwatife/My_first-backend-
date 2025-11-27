import express, { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "./db";

const app = express();
const PORT = 2000;

app.use(express.json());


// ------------------------------
// Create new user
// ------------------------------
app.post("/users", async (req: Request, res: Response) => {
    try {
        const allowedFields = ["name", "email", "password"];
        const bodyKeys = Object.keys(req.body);

        const missingFields = allowedFields.filter(key => !bodyKeys.includes(key));
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: "Missing required fields",
                missing_fields: missingFields
            });
        }

        const extraFields = bodyKeys.filter(key => !allowedFields.includes(key));
        if (extraFields.length > 0) {
            return res.status(400).json({
                message: "Invalid fields detected",
                invalid_fields: extraFields
            });
        }

        const { name, email, password } = req.body;

        const hashedPassword = await bcryptjs.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
            [name, email, hashedPassword]
        );

        res.status(201).json({
            message: "User created successfully",
            user: result.rows[0]
        });

    } catch (error: any) {
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
});

app.get("/users", async (req: Request, res: Response) => {
    try {
        const result = await pool.query("SELECT id, name, email FROM users ORDER BY id ASC");
        res.json(result.rows);  

    } catch (error: any) {
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
});

// ------------------------------
// Login
// ------------------------------
app.post("/login", async (req: Request, res: Response) => {
    try {
        const allowedFields = ["email", "password"];
        const bodyKeys = Object.keys(req.body);

        const missingFields = allowedFields.filter(key => !bodyKeys.includes(key));
        if (missingFields.length > 0) {
            return res.status(400).json({
                message: "Missing required fields",
                missing_fields: missingFields
            });
        }

        const { email, password } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE email = $1",
            [email]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isValidPassword = await bcryptjs.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: "Invalid password" });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            "mysecretkey",
            { expiresIn: "1h" }
        );

        res.json({ message: "Login successful", token });

    } catch (error: any) {
        res.status(500).json({ message: "Error logging in", error: error.message });
    }
});


// ------------------------------
// Create a task
// ------------------------------
app.post("/tasks", async (req: Request, res: Response) => {
    try {
        const { title, description, status } = req.body;

        const result = await pool.query(
            `INSERT INTO tasks (title, description, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
            [title, description, status || "pending"]
        );

        res.status(201).json({
            message: "Task created successfully",
            task: result.rows[0],
        });

    } catch (error: any) {
        res.status(500).json({ message: "Error creating task", error: error.message });
    }
});


// ------------------------------
// Get task by ID
// ------------------------------
app.get("/tasks/:id", async (req: Request, res: Response) => {
    try {
        const taskId = Number(req.params.id);

        const result = await pool.query(
            "SELECT * FROM tasks WHERE id = $1",
            [taskId]
        );

        const task = result.rows[0];

        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json(task);

    } catch (error: any) {
        res.status(500).json({ message: "Error getting task", error: error.message });
    }
});


// ------------------------------
// Update task (partial)
// ------------------------------
app.patch("/tasks/:id", async (req: Request, res: Response) => {
    try {
        const taskId = Number(req.params.id);

        const { title, description, status } = req.body;

        const result = await pool.query(
            `UPDATE tasks 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status)
       WHERE id = $4
       RETURNING *`,
            [title, description, status, taskId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json({
            message: "Task updated successfully",
            task: result.rows[0],
        });

    } catch (error: any) {
        res.status(500).json({ message: "Error updating task", error: error.message });
    }
});


// ------------------------------
// Delete task
// ------------------------------
app.delete("/tasks/:id", async (req: Request, res: Response) => {
    try {
        const taskId = Number(req.params.id);

        const result = await pool.query(
            "DELETE FROM tasks WHERE id = $1 RETURNING *",
            [taskId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.json({ message: "Task deleted successfully" });

    } catch (error: any) {
        res.status(500).json({ message: "Error deleting task", error: error.message });
    }
});


// ------------------------------
// Get all tasks
// ------------------------------
app.get("/tasks", async (req: Request, res: Response) => {
    try {
        const result = await pool.query("SELECT * FROM tasks ORDER BY id ASC");
        res.json(result.rows);

    } catch (error: any) {
        res.status(500).json({ message: "Error fetching tasks", error: error.message });
    }
});


// ------------------------------
app.get("/", (req, res) => {
    res.send("Welcome!");
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
