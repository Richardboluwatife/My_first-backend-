import express from "express";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import authRouter from "./authRouter";
import taskRouter from "./taskRouter";
import YAML from "yamljs";
import path from "path";

const app = express();
const PORT = 2000;

// Correct path to swagger.yaml
const swaggerDocument = YAML.load(path.join(__dirname, "docs", "swagger.yaml"));

// CORS
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true);
            callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
    })
);

app.use(express.json());

// Routers
app.use("/auth", authRouter);
app.use("/tasks", taskRouter);

// Swagger Docs
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});