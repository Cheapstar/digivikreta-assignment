import { FastifyInstance } from "fastify";

export default function MockRoutes(server: FastifyInstance) {
  server.post("/mock-pay/charge", async (req, res) => {
    if (Math.random() < 0.2) {
      res.code(500);
      return { error: "Payment processing temporarily unavailable" };
    }

    return {
      success: true,
      transactionId: crypto.randomUUID(),
      amount: 99.99,
      timestamp: new Date().toISOString(),
    };
  });

  server.post("/mock-relay/receive", async (req, res) => {
    if (Math.random() < 0.1) {
      res.code(503);
      return { error: "Relay service temporarily unavailable" };
    }

    return {
      success: true,
      messageId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };
  });
}
