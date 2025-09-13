import { prisma } from "../db/client.js";
import { logger } from "./logger.js";

export async function isDeviceActive(deviceId: string) {
  let device = await prisma.device.findFirst({
    where: {
      id: deviceId,
    },
    include: {
      subscription: {
        where: {
          status: "ACTIVE",
          endDate: {
            gte: new Date(),
          },
        },
        orderBy: {
          startDate: "desc",
        },
        take: 1,
      },
    },
  });

  return device?.status === "ACTIVE" && device.subscription.length != 0;
}

export async function updateDeviceSnapShot(deviceId: string) {
  await prisma.device.update({
    where: {
      id: deviceId,
    },
    data: {
      updatedAt: new Date(),
      status: "ACTIVE",
    },
  });
}

export async function retryWithBackOff(
  fn: () => Promise<any>,
  maxRetries: number = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Attempt ${attempt}`);
      return await fn();
    } catch (error: any) {
      if (
        attempt === maxRetries ||
        !error.response ||
        error.response.status < 500
      ) {
        throw error;
      }

      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}
