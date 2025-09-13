import { FastifyInstance } from "fastify";
import { logger } from "../../../logger.js";

export default function HealthRoutes(server: FastifyInstance) {
  server.get("/health", (req, res) => {
    logger.info("Incoming Request , Checking Health");

    return {
      message: "EveryNyne is Fine",
    };
  });
}
