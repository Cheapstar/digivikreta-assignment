import { FastifyInstance } from "fastify";
import z from "zod";
import { isDeviceActive, updateDeviceSnapShot } from "../../../lib/utils.js";
import { prisma } from "../../../db/client.js";
import { logger } from "../../../logger.js";

const pingSchema = z.object({
  deviceId: z.string().min(1),
  metric: z.string().min(1),
  value: z.string(),
  status: z.enum(["OK", "ERROR", "DOWN", "WARN"]),
  ts: z.string(),
  eventId: z.string(),
});

export default async function TelemetryRoutes(server: FastifyInstance) {
  server.post("/ping", async (req, res) => {
    try {
      const data = pingSchema.parse(req.body);

      // check if the device is active
      const deviceActive = isDeviceActive(data.deviceId);
      if (!deviceActive) {
        res.code(403);
        return {
          error: "Device is not active",
          code: "DEVICE_INACTIVE",
          requestId: req.headers["x-request-id"],
        };
      }

      const existingTelemetry = await prisma.telemetryRecord.findFirst({
        where: {
          eventId: data.eventId,
        },
      });

      if (existingTelemetry) {
        return {
          message: "Telemetry already processed",
          telemetryId: existingTelemetry.id,
          requestId: req.headers["x-request-id"],
        };
      }

      const newTelemetry = await prisma.telemetryRecord.create({
        data: {
          deviceId: data.deviceId,
          metric: data.metric,
          value: data.value,
          status: data.status,
          ts: new Date(data.ts),
          eventId: data.eventId,
        },
      });

      await updateDeviceSnapShot(data.deviceId);
      logger.info({
        requestId: req.headers["x-request-id"],
        deviceId: data.deviceId,
        eventId: data.eventId,
        action: "telemetry_stored",
      });
      return {
        message: "Telemetry processed Successfully",
        telemetryId: newTelemetry.id,
        requestId: req.headers["x-request-id"],
      };
    } catch (error: any) {
      logger.error({
        requestId: req.headers["x-request-id"],
        error: error.message,
        action: "telemetry_error",
      });

      if (error instanceof z.ZodError) {
        res.code(400);
        return {
          error: "Invalid request data",
          details: error,
          requestId: req.headers["x-request-id"],
        };
      }

      res.code(500);
      return {
        error: "Internal server error",
        requestId: req.headers["x-request-id"],
      };
    }
  });
}
