# NodeBridge RPC Gateway

<div align="center">

[![Tests](https://img.shields.io/badge/tests-passing-brightgreen)](./tests)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-47A248)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

</div>

A **production-ready**, multi-tenant RPC gateway providing controlled access to your private Ethereum Sepolia node infrastructure. Similar to Alchemy or Infura, but for your own nodes with enterprise-grade monitoring and security.

## 🚀 Features

### 🔐 **Multi-Tenant Security & App Management**

- JWT-based authentication system for user accounts.
- **App-Based API Keys**: Users create "Apps", each tied to a specific blockchain (e.g., Ethereum Sepolia). Each App gets its own unique API key.
- **App Limit**: Users can create up to 5 Apps by default.
- **Admin-Managed Chains**: Administrators manage the list of available blockchains that users can create Apps for.
- Role-based access control (user vs. admin).
- Input validation & sanitization.

### ⚡ **Advanced Rate Limiting**

- Token bucket algorithm implementation.
- **Per-App Rate Limiting**: Rate limits (RPS and daily limits) are now applied on a per-App basis, using each App's unique API key.
- Automatic rate limit recovery.
- Real-time usage tracking per App.

### 📊 **Enterprise Monitoring**

- **Prometheus metrics** integration
- **Real-time Ethereum node health** monitoring
- Request latency tracking
- Error rate monitoring
- Usage analytics

### 🌐 **Dual Layer Support**

- **Execution Layer**: Full JSON-RPC compatibility
- **Consensus Layer**: Beacon API support
- Automatic request routing
- Path rewriting & parameter handling

### 🛡️ **Production Security**

- Helmet.js security headers
- CORS configuration
- Request logging
- Error handling without information leakage

## 🏗️ Architecture

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Client    │───▶│  NodeBridge      │───▶│  Ethereum Node     │
│  (Web3.js)  │    │  RPC Gateway     │    │  (Execution +      │
│  (Ethers)   │    │                  │    │   Consensus)       │
│   (curl)    │    │  ┌─────────────┐ │    │                    │
└─────────────┘    │  │ Auth        │ │    └─────────────────────┘
                   │  │ Rate Limit  │ │              │
                   │  │ Metrics     │ │              │
                   │  │ Validation  │ │    ┌─────────────────────┐
                   │  └─────────────┘ │    │  Prometheus         │
                   └──────────────────┘    │  Metrics Server     │
                            │              │  (Optional)         │
                   ┌──────────────────┐    └─────────────────────┘
                   │   MongoDB        │
                   │   (Users & Usage)│
                   └──────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **MongoDB** 6.0+
- **Ethereum Sepolia Node** (execution + consensus layers)
- **Prometheus** (optional, for advanced monitoring)

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/NodeBridge-Africa/rpc_gateway.git
cd rpc_gateway

# Install dependencies
yarn install

# Build the project
yarn build
```

### 2. Environment Configuration

```bash
# Copy environment template
cp .env.example .env
```

Update `.env` with your configuration:

```env
# Server Configuration
PORT=8888
NODE_ENV=production

# Database
MONGO_URI=mongodb://localhost:27017/nodebridge

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Ethereum Node Endpoints (These are examples, the gateway routes requests based on App's chain configuration)
# The gateway itself does not directly connect to a single node anymore for all users.
# Instead, it will proxy requests to the appropriate node based on the chain an App is configured for.
# The actual node URLs for specific chains are now managed via the Admin API.
# EXECUTION_RPC_URL and CONSENSUS_API_URL in this .env might be used for health checks or specific internal purposes,
# but are NOT the primary means of routing user RPC requests.
EXECUTION_RPC_URL=http://localhost:8545 
CONSENSUS_API_URL=http://localhost:5052

# Prometheus Monitoring (Optional)
PROMETHEUS_URL=http://localhost:9090

# Default Rate Limiting for Apps
# DEFAULT_APP_MAX_RPS is defined as a constant in src/config/constants.ts (currently 20 RPS)
# This value is used when a new App is created.
# DEFAULT_DAILY_REQUESTS applies per App API key.
DEFAULT_DAILY_REQUESTS=10000
```

### 3. Database Setup

```bash
# Start MongoDB
sudo systemctl start mongod

# Initialize database (creates indexes, etc.)
yarn setup
```

### 4. Start the Gateway

```bash
# Development mode (with hot reload)
yarn dev

# Production mode
yarn start
```

The gateway will be available at `http://localhost:8888`

## 📚 API Documentation

### 🔐 Authentication

#### Register New User

```bash
POST /auth/register
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "SecurePassword123!"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "637f4a2e8b12c45678901234",
      "email": "developer@example.com",
      "appCount": 0,
      "isAdmin": false,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```
*Note: The `apiKey` and `maxRps` fields are no longer returned at the user level. API keys are now associated with "Apps".*

#### User Login

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "SecurePassword123!"
}
```
*(Response will contain a JWT token and basic user information, excluding API keys.)*

#### Get Account Information

```bash
GET /auth/account
Authorization: Bearer <YOUR_JWT_TOKEN>
```
*(Returns user details including `appCount` and `isAdmin` status. Does not return API keys.)*

#### Get Usage Statistics (User Level - Deprecated)

```bash
GET /auth/usage
Authorization: Bearer <YOUR_JWT_TOKEN>
```
*(This endpoint now indicates that user-level usage is deprecated and directs users to check per-application usage. Specific app usage details are not yet exposed via a dedicated API endpoint in this version.)*


### 📱 Application (App) Management

Users can create and manage "Apps". Each App is tied to a specific blockchain and has its own API key.

#### Create a New App

```bash
POST /apps
Authorization: Bearer <YOUR_JWT_TOKEN>
Content-Type: application/json

{
  "name": "My First Ethereum App",
  "description": "App for interacting with Ethereum Sepolia",
  "chainName": "Ethereum Sepolia", // Must be a chainName configured by an admin
  "chainId": "11155111" // Must be a chainId configured by an admin
}
```
**Response:**
```json
{
  "userId": "637f4a2e8b12c45678901234",
  "name": "My First Ethereum App",
  "description": "App for interacting with Ethereum Sepolia",
  "apiKey": "app-api-key-generated-for-this-app", // This is YOUR_APP_API_KEY
  "chainName": "Ethereum Sepolia",
  "chainId": "11155111",
  "maxRps": 20, // Default RPS for the app
  "requests": 0,
  "dailyRequests": 0,
  "lastResetDate": "2024-01-01T00:00:00.000Z",
  "isActive": true,
  "_id": "appGeneratedMongoId",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```
*Users are limited to a certain number of apps (e.g., 5).*

#### List User's Apps

```bash
GET /apps
Authorization: Bearer <YOUR_JWT_TOKEN>
```
*(Returns an array of all Apps created by the authenticated user.)*


### 🔗 Using App-Specific API Keys for RPC Access

Once an App is created, use its `apiKey` in the RPC endpoint paths.

#### Execution Layer (JSON-RPC)

Access standard Ethereum JSON-RPC methods using an App's API key:

```bash
POST /exec/<YOUR_APP_API_KEY>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "eth_blockNumber",
  "params": [],
  "id": 1
}
```
*The request will be routed to the blockchain specified when creating the App (e.g., Ethereum Sepolia).*

**Supported Methods:**

- `eth_blockNumber`
- `eth_getBalance`
- `eth_getBlockByNumber`
- `eth_getTransactionReceipt`
- `eth_sendRawTransaction`
- `eth_call`
- All standard Ethereum JSON-RPC methods supported by the target chain.

#### Consensus Layer (Beacon API)

Access Ethereum consensus layer data using an App's API key:

```bash
GET /cons/<YOUR_APP_API_KEY>/eth/v1/beacon/headers
GET /cons/<YOUR_APP_API_KEY>/eth/v1/beacon/blocks/head
GET /cons/<YOUR_APP_API_KEY>/eth/v1/node/syncing
```
*The request will be routed to the consensus layer of the blockchain specified for the App.*


### ⛓️ Chain Management (Admin Only)

Administrators have a separate set of endpoints under `/admin/chains` to manage the available blockchains that users can create Apps for. These require an admin user's JWT token.

- `POST /admin/chains`: Add a new chain.
- `GET /admin/chains`: List all configured chains.
- `PUT /admin/chains/:chainId`: Update a chain's details (e.g., enable/disable, description).
- `DELETE /admin/chains/:chainId`: Remove a chain.


### 📊 Monitoring Endpoints

#### Health Check

```bash
GET /health
```

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "production"
}
```

#### Prometheus Metrics

```bash
GET /metrics
```

Returns Prometheus-formatted metrics including:

- `rpc_gateway_requests_total` (labels include `apiKey` to identify app)
- `rpc_gateway_request_duration_seconds` (labels include `apiKey`)
- `ethereum_execution_syncing` (if applicable, based on configured health checks)
- `ethereum_consensus_head_slot` (if applicable)
- And many more...

#### Admin: Node Health

```bash
GET /admin/node-health 
Authorization: Bearer <ADMIN_JWT_TOKEN>
```
*Note: This endpoint might provide general health of configured nodes for the system or a specific chain, requiring admin privileges.*

**Response Example (Conceptual):**
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  // Health details might be per configured chain or a general overview
  "chains": [
    {
      "chainName": "Ethereum Sepolia",
      "chainId": "11155111",
      "execution": { "status": "healthy", "syncing": false, "endpoint": "configured_sepolia_exec_url" },
      "consensus": { "status": "healthy", "syncing": false, "head_slot": "...", "endpoint": "configured_sepolia_cons_url" }
    }
    // ... other configured chains
  ],
  "overallGatewayStatus": "healthy"
}
```
*(The exact structure of `/admin/node-health` and `/admin/node-metrics` might need further definition based on how chain node URLs are stored and accessed by admin functions.)*

#### Admin: Node Metrics

```bash
GET /admin/node-metrics
Authorization: Bearer <ADMIN_JWT_TOKEN>
```
*(Similar to node health, this would likely be admin-protected and could provide metrics for specific configured chains.)*

## 💻 Usage Examples

### Web3.js Integration

```javascript
const Web3 = require("web3");

// Initialize with your NodeBridge gateway using an App's API Key
const web3 = new Web3("http://localhost:8888/exec/YOUR_APP_API_KEY");

async function example() {
  // Get latest block number
  const blockNumber = await web3.eth.getBlockNumber();
  console.log("Latest block:", blockNumber);

  // Get account balance
  const balance = await web3.eth.getBalance(
    "0x742d35Cc6634C0532925a3b8D8B8c8B8A8B8B8B8"
  );
  console.log("Balance:", web3.utils.fromWei(balance, "ether"), "ETH");
}
```

### Ethers.js Integration

```javascript
const { JsonRpcProvider } = require("ethers");

// Initialize provider using an App's API Key
const provider = new JsonRpcProvider("http://localhost:8888/exec/YOUR_APP_API_KEY");

async function example() {
  // Get network information
  const network = await provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);

  // Get block information
  const block = await provider.getBlock("latest");
  console.log("Latest block hash:", block.hash);
}
```

### cURL Examples

```bash
# Get latest block number using an App's API Key
curl -X POST http://localhost:8888/exec/YOUR_APP_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Get consensus layer sync status using an App's API Key
curl http://localhost:8888/cons/YOUR_APP_API_KEY/eth/v1/node/syncing

# Check gateway health
curl http://localhost:8888/health
```

## 🧪 Testing

### Test Structure

- **110 Total Tests** across multiple categories
- **Unit Tests**: No dependencies, fast execution
- **Integration Tests**: Full workflow testing
- **Database Tests**: MongoDB operations
- **Metrics Tests**: Prometheus metrics validation

### Running Tests

```bash
# Run all tests
yarn test

# Run only unit tests (no MongoDB required)
yarn jest --selectProjects unit-tests

# Run only database tests
yarn jest --selectProjects database-tests

# Run with coverage report
yarn test:coverage

# Run specific test file
yarn jest tests/auth.test.ts

# Watch mode for development
yarn test:watch
```

### Test Categories

**🔧 Unit Tests** (No external dependencies)

- JWT token creation/validation
- Password hashing (bcrypt)
- Rate limiting algorithms
- Utility functions

**🔗 Integration Tests** (Full system)

- Complete user registration → API usage workflow
- Rate limiting enforcement
- Error handling scenarios
- Performance benchmarks

**�� Database Tests** (MongoDB required)

- User model operations
- Authentication routes
- Usage tracking
- Data persistence

**📊 Metrics Tests** (Prometheus integration)

- Custom metrics collection
- Default Node.js metrics
- Request tracking
- Performance measurements

## 📊 Monitoring & Analytics

### Prometheus Metrics

The gateway exposes comprehensive metrics for monitoring:

#### **Gateway Performance Metrics**

- `rpc_gateway_requests_total` - Request counts by endpoint/app (via `apiKey` label)
- `rpc_gateway_request_duration_seconds` - Request latency histograms (per app)
- `rpc_gateway_active_connections` - Current connections
- `rpc_gateway_rate_limit_hits_total` - Rate limiting events (per app)

#### **Ethereum Node Health Metrics**

- `ethereum_execution_syncing` - Execution layer sync status
- `ethereum_consensus_syncing` - Consensus layer sync status
- `ethereum_consensus_head_slot` - Current consensus head slot
- `ethereum_node_health_status` - Overall node health score

#### **System Metrics**

- `process_*` - Node.js process metrics
- `nodejs_*` - Node.js runtime metrics
- `http_*` - HTTP server metrics

### Grafana Dashboard Setup

Create monitoring dashboards with:

```json
{
  "dashboard": {
    "title": "NodeBridge RPC Gateway",
    "panels": [
      {
        "title": "Request Rate",
        "targets": ["rate(rpc_gateway_requests_total[5m])"]
      },
      {
        "title": "Request Latency",
        "targets": [
          "histogram_quantile(0.95, rpc_gateway_request_duration_seconds_bucket)"
        ]
      },
      {
        "title": "Node Sync Status",
        "targets": ["ethereum_execution_syncing", "ethereum_consensus_syncing"]
      }
    ]
  }
}
```

## 🚀 Production Deployment

### Environment Preparation

```bash
# 1. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
sudo apt-get install -y mongodb-org

# 3. Install PM2 for process management
npm install -g pm2
```

### Production Configuration

```env
# Production .env
NODE_ENV=production
PORT=8888

# Use production MongoDB cluster
MONGO_URI=mongodb://mongo1,mongo2,mongo3/nodebridge?replicaSet=rs0

# Strong JWT secret (generate with: openssl rand -hex 64)
JWT_SECRET=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456

# Production node endpoints
EXECUTION_RPC_URL=http://internal-eth-node:8545
CONSENSUS_API_URL=http://internal-beacon-node:5052

# Monitoring
PROMETHEUS_URL=http://prometheus:9090

# Adjusted limits for production
DEFAULT_MAX_RPS=100
DEFAULT_DAILY_REQUESTS=1000000
```

### Process Management

```bash
# Build for production
yarn build

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 status
pm2 logs nodebridge-gateway
pm2 monit
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

EXPOSE 8888
CMD ["yarn", "start"]
```

```bash
# Build and run
docker build -t nodebridge-gateway .
docker run -d \
  -p 8888:8888 \
  --env-file .env \
  --name nodebridge \
  nodebridge-gateway
```

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name rpc.yourdomain.com;

    location / {
        proxy_pass http://localhost:8888;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Rate limiting
        limit_req zone=api burst=100 nodelay;
    }
}
```

## 🛡️ Security Best Practices

### 1. **Environment Security**

```bash
# Never commit .env files
echo ".env*" >> .gitignore

# Use environment-specific secrets
export JWT_SECRET="$(openssl rand -hex 64)"
```

### 2. **Network Security**

- Run behind reverse proxy (Nginx/Apache)
- Use HTTPS/TLS in production
- Implement IP whitelisting if needed
- Configure firewall rules

### 3. **Database Security**

- Enable MongoDB authentication
- Use connection encryption
- Regular backups
- User privilege management

### 4. **Application Security**

- Input validation on all endpoints
- Rate limiting enforcement
- Audit logging
- Regular dependency updates

## 🔧 Development Guide

### Project Structure

```
rpc_gateway/
├── src/                          # Source code
│   ├── config/                   # Configuration files
│   ├── middlewares/              # Express middlewares
│   │   ├── auth.middleware.ts    # JWT authentication
│   │   └── rateLimit.middleware.ts # Rate limiting
│   ├── models/                   # Database models
│   │   └── user.model.ts         # User schema & methods
│   ├── routes/                   # API route handlers
│   │   ├── auth.routes.ts        # Authentication endpoints
│   │   └── proxy.routes.ts       # RPC proxy endpoints
│   ├── services/                 # Business logic
│   │   └── metrics.service.ts    # Prometheus metrics
│   └── server.ts                 # Application entry point
├── tests/                        # Test suite
│   ├── auth.test.ts             # Authentication tests
│   ├── integration.test.ts      # Full workflow tests
│   ├── metrics.simple.test.ts   # Metrics collection tests
│   ├── middleware.test.ts       # Middleware tests
│   ├── proxy.test.ts           # RPC proxy tests
│   ├── unit.test.ts            # Unit tests
│   ├── user.model.test.ts      # Database model tests
│   └── helpers/                # Test utilities
├── docs/                       # Additional documentation
├── package.json               # Dependencies & scripts
├── tsconfig.json             # TypeScript configuration
├── jest.config.js            # Test configuration
└── README.md                 # This file
```

### Environment Variables

| Variable                 | Description                  | Default                                | Required |
| ------------------------ | ---------------------------- | -------------------------------------- | -------- |
| `PORT`                   | Server port                  | `8888`                                 | No       |
| `NODE_ENV`               | Environment                  | `development`                          | No       |
| `MONGO_URI`              | MongoDB connection           | `mongodb://localhost:27017/nodebridge` | Yes      |
| `JWT_SECRET`             | JWT signing secret           | -                                      | Yes      |
| `EXECUTION_RPC_URL`      | Ethereum execution node      | `http://localhost:8545`                | Yes      |
| `CONSENSUS_API_URL`      | Ethereum consensus node      | `http://localhost:5052`                | Yes      |
| `PROMETHEUS_URL`         | Prometheus metrics endpoint  | -                                      | No       |
| `DEFAULT_DAILY_REQUESTS` | Daily request limit per App  | `10000`                                | No       |

### Development Workflow

1. **Setup Development Environment**

   ```bash
   git clone <repository>
   cd rpc_gateway
   yarn install
   cp .env.example .env
   # Edit .env with your settings
   ```

2. **Run in Development Mode**

   ```bash
   yarn dev  # Starts with hot reload
   ```

3. **Run Tests During Development**

   ```bash
   yarn test:watch  # Continuous testing
   ```

4. **Before Committing**
   ```bash
   yarn lint        # Check code style
   yarn test        # Run full test suite
   yarn build       # Verify build
   ```

---

## 🤝 Contributing

We welcome contributions! Please read our contribution guidelines below.

### 🚀 Getting Started with Contributing
(Contribution process remains largely the same, ensure local setup reflects new App/Chain model if contributing to those areas)

1.  **Fork the Repository**
    ```bash
    # Click "Fork" on GitHub, then clone your fork
    git clone https://github.com/YOUR-USERNAME/rpc_gateway.git
    cd rpc_gateway
    ```

2.  **Set Up Development Environment**
    ```bash
    # Install dependencies
    yarn install

    # Copy environment file
    cp .env.example .env
    # Edit .env with your local settings (especially MONGO_URI, JWT_SECRET)

    # Start MongoDB (if running locally)
    sudo systemctl start mongod

    # Run tests to ensure everything works (including setting up initial admin user and chains for some tests)
    yarn test
    ```
    *Note: Some integration tests might require initial setup of admin users and chains. Check test setup files.*

3.  **Create Feature Branch**
    ```bash
    git checkout -b feature/your-feature-name
    # or
    git checkout -b fix/issue-description
    ```

### 📝 Development Guidelines

#### **Code Style**
(Guidelines remain the same)
We use TypeScript with strict typing and ESLint for code quality:
```bash
# Check code style
yarn lint

# Auto-fix style issues
yarn lint:fix
```

#### **Testing Requirements**
(Guidelines remain the same, adapt tests for new App/Chain model)
All contributions must include appropriate tests:
```bash
# Run all tests
yarn test

# Run tests in watch mode during development
yarn test:watch

# Check test coverage
yarn test:coverage
```
**Testing Guidelines:**
-   **Unit tests** for utility functions, individual model methods, and pure logic.
-   **Integration tests** for API endpoints, ensuring correct interaction between controllers, services, and models.
-   Cover new App creation, listing, API key access, and admin chain management.
-   Maintain >90% test coverage.
-   Mock external dependencies appropriately.

#### **Commit Convention**
(Convention remains the same)
We follow [Conventional Commits](https://www.conventionalcommits.org/).

### 🐛 Bug Reports & 💡 Feature Requests
(Templates and process remain the same)

### 🔧 Development Areas
We welcome contributions in these areas:

#### **🔐 Security & App/Chain Management**
-   Fine-grained permissions for Apps (e.g., allowed RPC methods).
-   API key rotation mechanisms for Apps.
-   Admin UI for managing users and chains.
-   Advanced rate limiting strategies (e.g., per method, burst limits for apps).

#### **📊 Monitoring & Analytics**
-   Detailed per-App usage metrics and dashboards.
-   Alerting for specific app behaviors or chain issues.

#### **🌐 Network & Protocols**
-   Support for more blockchain networks (configurable via Admin API).
-   Dynamic node endpoint management per chain.

#### **🧪 Testing & Quality**
(Guidelines remain the same)

#### **🚀 DevOps & Deployment**
(Guidelines remain the same)

### 📋 Pull Request Process
(Process remains the same)

### 📞 Getting Help
(Channels remain the same)

### 🏆 Recognition
(Process remains the same)

---

## 📖 Additional Resources

### 📚 Documentation

- [Ethereum JSON-RPC Specification](https://ethereum.github.io/execution-apis/api-documentation/)
- [Beacon API Documentation](https://ethereum.github.io/beacon-APIs/)
- [Prometheus Metrics Guide](https://prometheus.io/docs/practices/naming/)

### 🛠️ Tools & Libraries

- [Express.js](https://expressjs.com/) - Web framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Prometheus](https://prometheus.io/) - Metrics collection
- [Jest](https://jestjs.io/) - Testing framework

### 🔗 Related Projects

- [Ethereum Node Setup Guides](https://ethereum.org/en/developers/docs/nodes-and-clients/)
- [Grafana Dashboard Examples](https://grafana.com/grafana/dashboards/)
- [Docker Compose Examples](https://docs.docker.com/compose/)

---

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### MIT License Summary

- ✅ **Commercial use** allowed
- ✅ **Modification** allowed
- ✅ **Distribution** allowed
- ✅ **Private use** allowed
- ❗ **Liability** and **warranty** limitations apply

---

## 🙏 Acknowledgments

- **Ethereum Foundation** for the protocol specifications
- **MongoDB Team** for the excellent database platform
- **Prometheus Community** for monitoring standards
- **Open Source Contributors** who make projects like this possible

---

<div align="center">

**⭐ Star this repository if you find it useful!**

[Report Bug](.github/ISSUE_TEMPLATE/bug_report.md) •
[Request Feature](.github/ISSUE_TEMPLATE/feature_request.md) •
[Documentation](https://github.com/NodeBridge-Africa/rpc_gateway/wiki/Home.md) •
[Contribute](CONTRIBUTING.md)

Made with ❤️ by [Kc Pele](https://github.com/KcPele), for Nodebridge

</div>
