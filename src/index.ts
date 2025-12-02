import express from "express";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import authRouter from "./authRouter";
import userRouter from "./userRouter";
import taskRouter from "./taskRouter";
import YAML from "yamljs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 2000;

// Serve uploaded images
app.use("/uploads", express.static("uploads"));

// Swagger
const swaggerDocument = YAML.load(path.join(__dirname, "../src/docs/swagger.yaml"));

// CORS - allow all origins dynamically
app.use(cors({ origin: true, credentials: true }));

app.use(express.json());

// Routers
app.use("/auth", authRouter);
app.use("/users", userRouter);
app.use("/tasks", taskRouter);

// Swagger UI
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
});