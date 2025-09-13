# SensorHub Backend Service

## Features

- **Telemetry Ingestion**: Store device telemetry with idempotency and device status validation
- **Subscription Management**: Handle yearly device subscriptions with payment processing
- **Message Relay**: Forward notifications to external providers with retry logic

## Tech Stack

- **Backend**: Node.js with Fastify
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod schemas
- **Testing**: Jest

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis (optional, for distributed rate limiting)

### Installation

1. Clone the repository

```bash
git clone <repo-url>
cd digivikreta-assignment
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your database and Redis URLs
```

4. Set up the database

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed test data
npm run db:seed
```

### Running the Service

Development mode:

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

The service will be available at `http://localhost:8080`

## API Endpoints

### Health Checks

- `GET /health` - Basic health check

### Telemetry

- `POST /telemetry/ping` - Ingest device telemetry
  - Rate limited: 60 requests/minute
  - Requires active device subscription
  - Idempotent using `eventId`

### Billing

- `POST /billing/subscribe` - Create device subscription
  - Calls mock payment endpoint
  - Creates yearly subscription
  - Activates device

### Relay

- `POST /relay/publish` - Relay messages to external provider
  - Rate limited: 50 requests/minute
  - Requires API key authentication
  - Retry logic with exponential backoff
  - Idempotent using `x-api-key` header
