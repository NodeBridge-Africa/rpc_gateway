# Frequently Asked Questions (FAQ)

Common questions and answers about NodeBridge RPC Gateway.

## 🔄 **General Questions**

### What is NodeBridge RPC Gateway?

NodeBridge is a production-ready, multi-tenant RPC gateway that provides controlled access to your private Ethereum node infrastructure (and potentially other blockchains). It's similar to services like Alchemy or Infura, but designed for your own nodes, giving you more control.

### How is NodeBridge different from Alchemy or Infura?

- **Your Infrastructure**: NodeBridge runs on your own servers with your own blockchain nodes.
- **Full Control**: Complete control over rate limits, access, and data. Users create "Apps" to get API keys for specific chains.
- **Cost Effective**: No per-request charges after initial setup.
- **Privacy**: All data stays within your infrastructure.
- **Customizable**: Open source and fully customizable. Administrators manage which blockchains are available.

### What Ethereum networks are supported?

The gateway can support any EVM-compatible chain (and potentially other types of chains). Administrators configure available "Chains" (e.g., Ethereum Mainnet, Sepolia, Polygon, etc.) in the system. Users then create an "App" for a specific, admin-configured Chain to get an API key. The initial setup might focus on Ethereum Sepolia, but it's designed to be multi-chain.

## 🛠️ **Installation & Setup**

### What are the system requirements?

**Minimum Requirements:**

- Node.js 18+
- MongoDB 6.0+
- 2GB RAM
- 10GB storage

**Recommended for Production:**

- Node.js 18+ LTS
- MongoDB 6.0+ (replica set)
- 8GB+ RAM
- 50GB+ SSD storage
- Reverse proxy (Nginx/Apache)

### How do I update NodeBridge to the latest version?

```bash
# Pull latest changes
git pull origin main # Or the relevant branch

# Update dependencies
yarn install

# Rebuild
yarn build

# Restart the service (example with PM2)
pm2 restart nodebridge-gateway # Adjust if using a different process manager
```

### Can I run NodeBridge without a blockchain node?

No, NodeBridge is a gateway/proxy service that requires backend blockchain nodes to function. For each "Chain" an admin configures (e.g., Ethereum Sepolia), you need the corresponding node(s) (e.g., Geth for execution, Prysm for consensus if it's Ethereum).

## 🔐 **Authentication & Security**

### How do API keys work now?

1.  **User Registration & Login**: Users register an account and log in to get a JWT token.
2.  **Chain Configuration (Admin)**: An administrator must first configure available blockchains (Chains) in the system (e.g., "Ethereum Sepolia" with its `chainId`).
3.  **App Creation**: The authenticated user creates an "App" by specifying a name, description, and choosing one of the admin-configured Chains.
4.  **API Key Generation**: Upon App creation, the system generates a unique API key specifically for that App. This API key is tied to the chosen Chain.
5.  **RPC Access**: The App-specific API key is then used in RPC endpoint URLs (e.g., `/exec/<APP_API_KEY>`).
6.  **Rate Limiting**: Each App's API key has its own rate limits (RPS and daily).

### Can I regenerate API keys?

Currently, the system generates an API key when an App is created. There isn't a dedicated endpoint to regenerate an API key for an *existing* App. To get a new API key, a user would typically create a new App. Future enhancements could include API key rotation for an existing App.

### How many Apps can I create?
By default, users can create up to 5 Apps. This limit is currently set in the codebase and may become configurable in the future.

### How secure is NodeBridge?

NodeBridge implements multiple security layers:

- JWT authentication for user management.
- Unique API keys per user's Application (App).
- Rate limiting (RPS and daily limits) per App API key using a token bucket algorithm.
- Input validation and sanitization.
- Helmet.js security headers.
- Admin-only routes for managing Chains.
- MongoDB connection encryption support.

### Should I use HTTPS in production?

**Absolutely!** Always run NodeBridge behind a reverse proxy (Nginx/Apache) with SSL/TLS certificates in production to encrypt traffic.

## ⚡ **Rate Limiting**

### How does rate limiting work?

NodeBridge uses a **token bucket algorithm** applied **per App API key**:

- Each App API key has a bucket with capacity = `app.maxRps` (max requests per second for that app).
- Tokens refill at the App's `maxRps` rate.
- Each request using an App's API key consumes one token from its bucket.
- When an App's bucket is empty, its requests are rate limited (HTTP 429 status).
- There's also a daily request limit per App API key.

### What are the default rate limits for an App?

- **RPS Limit**: The default `maxRps` for a new App is set by the `DEFAULT_APP_MAX_RPS` constant (e.g., 20 requests per second). This might become configurable per chain or by an admin in the future.
- **Daily Limit**: The default daily request limit per App is set by the `DEFAULT_DAILY_REQUESTS` environment variable (e.g., 10,000 requests per day).

### Can I adjust rate limits for specific Apps?

Currently, `maxRps` is set to a default upon App creation. There isn't an API endpoint for users or admins to directly modify the `maxRps` or daily limit of an *existing* App. This could be a future enhancement.

### What happens when an App hits its rate limits?

- **RPS Limit**: HTTP 429 "Too Many Requests" with a `Retry-After` header.
- **Daily Limit**: HTTP 429 "Daily request limit exceeded" until the next day (UTC, as the reset logic is daily).

## 📊 **Monitoring & Metrics**

### What metrics are available?

NodeBridge exposes comprehensive Prometheus metrics. Key metrics include:

**Gateway Metrics:**

- `rpc_gateway_requests_total` (now includes an `apiKey` label to distinguish per-App requests)
- `rpc_gateway_request_duration_seconds` (also labeled by `apiKey`)
- `rpc_gateway_rate_limit_hits_total` (labeled by `apiKey`)
- `rpc_gateway_active_connections`

**Ethereum Node Metrics (if health checks are configured for specific chains):**

- `ethereum_execution_syncing`
- `ethereum_consensus_syncing`
- `ethereum_consensus_head_slot`
- `ethereum_node_health_status`

### How do I set up monitoring?

1.  **Prometheus**: Configure Prometheus to scrape the `/metrics` endpoint of the gateway.
2.  **Grafana**: Use Grafana to create dashboards. You can filter and aggregate metrics using the `apiKey` label to see per-App performance.
3.  **Alerting**: Configure alerts in Prometheus/Alertmanager for critical metrics (e.g., high error rates for an app, an app consistently hitting rate limits).

See the [Monitoring Setup](Monitoring-Setup) guide for more details.

## 🔌 **API & Integration**

### Can I use NodeBridge with Web3.js?

Yes! Point Web3.js to your NodeBridge endpoint, including your **App-specific API key**:

```javascript
const Web3 = require("web3");
const web3 = new Web3("http://your-gateway:8888/exec/YOUR_APP_API_KEY");
```

### Can I use NodeBridge with Ethers.js?

Yes! Configure Ethers.js provider with your **App-specific API key**:

```javascript
const { JsonRpcProvider } = require("ethers");
const provider = new JsonRpcProvider(
  "http://your-gateway:8888/exec/YOUR_APP_API_KEY"
);
```

### Are WebSockets supported?

Not currently. NodeBridge primarily supports HTTP/HTTPS for RPC requests. WebSocket support could be a future enhancement.

## 🚀 **Deployment & Production**

### How do I deploy NodeBridge to production?
(Refer to the [Production Deployment](Production-Deployment) guide. Key considerations remain similar, but ensure your node infrastructure can support the chains you plan to offer via the Admin API.)

### Can I run multiple NodeBridge instances?
Yes! NodeBridge is designed to be stateless. You can run multiple instances behind a load balancer.
- Share the same MongoDB database.
- For distributed rate limiting (if the in-memory store becomes a bottleneck at scale), an external store like Redis would be a future consideration.

## 🐛 **Troubleshooting**

### Common error messages and solutions

**"Invalid or inactive API key"**
- Ensure you are using an **App API Key**, not a user JWT token, in the RPC path (`/exec/YOUR_APP_API_KEY`).
- Verify the App associated with the API key is marked as `isActive: true`.
- Check that the API key was copied correctly.

**"User not found" or "Unauthorized" when creating an App**
- Ensure you are using a valid **User JWT Token** in the `Authorization: Bearer <TOKEN>` header for `/apps` routes.
- Make sure the user account exists and is active.

**"Invalid or disabled chain" when creating an App**
- Verify the `chainName` and `chainId` you provided match exactly what an administrator configured in the system.
- Check if the chain is marked as `isEnabled: true` by an admin.

**"MongoDB connection failed" / "Ethereum node connection failed" / "Port already in use" / "JWT token invalid"**
(These remain similar to previous versions, ensure configurations in `.env` are correct and services are running.)

## 📈 **Performance & Scaling**
(General guidance remains similar. Performance now also depends on the number of active Apps and their individual traffic patterns.)

## 🤝 **Contributing & Support**
(Refer to [Contributing Guidelines](CONTRIBUTING.md). When contributing, be mindful of the new App and Chain models and their interactions.)

---

## 🔍 **Still have questions?**
- 📖 Check the [full documentation](Home)
- 💬 Start a [GitHub Discussion](https://github.com/NodeBridge-Africa/rpc_gateway/discussions)
- 🐛 Report issues on [GitHub](https://github.com/NodeBridge-Africa/rpc_gateway/issues)
- 📧 Email: support@nodebridge.dev (or the relevant contact for the project)

**💡 Tip**: Use the search function in this wiki to quickly find information about specific topics!Okay, `wiki/Quick-Start-Tutorial.md` and `wiki/FAQ.md` have been updated.

Now, I will review and update `wiki/Home.md`.
First, I need to read its content.
