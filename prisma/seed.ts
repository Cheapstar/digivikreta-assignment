import { prisma } from "../src/db/client.js";

async function main() {
  console.log("Seeding database...");

  const device1 = await prisma.device.create({
    data: {
      id: "device-001",
      status: "ACTIVE",
    },
  });

  const device2 = await prisma.device.create({
    data: {
      id: "device-002",
      status: "INACTIVE",
    },
  });

  console.log("Created devices:", { device1: device1.id, device2: device2.id });

  const subscription = await prisma.subscription.create({
    data: {
      deviceId: "device-001",
      planId: "yearly-premium",
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
      status: "ACTIVE",
      providerRef: crypto.randomUUID(),
    },
  });

  console.log("Created subscription:", subscription.id);

  const client = await prisma.client.create({
    data: {
      id: "test-client-001",
      apiKey: "sk-test-12345678901234567890123456789012",
      name: "Test Client",
      status: "ACTIVE",
    },
  });

  console.log("Created client:", {
    clientId: client.id,
    apiKey: client.apiKey,
  });

  await prisma.telemetryRecord.create({
    data: {
      deviceId: "device-001",
      metric: "temperature",
      value: "23.5",
      status: "OK",
      ts: new Date(),
      eventId: crypto.randomUUID(),
    },
  });

  console.log("Created sample telemetry");
  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
