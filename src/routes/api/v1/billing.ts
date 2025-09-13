import { FastifyInstance } from "fastify";
import z from "zod";
import { updateDeviceSnapShot } from "../../../lib/utils.js";
import axios from "axios";
import { prisma } from "../../../db/client.js";
import { logger } from "../../../logger.js";
const subscriptionSchema = z.object({
  deviceId: z.string().min(1),
  planId: z.string().min(1),
});

export default function BillingRoutes(server: FastifyInstance) {
  server.post("/subscribe", async (req, res) => {
    try {
      const data = subscriptionSchema.parse(req.body);
      let providerRef = null;

      try {
        const response = await axios.post(
          `${process.env.BASE_URL || "http://localhost:3000"}/mock-pay/charge`,
          {
            deviceId: data.deviceId,
            planId: data.planId,
            amount: 99.99,
          }
        );
        providerRef = response.data.transactionId;
      } catch (error: any) {
        server.log.error({
          requestId: req.headers["x-req-id"],
          error: error.message,
          action: "payment_failed",
          deviceId: data.deviceId,
        });

        res.code(402);
        return {
          error: "Payment processing failed",
          code: "PAYMENT_FAILED",
          requestId: req.headers["x-req-id"],
        };
      }

      // create subscription
      const startDate = new Date();
      const endDate = new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

      const subscription = await prisma.subscription.create({
        data: {
          deviceId: data.deviceId,
          planId: data.planId,
          startDate,
          endDate,
          status: "ACTIVE",
          providerRef: providerRef,
        },
      });

      // update device status to active
      updateDeviceSnapShot(data.deviceId);

      logger.info({
        requestId: req.headers["x-req-id"],
        deviceId: data.deviceId,
        subscriptionId: subscription.id,
        action: "subscription_created",
      });

      return {
        message: "Subscription created successfully",
        subscriptionId: subscription.id,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        requestId: req.headers["x-req-id"],
      };
    } catch (error: any) {
      server.log.error({
        requestId: req.headers["x-req-id"],
        error: error.message,
        action: "subscription_error",
      });

      if (error instanceof z.ZodError) {
        res.code(400);
        return {
          error: "Invalid req data",
          details: error,
          requestId: req.headers["x-req-id"],
        };
      }

      res.code(500);
      return {
        error: "Internal server error",
        requestId: req.headers["x-req-id"],
      };
    }
  });
}
