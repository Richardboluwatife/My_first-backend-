import dotenv from "dotenv";
dotenv.config(); // MUST come first before anything else

import express from "express";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import authRouter from "./routes/authRouter";
import userRouter from "./routes/userRouter";
// import taskRouter from "./routes/taskRouter";
import YAML from "yamljs";
import path from "path";
import sequelize from "./config/sequelize";

// Load models BEFORE sequelize.sync()
import "./models/user";
import "./models/estate";
import "./models/house";
import "./models/unit";

const app = express();
const PORT = process.env.PORT || 2000;

// Temporary test (REMOVE after verifying)
console.log("DATABASE_URL:", process.env.DATABASE_URL);

// Serve uploaded images
app.use("/uploads", express.static("uploads"));

// Swagger
const swaggerDocument = YAML.load(path.join(__dirname, "../src/docs/swagger.yaml"));

// CORS - allow all origins
app.use(cors({ origin: true, credentials: true }));

app.use(express.json());

// Routers
app.use("/auth", authRouter);
app.use("/users", userRouter);
// app.use("/tasks", taskRouter);

// Swagger UI
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Sync database
sequelize
    .sync({ alter: true })
    .then(() => console.log("Database synced"))
    .catch((err) => console.error("Sync error:", err));

app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`);
});