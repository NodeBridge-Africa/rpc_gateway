# NodeBridge RPC Gateway

A multi-tenant RPC gateway for providing controlled access to your private Ethereum Sepolia node. Similar to Alchemy or Infura, but for your own infrastructure.

## Features

- **Multi-tenant Architecture**: Users register and receive unique API keys
- **Rate Limiting**: Token bucket algorithm with per-user limits
- **Usage Tracking**: Monitor requests, daily limits, and metrics
- **Dual Layer Support**: Both execution layer (eth) and consensus layer (beacon) endpoints
- **Authentication**: JWT-based authentication system
- **Monitoring**: Prometheus metrics integration
- **Security**: Helmet, CORS, input validation

## Architecture

```
[Client] → [Gateway] → [Your Sepolia Node]
            ↓
        [Rate Limiting]
        [Authentication]
        [Usage Tracking]
        [Metrics Collection]
```

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB
- A running Ethereum Sepolia node (execution + consensus)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd nodebridge_rpc_backend

# Install dependencies
yarn install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Run setup script
yarn setup
```

### Configuration

Create a `.env` file with:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/nodebridge

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# Sepolia Node Endpoints
EXECUTION_RPC_URL=http://localhost:8545
CONSENSUS_API_URL=http://localhost:5052

# Rate Limiting
DEFAULT_MAX_RPS=20
DEFAULT_DAILY_REQUESTS=10000
```

### Running

```bash
# Development
yarn dev

# Production
yarn build
yarn start
```

## API Documentation

### Authentication

#### Register User

```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "token": "jwt-token",
    "apiKey": "uuid-api-key",
    "user": {
      "id": "user-id",
      "email": "user@example.com",
      "apiKey": "uuid-api-key",
      "maxRps": 20,
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### Login

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

#### Get Account Info

```bash
GET /auth/account
Authorization: Bearer <jwt-token>
```

#### Regenerate API Key

```bash
POST /auth/regenerate-api-key
Authorization: Bearer <jwt-token>
```

#### Get Usage Statistics

```bash
GET /auth/usage
Authorization: Bearer <jwt-token>
```

### RPC Endpoints

#### Execution Layer (JSON-RPC)

```bash
POST /exec/<API_KEY>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "eth_blockNumber",
  "params": [],
  "id": 1
}
```

Example methods:

- `eth_blockNumber`
- `eth_getBalance`
- `eth_getBlockByNumber`
- `eth_sendRawTransaction`
- Any standard Ethereum JSON-RPC method

#### Consensus Layer (REST API)

```bash
GET /cons/<API_KEY>/eth/v1/beacon/headers
GET /cons/<API_KEY>/eth/v1/beacon/blocks/head
POST /cons/<API_KEY>/eth/v1/beacon/blinded_blocks
```

### Monitoring

#### Health Check

```bash
GET /health
```

#### Metrics (Prometheus format)

```bash
GET /metrics
```

## Testing

The project includes comprehensive test coverage:

### Running Tests

```bash
# All tests (requires MongoDB)
yarn test

# Unit tests only (no database required)
yarn jest --selectProjects unit-tests

# Integration tests
yarn test:integration

# With coverage
yarn test:coverage

# Watch mode
yarn test:watch
```

### Test Structure

- **Unit Tests** (`tests/unit.test.ts`): No database required

  - Basic functionality
  - JWT and bcrypt operations
  - Rate limiting algorithms
  - Utility functions

- **Integration Tests** (`tests/integration.test.ts`): Full workflow tests

  - Complete user journey
  - Rate limiting enforcement
  - Error handling
  - Performance testing

- **Component Tests**:
  - `tests/user.model.test.ts`: User model validation and methods
  - `tests/auth.test.ts`: Authentication routes
  - `tests/middleware.test.ts`: Middleware functionality
  - `tests/proxy.test.ts`: RPC proxying
  - `tests/metrics.simple.test.ts`: Metrics collection

### Test Dependencies

- **Jest**: Test framework
- **Supertest**: HTTP testing
- **MongoDB Memory Server**: In-memory database for tests
- **Nock**: HTTP mocking for external services

### Running Specific Tests

```bash
# Unit tests (no MongoDB required)
yarn jest --selectProjects unit-tests

# Database tests (requires MongoDB Memory Server)
yarn jest --selectProjects database-tests

# Specific test file
yarn jest tests/auth.test.ts

# Test with coverage
yarn test:coverage
```

## Usage Examples

### Register and Get API Key

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Use the returned API key for RPC calls
curl -X POST http://localhost:3000/exec/YOUR-API-KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Using with Web3.js

```javascript
const Web3 = require("web3");

const web3 = new Web3("http://localhost:3000/exec/YOUR-API-KEY");

async function getBlockNumber() {
  const blockNumber = await web3.eth.getBlockNumber();
  console.log("Current block:", blockNumber);
}
```

### Using with Ethers.js

```javascript
const { JsonRpcProvider } = require("ethers");

const provider = new JsonRpcProvider("http://localhost:3000/exec/YOUR-API-KEY");

async function getBlockNumber() {
  const blockNumber = await provider.getBlockNumber();
  console.log("Current block:", blockNumber);
}
```

## Rate Limiting

Each user has:

- **RPS Limit**: Requests per second (default: 20)
- **Daily Limit**: Total requests per day (default: 10,000)

Rate limiting uses a token bucket algorithm:

- Tokens refill at your RPS rate
- Bucket capacity equals your RPS limit
- Exceeding limits returns 429 status

## Monitoring and Metrics

The gateway exposes Prometheus metrics at `/metrics`:

### Key Metrics

- `rpc_gateway_requests_total`: Total requests by service/method
- `rpc_gateway_request_duration_seconds`: Request latency
- `rpc_gateway_errors_total`: Error count by status code
- `rpc_gateway_active_connections`: Active connections
- `rpc_gateway_rate_limit_hits_total`: Rate limit violations

### Grafana Dashboard

Create dashboards monitoring:

- Request rate and latency
- Error rates
- Rate limiting events
- User activity
- Node health

## Security

### Best Practices

1. **Environment Variables**: Never commit secrets
2. **JWT Secrets**: Use strong, unique secrets
3. **Rate Limiting**: Adjust limits based on your node capacity
4. **Network Security**: Run behind reverse proxy/firewall
5. **HTTPS**: Always use TLS in production
6. **Input Validation**: All inputs are validated
7. **Error Handling**: No sensitive information in error messages

### Production Deployment

```bash
# Use process manager
pm2 start dist/server.js --name nodebridge-gateway

# Or with Docker
docker build -t nodebridge-gateway .
docker run -d -p 3000:3000 --env-file .env nodebridge-gateway
```

## Development

### Project Structure

```
src/
├── models/          # Database models
├── routes/          # API routes
├── middlewares/     # Express middlewares
├── services/        # Business logic
├── config/          # Configuration
└── server.ts        # Entry point

tests/
├── unit.test.ts     # Unit tests (no DB)
├── integration.test.ts
├── auth.test.ts
├── middleware.test.ts
├── proxy.test.ts
├── user.model.test.ts
├── metrics.simple.test.ts
├── setup.ts         # Test setup
└── helpers/         # Test utilities
```

### Adding New Features

1. Create tests first
2. Implement feature
3. Update documentation
4. Test thoroughly

### Contributing

1. Fork the repository
2. Create feature branch
3. Add tests
4. Submit pull request

## Troubleshooting

### Common Issues

**MongoDB Connection Issues**

```bash
# Check MongoDB is running
mongosh

# Check connection string in .env
```

**Rate Limiting Too Strict**

```bash
# Adjust in .env
DEFAULT_MAX_RPS=50
DEFAULT_DAILY_REQUESTS=50000
```

**Node Connection Issues**

```bash
# Verify node endpoints
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Test Issues

**MongoDB Memory Server Issues**

```bash
# Run unit tests only (no MongoDB required)
yarn jest --selectProjects unit-tests

# Or install required libraries
sudo apt-get install libssl1.1  # For libcrypto.so.1.1
```

**Port Conflicts**

```bash
# Change port in .env
PORT=3001
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:

1. Check existing issues
2. Create new issue with details
3. Include logs and configuration (redacted)

---

**Note**: This is a development/personal use gateway. For production use with external users, consider additional security measures, monitoring, and scaling solutions.
