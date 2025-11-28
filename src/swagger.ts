import swaggerJsDoc from "swagger-jsdoc";

const swaggerSpec = swaggerJsDoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "RentManagement API",
            version: "1.0.0",
            description: "A CRUD Rent project",
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT", // optional, just for Swagger UI hint
                },
            },
        },
        // Apply bearerAuth globally (optional, you can also define per-route)
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ["src/**/*.ts"], // adjust this path to your routes
});

export default swaggerSpec;