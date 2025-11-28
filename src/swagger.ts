import swaggerJsDoc from "swagger-jsdoc"
/**
 * @swagger
 * components:
 *   schemas:
 *     Rent:
 *       type: object
 *       required:
 *         - title
 *         - author
 *         - published
 *       properties:
 *         title:
 *           type: string
 *           description: Title of the book
 *         author:
 *           type: string
 *           descripton: Name of the author of the book
 *         published:
 *           type: boolean
 *           descripton: If the book is published or not
 *       example:
 *         title: A great book
 *         author: John
 *         published: true
 *     RentUpdate:
 *       type: object
 *       optional:
 *         - title
 *         - author
 *         - published
 *       properties:
 *         title:
 *           type: string
 *           description: Title of the book
 *         author:
 *           type: string
 *           descripton: Name of the author of the book
 *         published:
 *           type: boolean
 *           descripton: If the book is published or not
 *       example:
 *         title: An updated book title
 *         author: A new author
 *         published: true
 *
 * @swagger
 *  tags:
 *    name: RentManagement
 */

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
                    bearerFormat: "JWT", // optional, just for UI hint
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ["src/**/*.ts"], // adjust this to point to your routes
});

export default swaggerSpec;