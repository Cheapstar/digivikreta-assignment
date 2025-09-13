import { FastifyInstance } from "fastify";
import { prisma } from "../../../db/client.js";
import axios from "axios";
import { retryWithBackOff } from "../../../lib/utils.js";
import { logger } from "../../../logger.js";
import z from "zod";

const relaySchema = z.object({
  clientId: z.string().min(1),
  message: z.string().min(1),
  meta: z.record(z.any(), z.any()).optional(),
});

export default async function RelayRoutes(server: FastifyInstance) {
  server.post("/publish", async (req, res) => {
    try {
      const apiKey = req.headers["x-api-key"] as string;
      if (!apiKey) {
        res.code(401);
        return {
          error: "API key required",
          code: "MISSING_API_KEY",
          reqId: req.headers["x-req-id"],
        };
      }

      const client = await prisma.client.findUnique({
        where: { apiKey },
      });

      if (!client || client.status !== "ACTIVE") {
        res.code(401);
        return {
          error: "Invalid or inactive API key",
          code: "INVALID_API_KEY",
          reqId: req.headers["x-req-id"],
        };
      }

      const data = relaySchema.parse(req.body);
      const idempotencyKey =
        (req.headers["x-idempotency-key"] as string) || crypto.randomUUID();

      // Check for idempotency
      const existingLog = await prisma.relayLog.findUnique({
        where: { idempotencyKey },
      });

      if (existingLog) {
        return {
          message: "Message already processed",
          relayId: existingLog.id,
          status: existingLog.status,
          reqId: req.headers["x-req-id"],
        };
      }

      // Create relay log
      const relayLog = await prisma.relayLog.create({
        data: {
          clientId: client.id,
          message: data.message,
          meta: data.meta || {},
          idempotencyKey,
          status: "PENDING",
        },
      });

      try {
        await retryWithBackOff(async () => {
          const response = await axios.post(
            `${
              process.env.BASE_URL || "http://localhost:3000"
            }/mock-relay/receive`,
            {
              clientId: data.clientId,
              message: data.message,
              meta: data.meta,
              idempotencyKey,
            },
            {
              timeout: 5000,
            }
          );
          return response.data;
        });

        await prisma.relayLog.update({
          where: { id: relayLog.id },
          data: { status: "SENT", lastAttempt: new Date() },
        });

        logger.info({
          reqId: req.headers["x-req-id"],
          relayId: relayLog.id,
          clientId: data.clientId,
          action: "relay_sent",
        });

        return {
          message: "Message relayed successfully",
          relayId: relayLog.id,
          reqId: req.headers["x-req-id"],
        };
      } catch (error: any) {
        await prisma.relayLog.update({
          where: { id: relayLog.id },
          data: { status: "FAILED", lastAttempt: new Date() },
        });

        logger.error({
          reqId: req.headers["x-req-id"],
          relayId: relayLog.id,
          error: error.message,
          action: "relay_failed",
        });

        res.code(502);
        return {
          error: "Failed to relay message",
          code: "RELAY_FAILED",
          relayId: relayLog.id,
          reqId: req.headers["x-req-id"],
        };
      }
    } catch (error: any) {
      logger.error({
        reqId: req.headers["x-req-id"],
        error: error.message,
        action: "relay_error",
      });

      if (error instanceof z.ZodError) {
        res.code(400);
        return {
          error: "Invalid req data",
          details: error,
          reqId: req.headers["x-req-id"],
        };
      }

      res.code(500);
      return {
        error: "Internal server error",
        reqId: req.headers["x-req-id"],
      };
    }
  });
}
