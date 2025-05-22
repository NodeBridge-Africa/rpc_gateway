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

### 🔐 **Multi-Tenant Security**

- JWT-based authentication system
- Unique API keys per user
- Role-based access control
- Input validation & sanitization

### ⚡ **Advanced Rate Limiting**

- Token bucket algorithm implementation
- Per-user RPS and daily limits
- Automatic rate limit recovery
- Real-time usage tracking

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
git clone https://github.com/your-org/nodebridge_rpc_backend.git
cd nodebridge_rpc_backend

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

# Ethereum Node Endpoints
EXECUTION_RPC_URL=http://localhost:8545
CONSENSUS_API_URL=http://localhost:5052

# Prometheus Monitoring (Optional)
PROMETHEUS_URL=http://localhost:9090

# Rate Limiting Defaults
DEFAULT_MAX_RPS=20
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
    "apiKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user": {
      "id": "637f4a2e8b12c45678901234",
      "email": "developer@example.com",
      "apiKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "maxRps": 20,
      "dailyRequestLimit": 10000,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### User Login

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "developer@example.com",
  "password": "SecurePassword123!"
}
```

#### Get Account Information

```bash
GET /auth/account
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Regenerate API Key

```bash
POST /auth/regenerate-api-key
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Get Usage Statistics

```bash
GET /auth/usage
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### ⚡ RPC Endpoints

#### Execution Layer (JSON-RPC)

Access standard Ethereum JSON-RPC methods:

```bash
POST /exec/<YOUR_API_KEY>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "eth_blockNumber",
  "params": [],
  "id": 1
}
```

**Supported Methods:**

- `eth_blockNumber`
- `eth_getBalance`
- `eth_getBlockByNumber`
- `eth_getTransactionReceipt`
- `eth_sendRawTransaction`
- `eth_call`
- All standard Ethereum JSON-RPC methods

#### Consensus Layer (Beacon API)

Access Ethereum consensus layer data:

```bash
GET /cons/<YOUR_API_KEY>/eth/v1/beacon/headers
GET /cons/<YOUR_API_KEY>/eth/v1/beacon/blocks/head
GET /cons/<YOUR_API_KEY>/eth/v1/node/syncing
```

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

- `rpc_gateway_requests_total`
- `rpc_gateway_request_duration_seconds`
- `ethereum_execution_syncing`
- `ethereum_consensus_head_slot`
- And many more...

#### Admin: Node Health

```bash
GET /admin/node-health
```

**Response:**

```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "execution": {
    "status": "healthy",
    "syncing": false,
    "endpoint": "http://localhost:8545"
  },
  "consensus": {
    "status": "healthy",
    "syncing": false,
    "head_slot": "7685000",
    "endpoint": "http://localhost:5052"
  },
  "overall": "healthy"
}
```

#### Admin: Node Metrics

```bash
GET /admin/node-metrics
```

## 💻 Usage Examples

### Web3.js Integration

```javascript
const Web3 = require("web3");

// Initialize with your NodeBridge gateway
const web3 = new Web3("http://localhost:8888/exec/YOUR-API-KEY");

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

// Initialize provider
const provider = new JsonRpcProvider("http://localhost:8888/exec/YOUR-API-KEY");

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
# Get latest block number
curl -X POST http://localhost:8888/exec/YOUR-API-KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Get consensus layer sync status
curl http://localhost:8888/cons/YOUR-API-KEY/eth/v1/node/syncing

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

- `rpc_gateway_requests_total` - Request counts by endpoint/user
- `rpc_gateway_request_duration_seconds` - Request latency histograms
- `rpc_gateway_active_connections` - Current connections
- `rpc_gateway_rate_limit_hits_total` - Rate limiting events

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
nodebridge_rpc_backend/
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
| `DEFAULT_MAX_RPS`        | Rate limit (requests/second) | `20`                                   | No       |
| `DEFAULT_DAILY_REQUESTS` | Daily request limit          | `10000`                                | No       |

### Development Workflow

1. **Setup Development Environment**

   ```bash
   git clone <repository>
   cd nodebridge_rpc_backend
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

### 🚀 Getting Started

1. **Fork the Repository**

   ```bash
   # Click "Fork" on GitHub, then clone your fork
   git clone https://github.com/YOUR-USERNAME/nodebridge_rpc_backend.git
   cd nodebridge_rpc_backend
   ```

2. **Set Up Development Environment**

   ```bash
   # Install dependencies
   yarn install

   # Copy environment file
   cp .env.example .env
   # Edit .env with your local settings

   # Start MongoDB (if running locally)
   sudo systemctl start mongod

   # Run tests to ensure everything works
   yarn test
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

### 📝 Development Guidelines

#### **Code Style**

We use TypeScript with strict typing and ESLint for code quality:

```bash
# Check code style
yarn lint

# Auto-fix style issues
yarn lint:fix

# Type checking
yarn type-check
```

**Style Guidelines:**

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public functions
- Follow existing naming conventions

#### **Testing Requirements**

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

- **Unit tests** for utility functions and pure logic
- **Integration tests** for API endpoints
- **Database tests** for model operations
- Maintain >90% test coverage
- Mock external dependencies appropriately

#### **Commit Convention**

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature commits
git commit -m "feat: add consensus layer health monitoring"

# Bug fixes
git commit -m "fix: resolve rate limiting edge case"

# Documentation
git commit -m "docs: update API documentation"

# Tests
git commit -m "test: add integration tests for auth flow"

# Refactoring
git commit -m "refactor: optimize metrics collection"
```

### 🐛 Bug Reports

When reporting bugs, please include:

1. **Clear Description**: What happened vs. what you expected
2. **Reproduction Steps**: Detailed steps to reproduce the issue
3. **Environment Info**: OS, Node.js version, MongoDB version
4. **Error Logs**: Complete error messages and stack traces
5. **Configuration**: Relevant `.env` settings (redacted secrets)

**Template:**

```markdown
## Bug Description

Brief description of the issue

## Steps to Reproduce

1. Step one
2. Step two
3. Step three

## Expected Behavior

What should happen

## Actual Behavior

What actually happens

## Environment

- OS: Ubuntu 22.04
- Node.js: v18.17.0
- MongoDB: v6.0.8
- Gateway Version: v1.0.0

## Error Logs
```

Error logs here

````

## Configuration
```env
# Redacted .env content
````

````

### 💡 Feature Requests

For new features, please:

1. **Check Existing Issues**: Avoid duplicates
2. **Describe Use Case**: Why is this feature needed?
3. **Propose Solution**: How should it work?
4. **Consider Alternatives**: Other ways to solve the problem?

**Template:**
```markdown
## Feature Request

### Problem/Use Case
Describe the problem this feature would solve

### Proposed Solution
How should this feature work?

### Alternatives Considered
Other approaches you've considered

### Additional Context
Any other relevant information
````

### 🔧 Development Areas

We welcome contributions in these areas:

#### **🔐 Security & Authentication**

- OAuth 2.0 / OpenID Connect integration
- API key rotation mechanisms
- Advanced rate limiting strategies
- Audit logging improvements

#### **📊 Monitoring & Analytics**

- Additional Prometheus metrics
- Grafana dashboard templates
- Alerting rule definitions
- Performance optimization

#### **🌐 Network & Protocols**

- WebSocket support
- Additional blockchain networks
- Protocol optimizations
- Connection pooling

#### **🧪 Testing & Quality**

- Performance benchmarks
- Load testing scenarios
- Security testing
- Documentation improvements

#### **🚀 DevOps & Deployment**

- Docker improvements
- Kubernetes manifests
- CI/CD pipeline enhancements
- Infrastructure as Code

### 📋 Pull Request Process

1. **Ensure Tests Pass**

   ```bash
   yarn test          # All tests must pass
   yarn lint          # No linting errors
   yarn build         # Must build successfully
   ```

2. **Update Documentation**

   - Update README.md if adding features
   - Add API documentation
   - Include inline code comments
   - Update changelog if applicable

3. **Create Quality PR**

   - Clear title and description
   - Reference related issues
   - Include test evidence
   - Add screenshots for UI changes

4. **Review Process**
   - Automated CI checks must pass
   - Code review by maintainers
   - Testing in development environment
   - Final approval and merge

### 📞 Getting Help

- **Questions**: Open a GitHub Discussion
- **Bug Reports**: Create a GitHub Issue
- **Security Issues**: Email security@yourdomain.com
- **Feature Ideas**: Start with a GitHub Discussion

### 🏆 Recognition

Contributors will be:

- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation
- Invited to maintainer discussions

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

[Report Bug](https://github.com/your-org/nodebridge_rpc_backend/issues) •
[Request Feature](https://github.com/your-org/nodebridge_rpc_backend/discussions) •
[Documentation](https://github.com/your-org/nodebridge_rpc_backend/wiki) •
[Contribute](CONTRIBUTING.md)

Made with ❤️ by developers, for developers

</div>
