import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";
import cors from "cors";
import authRouter from "./authRouter";
import taskRouter from "./taskRouter";

const app = express();
const PORT = 2000;

// -------------------------------
// CORS setup
// -------------------------------
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // allow requests with no origin (Postman, curl)
        if (/^http:\/\/localhost:\d+$/.test(origin)) return callback(null, true); // allow any localhost port
        callback(new Error("Not allowed by CORS")); // block other origins
    },
    credentials: true,
}));

app.use(express.json());

// Routers
app.use("/", authRouter);
app.use("/tasks", taskRouter);

// Swagger Docs
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
