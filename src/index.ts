import express from "express";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import authRouter from "./authRouter";
import userRouter from "./userRouter";
import taskRouter from "./taskRouter";
import YAML from "yamljs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 2000; // Use host-provided port if available

// Swagger
const swaggerDocument = YAML.load(path.join(__dirname, "../src/docs/swagger.yaml"));

// CORS - allow requests from any origin
app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like Postman, server-to-server)
            if (!origin) return callback(null, true);
            // Allow all other origins
            callback(null, true);
        },
        credentials: true, // Needed if you use cookies or Authorization headers
    })
);

app.use(express.json());

// Routers
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/tasks", taskRouter);

// Swagger Docs
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});