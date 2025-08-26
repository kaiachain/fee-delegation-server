# Fee Delegation Server

A combined Next.js and Node.js application for managing fee delegation with authentication and API endpoints.

## Project Structure

```
fee-delegation-server/
│
├── package.json
├── server.js                 # Custom Express server
├── next.config.ts           # Next.js configuration
├── .env                     # Environment variables
│
├── app/                     # Next.js app directory
│   ├── api/
│   │   └── auth/           # NextAuth routes (handled by Next.js)
│   ├── components/          # React components
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Homepage
│
├── backend/                 # Node.js backend logic
│   ├── routes/             # Express routes
│   │   ├── dapps.js        # /api/dapps/*
│   │   ├── contracts.js    # /api/contracts/*
│   │   ├── senders.js      # /api/senders/*
│   │   ├── balance.js      # /api/balance/*
│   │   ├── apiKeys.js      # /api/api-keys/*
│   │   ├── pool.js         # /api/pool/*
│   │   ├── emailAlerts.js  # /api/email-alerts/*
│   │   ├── emailAlertLogs.js # /api/email-alert-logs/*
│   │   ├── docs.js         # /api/docs/*
│   │   ├── openapi.js      # /api/openapi.json/*
│   │   └── signAsFeePayer.js # /api/signAsFeePayer/*
│   ├── utils/              # Backend utilities (JavaScript)
│   │   ├── apiUtils.js     # API utility functions
│   │   ├── verifyToken.js  # Token verification
│   │   ├── prisma.js       # Database client
│   │   ├── authOptions.js  # Auth configuration
│   │   └── swagger.js      # Swagger configuration
│   ├── controllers/        # Business logic (future)
│   ├── middleware/         # Express middlewares (future)
│   ├── services/           # External services (future)
│   ├── config/             # Configuration files (future)
│   └── prisma/             # Database schema and migrations
│
├── lib/                     # Shared utilities (for Next.js)
│   └── auth-options.ts     # NextAuth configuration (TypeScript)
│
├── public/                  # Static assets
└── types/                   # TypeScript type definitions
```

## Features

- **Next.js Frontend**: Modern React-based UI with Next.js 15
- **Express Backend**: Custom Express server for API endpoints
- **NextAuth Integration**: Google OAuth authentication
- **Database**: Prisma ORM with SQLite (development) / PostgreSQL (production)
- **API Endpoints**: RESTful API for managing DApps, contracts, senders, etc.
- **TypeScript Support**: Full TypeScript support for type safety
- **Fee Delegation**: Support for fee-delegated transactions
- **Email Alerts**: Balance threshold monitoring with email notifications
- **Access Control**: Multiple authentication methods (API keys, contract/sender whitelisting)

## API Endpoints

### Authentication (NextAuth)
- `GET/POST /api/auth/*` - Handled by NextAuth in Next.js

### DApps Management
- `GET /api/dapps` - Get all DApps (public)
- `POST /api/dapps` - Create a new DApp (requires editor access)
- `PUT /api/dapps` - Update a DApp (requires editor access)
- `DELETE /api/dapps` - Delete a DApp (requires editor access)

### Contracts Management
- `POST /api/contracts/check` - Check if contract exists (requires editor access)
- `POST /api/contracts` - Add a contract (requires editor access)
- `DELETE /api/contracts` - Deactivate a contract (requires editor access)

### Senders Management
- `POST /api/senders/check` - Check if sender exists (requires editor access)
- `POST /api/senders` - Add a sender (requires editor access)
- `DELETE /api/senders` - Deactivate a sender (requires editor access)

### API Keys Management
- `POST /api/api-keys` - Add an API key (requires editor access)
- `DELETE /api/api-keys` - Deactivate an API key (requires editor access)

### Email Alerts
- `GET /api/email-alerts` - Get all email alerts (requires editor access)
- `POST /api/email-alerts` - Create an email alert (requires editor access)
- `PUT /api/email-alerts` - Update an email alert (requires editor access)
- `DELETE /api/email-alerts` - Delete an email alert (requires editor access)

### Email Alert Logs
- `GET /api/email-alert-logs` - Get email alert logs with optional filtering (requires editor access)
  - Query parameters: `dappId`, `email`, `isRead`

### Balance & Pool Management
- `GET /api/balance` - Check DApp balance (supports API key auth or address whitelisting)
- `GET /api/pool` - Get pool balance information (requires editor access)

### Fee Delegation
- `POST /api/signAsFeePayer` - Submit fee-delegated transaction (supports API key auth or address whitelisting)
- `OPTIONS /api/signAsFeePayer` - CORS preflight request

### Documentation
- `GET /api/docs` - Swagger UI documentation
- `GET /api/openapi.json` - OpenAPI specification

## API Authentication & Access Control

### Editor Access (Admin Functions)
Most management endpoints require editor access through Google OAuth:
- DApp CRUD operations
- Contract/sender management
- API key management
- Email alert management
- Pool balance viewing

### API Key Authentication
For fee delegation and balance checking:
- Include `Authorization: Bearer <api-key>` header
- API keys are generated per DApp
- Format: `kaia_<32-byte-hex>`

### Address Whitelisting
Alternative authentication method for fee delegation:
- No authentication header required
- Sender/contract address must be whitelisted in a DApp
- Works for DApps without API keys

## Getting Started

### Prerequisites
- Node.js 18+
- SQLite (development) or PostgreSQL (production)
- Google OAuth credentials

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd fee-delegation-server
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env` file in the root directory with the following variables:
```bash
# Database
DATABASE_URL="file:./dev.db"  # SQLite for development, Also change the schema.prisma accordingly for sqlite provider

# DATABASE_URL="postgresql://user:password@localhost:5432/database"  # PostgreSQL for production

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"

# Admin Access
GOOGLE_WHITELIST="admin@example.com,user@example.com"

# Network Configuration
NETWORK="testnet"  # or "mainnet"
ACCOUNT_ADDRESS="0x..."  # Fee delegation account address
FEE_PAYER_PRIVATE_KEY="your-private-key"  # Private key for fee delegation

# RPC Configuration
RPC_URL="https://rpc-endpoint-1,https://rpc-endpoint-2"  # Comma-separated RPC endpoints

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3000/api"  # Frontend API URL

# AWS SES Configuration (for email alerts)
AWS_REGION="us-east-1"  # AWS region where your SES is configured
AWS_ACCESS_KEY_ID="your-aws-access-key-id"  # Optional: only needed for local development
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"  # Optional: only needed for local development
FROM_EMAIL="noreply@yourdomain.com"  # Must be verified in AWS SES

# Pool Warning Thresholds (optional)
NEXT_PUBLIC_POOL_WARNING_RED="10"  # Red warning threshold
NEXT_PUBLIC_POOL_WARNING_ORANGE="20"  # Orange warning threshold

# Server Configuration
PORT="3000"  # Server port (optional, defaults to 3000)
NODE_ENV="development"  # Environment (development/production)
```

4. Generate Prisma client:
```bash
npm run db:generate
```

5. Push database schema:
```bash
npm run db:push
```

6. Run the development server:
```bash
npm run dev
```

## AWS SES Setup

To enable email functionality, you need to configure AWS SES:

1. **Create an AWS account** if you don't have one
2. **Navigate to AWS SES** in your preferred region
3. **Verify your sender email address**:
   - Go to SES → Verified identities
   - Click "Create identity"
   - Choose "Email address" and enter your FROM_EMAIL
   - Check your email and click the verification link
4. **Configure AWS credentials** (choose one option):
   
   **Option A: IAM Role (Recommended for AWS deployments)**
   - Create an IAM role with SES send permissions
   - Attach the role to your EC2 instance, ECS task, or Kubernetes pod
   - No need to set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in your environment
   
   **Option B: IAM User (For local development)**
   - Go to IAM → Users → Create user
   - Attach the `AmazonSESFullAccess` policy (or create a custom policy with SES send permissions)
   - Create access keys and use them for `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
5. **Request production access** (if needed):
   - By default, SES is in sandbox mode and can only send to verified email addresses
   - To send to any email address, request production access in the SES console

## Docker Deployment

### Manual Docker Build

1. **Build the image:**
```bash
docker build -t fee-delegation-server .
```

2. **Run the container:**
```bash
docker run -d \
  --name fee-delegation-server \
  -p 3000:3000 \
  --env-file .env \
  fee-delegation-server
```

### Docker Features

- **Multi-stage build** for optimized production images
- **Health checks** for container monitoring
- **Non-root user** for security
- **Signal handling** with dumb-init
- **Environment variable** support
- **Volume mounting** for database persistence
- **Network isolation** with custom bridge network

### Production Considerations

- Use PostgreSQL instead of SQLite for production
- Set appropriate resource limits
- Configure logging and monitoring
- Use secrets management for sensitive data
- Set up proper backup strategies

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push database schema
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### Production

Build and start the production server:
```bash
npm run build
npm start
```

The application will be available at `http://localhost:3000`.

## Development

- **Frontend**: Next.js app in the `app/` directory (TypeScript)
- **Backend**: Express routes in the `backend/routes/` directory (JavaScript)
- **Database**: Prisma schema in `backend/prisma/schema.prisma`
- **Authentication**: NextAuth configuration in `lib/auth-options.ts`

### API Documentation

- **Swagger UI**: Available at `http://localhost:3000/api/docs`
- **OpenAPI Spec**: Available at `http://localhost:3000/api/openapi.json`

### Database Management

- **Prisma Studio**: Run `npm run db:studio` to open database GUI
- **Migrations**: Run `npm run db:migrate` to apply database changes
- **Schema Push**: Run `npm run db:push` to sync schema changes

## Architecture

This project combines Next.js and Node.js to provide:

1. **Next.js**: Handles the frontend, NextAuth authentication, and static file serving
2. **Express**: Handles API endpoints and business logic
3. **Custom Server**: `server.js` coordinates between Next.js and Express

The custom server (`server.js`) serves as the entry point, routing API requests to Express routes and all other requests to Next.js.

### Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Express.js, Node.js, JavaScript
- **Database**: Prisma ORM, SQLite (dev) / PostgreSQL (prod)
- **Authentication**: NextAuth.js, Google OAuth
- **Blockchain**: Ethers.js for transaction handling
- **Documentation**: Swagger/OpenAPI
- **Development**: ESLint, Tailwind CSS
- **Containerization**: Docker

### Environment Variables

Required environment variables:

```env
# Database
DATABASE_URL="file:./dev.db"  # SQLite for development

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"

# Admin Access
GOOGLE_WHITELIST="admin@example.com,user@example.com"

# Network Configuration
NETWORK="testnet"  # or "mainnet"
ACCOUNT_ADDRESS="0x..."  # Fee delegation account address
FEE_PAYER_PRIVATE_KEY="your-private-key"  # Private key for fee delegation

# RPC Configuration
RPC_URL="https://rpc-endpoint-1,https://rpc-endpoint-2"  # Comma-separated RPC endpoints

# API Configuration
NEXT_PUBLIC_API_URL="http://localhost:3000/api"  # Frontend API URL

# AWS SES Configuration (for email alerts)
AWS_REGION="us-east-1"  # AWS region where your SES is configured
AWS_ACCESS_KEY_ID="your-aws-access-key-id"  # Optional: only needed for local development
AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"  # Optional: only needed for local development
FROM_EMAIL="noreply@yourdomain.com"  # Must be verified in AWS SES

# Pool Warning Thresholds (optional)
NEXT_PUBLIC_POOL_WARNING_RED="10"  # Red warning threshold
NEXT_PUBLIC_POOL_WARNING_ORANGE="20"  # Orange warning threshold

# Server Configuration
PORT="3000"  # Server port (optional, defaults to 3000)
NODE_ENV="development"  # Environment (development/production)
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Common Issues

**Database Connection Error**
```bash
# Ensure database is running and DATABASE_URL is correct
npm run db:push
```

**Authentication Issues**
- Verify Google OAuth credentials in `.env`
- Check `GOOGLE_WHITELIST` contains your email

**API Endpoints Not Working**
- Check if Express server is running
- Verify API routes in `backend/routes/`
- Check server logs for errors

**Prisma Issues**
```bash
# Regenerate Prisma client
npm run db:generate

# Reset database (WARNING: This will delete all data)
npx prisma migrate reset --schema=./backend/prisma/schema.prisma
```

**Fee Delegation Issues**
- Verify `ACCOUNT_ADDRESS` is set correctly
- Check if DApp has sufficient balance
- Ensure contract/sender is whitelisted or API key is valid

## License

[Your License Here]
