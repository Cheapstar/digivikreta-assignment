import { FastifyInstance } from "fastify";

export default function HealthRoutes(server: FastifyInstance) {
  server.get("/health", (req, res) => {
    return {
      message: "EveryNyne is Fine",
    };
  });
}
