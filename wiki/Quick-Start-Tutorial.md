# Quick Start Tutorial

Get NodeBridge RPC Gateway up and running in **15 minutes**! This tutorial will guide you through the essential steps to set up, register, create an application (App), and test your gateway.

## ✅ Prerequisites

Before starting, ensure you have:

- **Node.js 18+** installed
- **MongoDB 6.0+** running locally
- **An Ethereum Node (e.g., Sepolia testnet)** (execution + consensus) running and accessible. You'll need its RPC endpoint URLs.
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

Edit `.env` with your settings. Key fields to update:

```env
# Basic Configuration
PORT=8888
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/nodebridge_rpc_gateway # Updated DB name from previous examples

# Security (change in production!)
JWT_SECRET=your-super-secret-jwt-key-for-development
JWT_EXPIRES_IN=30d

# Example Ethereum Node Endpoints (for health checks or specific internal system features)
# The actual node URLs for your Apps will be configured via the Admin API later.
EXECUTION_RPC_URL=http://YOUR_ETHEREUM_NODE_IP:8545 # Replace with your node's execution URL
CONSENSUS_API_URL=http://YOUR_ETHEREUM_NODE_IP:5052 # Replace with your node's consensus URL

# Default daily request limit per App API key
DEFAULT_DAILY_REQUESTS=10000
```
*Note: `DEFAULT_APP_MAX_RPS` (default requests per second for an app) is set as a constant in the code (`src/config/constants.ts`).*

## 🗄️ Step 3: Database Setup

```bash
# Start MongoDB (if not running)
sudo systemctl start mongod # Or your OS equivalent

# Initialize database (creates indexes, etc.)
# This script might not exist or might need updates.
# For now, ensure MongoDB is running. The application will create collections on first use.
# If a `yarn setup` script is provided and documented for this version, run it.
# yarn setup
```

## 🎯 Step 4: Start the Gateway

```bash
# Start in development mode
yarn dev
```

You should see output similar to:
```
🚀 NodeBridge RPC Gateway started on port 8888
✅ Connected to MongoDB
...
✅ Server is ready!
```

## 🧪 Step 5: Test Basic Functionality & User Registration

### Test Health Check
```bash
curl http://localhost:8888/health
```
Expected response:
```json
{
  "status": "healthy",
  "timestamp": "...",
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
    "token": "YOUR_JWT_TOKEN_WILL_BE_HERE",
    "user": {
      "id": "USER_ID",
      "email": "test@example.com",
      "appCount": 0,
      "isAdmin": false,
      "createdAt": "..."
    }
  }
}
```
**📝 Note**: Save the `token` from the response. This is your **JWT User Token**, needed for authenticated actions like creating an App.

## ⛓️ Step 6: Admin - Configure a Chain (One-time Setup)

Before users can create Apps, an administrator must add at least one blockchain (Chain) to the system.

**1. Create an Admin User (if you haven't already):**
   You might need to do this directly in MongoDB for the very first admin, or use a setup script if provided.
   Example (manual MongoDB insertion - replace with actual hashed password if possible):
   ```javascript
   // In mongo shell, connected to your nodebridge_rpc_gateway DB:
   // db.users.insertOne({ email: "admin@example.com", password: "YOUR_BCRYPT_HASHED_ADMIN_PASSWORD", isAdmin: true, isActive: true, appCount: 0, createdAt: new Date(), updatedAt: new Date() });
   ```
   Then, log in as admin to get an **Admin JWT Token**:
   ```bash
   curl -X POST http://localhost:8888/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@example.com",
       "password": "YOUR_ADMIN_PASSWORD"
     }'
   # Save the admin token from the response.
   ```

**2. Add a Chain (e.g., Ethereum Sepolia):**
   Replace `<ADMIN_JWT_TOKEN>` with the token obtained above.
   ```bash
   curl -X POST http://localhost:8888/admin/chains \
     -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "chainName": "Ethereum Sepolia",
       "chainId": "11155111",
       "description": "Ethereum Sepolia test network. Ensure your EXECUTION_RPC_URL and CONSENSUS_API_URL in the gateway ENV point to a Sepolia node if this is the primary chain for proxying."
     }'
   ```
   Expected response (201 Created):
   ```json
   {
       "chainName": "Ethereum Sepolia",
       "chainId": "11155111",
       "isEnabled": true,
       "description": "Ethereum Sepolia test network...",
       "_id": "CHAIN_MONGO_ID",
       "createdAt": "...",
       "updatedAt": "..."
   }
   ```
   *The gateway doesn't store node URLs per chain in this version; it relies on the globally configured `EXECUTION_RPC_URL` and `CONSENSUS_API_URL` for proxying. The `chainName` and `chainId` are for identification and association.*

## 📱 Step 7: Create an Application (App)

Now, as the registered user (`test@example.com`), create an App. Use the **User JWT Token** obtained in Step 5.

```bash
curl -X POST http://localhost:8888/apps \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MyTestAppOnSepolia",
    "description": "My first app for Sepolia",
    "chainName": "Ethereum Sepolia",
    "chainId": "11155111"
  }'
```
Expected response (201 Created):
```json
{
    "userId": "USER_ID",
    "name": "MyTestAppOnSepolia",
    "description": "My first app for Sepolia",
    "apiKey": "YOUR_NEW_APP_API_KEY_WILL_BE_HERE",
    "chainName": "Ethereum Sepolia",
    "chainId": "11155111",
    "maxRps": 20,
    "requests": 0,
    "dailyRequests": 0,
    "lastResetDate": "...",
    "isActive": true,
    "_id": "APP_MONGO_ID",
    "createdAt": "...",
    "updatedAt": "..."
}
```
**📝 Note**: Save the `apiKey` from this response. This is your **App API Key**, used for making RPC calls.

## 🔗 Step 8: Test RPC Endpoints with App API Key

Replace `YOUR_APP_API_KEY` with the key obtained in Step 7.

### Test Execution Layer (JSON-RPC)
```bash
curl -X POST http://localhost:8888/exec/YOUR_APP_API_KEY \
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
  "result": "0x..." // Current block number in hex
}
```

### Test Consensus Layer (Beacon API)
```bash
curl http://localhost:8888/cons/YOUR_APP_API_KEY/eth/v1/node/syncing
```
Expected response (will depend on your node's sync status):
```json
{
  "data": {
    "head_slot": "...",
    "sync_distance": "...",
    "is_syncing": false
  }
}
```

## 📊 Step 9: Check Metrics (Optional)
```bash
curl http://localhost:8888/metrics
```
You should see Prometheus metrics. Look for `rpc_gateway_requests_total` which will now have a label for `apiKey` if requests were made.

## 🎉 Success! What's Next?

Congratulations! Your NodeBridge RPC Gateway is running, and you've successfully created a user, an app, and made requests using an app-specific API key.

### 🔍 **Explore More Features**
- [Authentication API](Authentication-API) - More on user management.
- [Application Management](Home#application-app-management) - Managing your apps.
- [Admin Chain Management](Home#chain-management-admin-only) - For administrators.
- [Monitoring Setup](Monitoring-Setup) - Set up Grafana dashboards.
- [Production Deployment](Production-Deployment) - Deploy to production.

### 🛠️ **Development**
- [Development Setup](Development-Setup) - Set up your development environment.
- [Testing Guide](Testing-Guide) - Run the comprehensive test suite.
- [Contributing Guidelines](CONTRIBUTING.md) - Contribute to the project.

### 🚀 **Integration**
- [Web3.js Integration](Web3js-Integration) - Integrate with Web3.js (use your App API Key).
- [Ethers.js Integration](Ethersjs-Integration) - Integrate with Ethers.js (use your App API Key).

## 🔧 Quick Integration Examples

### With Web3.js
```javascript
const Web3 = require("web3");

// Use your NodeBridge gateway with your App API Key
const web3 = new Web3("http://localhost:8888/exec/YOUR_APP_API_KEY");

async function getLatestBlock() {
  const blockNumber = await web3.eth.getBlockNumber();
  console.log("Latest block:", blockNumber);
}
getLatestBlock();
```

### With Ethers.js
```javascript
const { JsonRpcProvider } = require("ethers");

// Use your NodeBridge gateway with your App API Key
const provider = new JsonRpcProvider("http://localhost:8888/exec/YOUR_APP_API_KEY");

async function getNetwork() {
  const network = await provider.getNetwork();
  console.log("Network:", network.name, "Chain ID:", network.chainId);
}
getNetwork();
```

## ❗ Troubleshooting
(Troubleshooting section remains largely the same, ensure URLs in examples are correct)

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
- Verify your Ethereum node (e.g., Sepolia node) is running and accessible at the URLs specified in your gateway's `.env` file (`EXECUTION_RPC_URL`, `CONSENSUS_API_URL`).
- Test direct connection to your node:
  ```bash
  curl -X POST YOUR_ETHEREUM_NODE_IP:8545 \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
  ```

### Need Help?
- 📖 Check the [Troubleshooting Guide](Troubleshooting)
- 💬 Start a [Discussion](https://github.com/NodeBridge-Africa/rpc_gateway/discussions)
- 🐛 Report issues on [GitHub](https://github.com/NodeBridge-Africa/rpc_gateway/issues)

---
**🎯 Next Steps**: Explore the [full documentation](Home) for advanced features.The `wiki/Quick-Start-Tutorial.md` file has been updated.

Now, I will review and update `wiki/FAQ.md`.
First, I need to read its content.
