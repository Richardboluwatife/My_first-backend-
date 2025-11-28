import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./swagger";

import authRouter from "./authRouter";
import taskRouter from "./taskRouter";

const app = express();
const PORT = 2000;

app.use(express.json());

// Routers
app.use("/", authRouter);
app.use("/tasks", taskRouter);

// Swagger Docs
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
