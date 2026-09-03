import type { Express } from "express";
import swaggerUi from "swagger-ui-express";

export function setupSwagger(app: Express) {
  const doc = {
    openapi: "3.0.0",
    info: {
      title: "CakeConnect API",
      version: "1.0.0",
      description:
        "Franchise ordering and operations platform for a cake-shop network.",
    },
    servers: [{ url: "/api/v1" }],
    tags: [
      { name: "Auth" },
      { name: "Users" },
      { name: "Shops" },
      { name: "Categories" },
      { name: "Products" },
      { name: "Price Lists" },
      { name: "Orders" },
      { name: "Cutoff" },
      { name: "Production" },
      { name: "Deliveries" },
      { name: "Invoices" },
      { name: "Payments" },
      { name: "Ledger" },
      { name: "Offers" },
      { name: "Notifications" },
      { name: "Dashboard" },
      { name: "Reports" },
      { name: "Audit Logs" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            message: { type: "string" },
            data: {},
          },
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string" },
            errors: { type: "array", items: {} },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  };

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(doc, {
    customSiteTitle: "CakeConnect API Docs",
  }));
}
