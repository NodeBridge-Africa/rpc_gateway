# Quick Start Tutorial

Get NodeBridge RPC Gateway up and running in **10 minutes**! This tutorial will guide you through the essential steps to set up and test your gateway.

## ✅ Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed
- **MongoDB 6.0+** running locally
- **Ethereum Sepolia node** (execution + consensus) running
- **Basic terminal knowledge**

## 🚀 Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/NodeBridge-Africa/rpc_gateway.git
cd rpc_gateway

# Install dependencies
yarn install

# Build the project
yarn build
```

## ⚙️ Step 2: Environment Configuration

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` with your settings:

```env
# Basic Configuration
PORT=8888
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/nodebridge

# Security (change in production!)
JWT_SECRET=your-super-secret-jwt-key-for-development

# Your Ethereum Node Endpoints
EXECUTION_RPC_URL=http://localhost:8545
CONSENSUS_API_URL=http://localhost:5052

# Rate Limiting
DEFAULT_MAX_RPS=20
DEFAULT_DAILY_REQUESTS=10000
```

## 🗄️ Step 3: Database Setup

```bash
# Start MongoDB (if not running)
sudo systemctl start mongod

# Initialize database
yarn setup
```

## 🎯 Step 4: Start the Gateway

```bash
# Start in development mode
yarn dev
```

You should see:

```
🚀 NodeBridge RPC Gateway started on port 8888
✅ Connected to MongoDB
✅ Metrics collection started
✅ Server is ready!
```

## 🧪 Step 5: Test Basic Functionality

### Test Health Check

```bash
curl http://localhost:8888/health
```

Expected response:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "environment": "development"
}
```

### Register a Test User

```bash
curl -X POST http://localhost:8888/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "apiKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "user": {
      "id": "...",
      "email": "test@example.com",
      "apiKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "maxRps": 20,
      "dailyRequestLimit": 10000
    }
  }
}
```

**📝 Note**: Save the `apiKey` from the response - you'll need it for RPC calls!

## 🔗 Step 6: Test RPC Endpoints

### Test Execution Layer (JSON-RPC)

```bash
# Replace YOUR_API_KEY with the apiKey from registration
# Replace 'sepolia' with your target chain if different
curl -X POST http://localhost:8888/sepolia/exec/YOUR_API_KEY \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_blockNumber",
    "params": [],
    "id": 1
  }'
```

Expected response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": "0x1234567"
}
```

### Test Consensus Layer (Beacon API)

```bash
# Replace YOUR_API_KEY with the apiKey from registration
# Replace 'sepolia' with your target chain if different
curl http://localhost:8888/sepolia/cons/YOUR_API_KEY/eth/v1/node/syncing
```

Expected response:

```json
{
  "data": {
    "head_slot": "7685000",
    "sync_distance": "0",
    "is_syncing": false
  }
}
```

## 📊 Step 7: Check Metrics

```bash
curl http://localhost:8888/metrics
```

You should see Prometheus metrics including:

- `rpc_gateway_requests_total`
- `ethereum_execution_syncing`
- `ethereum_consensus_head_slot`
- Node.js process metrics

## 🎉 Success! What's Next?

Congratulations! Your NodeBridge RPC Gateway is now running. Here's what you can do next:

### 🔍 **Explore More Features**

- [Authentication API](Authentication-API) - Learn about user management
- [Monitoring Setup](Monitoring-Setup) - Set up Grafana dashboards
- [Production Deployment](Production-Deployment) - Deploy to production

### 🛠️ **Development**

- [Development Setup](Development-Setup) - Set up development environment
- [Testing Guide](Testing-Guide) - Run the comprehensive test suite
- [Contributing Guidelines](Contributing-Guidelines) - Contribute to the project

### 🚀 **Integration**

- [Web3.js Integration](Web3js-Integration) - Integrate with Web3.js
- [Ethers.js Integration](Ethersjs-Integration) - Integrate with Ethers.js

## 🔧 Quick Integration Examples

### With Web3.js

```javascript
const Web3 = require("web3");

// Use your NodeBridge gateway
// Replace 'sepolia' with your target chain if different
const web3 = new Web3("http://localhost:8888/sepolia/exec/YOUR_API_KEY");

async function getLatestBlock() {
  const blockNumber = await web3.eth.getBlockNumber();
  console.log("Latest block:", blockNumber);
}

getLatestBlock();
```

### With Ethers.js

```javascript
const { JsonRpcProvider } = require("ethers");

// Use your NodeBridge gateway
// Replace 'sepolia' with your target chain if different
const provider = new JsonRpcProvider("http://localhost:8888/sepolia/exec/YOUR_API_KEY");

async function getNetwork() {
  const network = await provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);
}

getNetwork();
```

## ❗ Troubleshooting

### Common Issues

**Port Already in Use**

```bash
# Change port in .env
PORT=8889
```

**MongoDB Connection Failed**

```bash
# Check MongoDB is running
sudo systemctl status mongod

# Start MongoDB if needed
sudo systemctl start mongod
```

**Ethereum Node Connection Failed**

- Verify your Ethereum node is running
- Check `EXECUTION_RPC_URL` and `CONSENSUS_API_URL` in `.env`
- Test direct connection:

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Need Help?

- 📖 Check the [Troubleshooting Guide](Troubleshooting)
- 💬 Start a [Discussion](https://github.com/NodeBridge-Africa/rpc_gateway/discussions)
- 🐛 Report issues on [GitHub](https://github.com/NodeBridge-Africa/rpc_gateway/issues)

---

**🎯 Next Steps**: Now that you have a working gateway, explore the [full documentation](Home) to learn about advanced features, production deployment, and monitoring!
