import { FastifyInstance } from "fastify";
import { logger } from "../../../lib/logger.js";
import { prisma } from "../../../db/client.js";

export default async function HealthRoutes(server: FastifyInstance) {
  server.get("/health", async (req, res) => {
    logger.info("Incoming Request , Checking Health");

    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "Ok", timestamp: new Date().toISOString() };
    } catch (error) {
      res.code(503);
      return { status: "Error", error: "Database connection failed" };
    }
  });
}
