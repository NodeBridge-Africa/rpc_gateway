# Frequently Asked Questions (FAQ)

Common questions and answers about NodeBridge RPC Gateway.

## 🔄 **General Questions**

### What is NodeBridge RPC Gateway?

NodeBridge is a production-ready, multi-tenant RPC gateway that provides controlled access to your private Ethereum Sepolia node infrastructure. It's similar to services like Alchemy or Infura, but designed for your own nodes.

### How is NodeBridge different from Alchemy or Infura?

- **Your Infrastructure**: NodeBridge runs on your own servers with your own Ethereum nodes
- **Full Control**: Complete control over rate limits, access, and data
- **Cost Effective**: No per-request charges after initial setup
- **Privacy**: All data stays within your infrastructure
- **Customizable**: Open source and fully customizable

### What Ethereum networks are supported?

Currently, NodeBridge is optimized for **Ethereum Sepolia** (testnet). Support for mainnet and other networks can be added by configuring the appropriate node endpoints.

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
git pull origin main

# Update dependencies
yarn install

# Rebuild
yarn build

# Restart the service
pm2 restart nodebridge-gateway
```

### Can I run NodeBridge without an Ethereum node?

No, NodeBridge is a gateway/proxy service that requires backend Ethereum nodes (execution + consensus layers) to function. You need:

- Execution layer node (e.g., Geth, Erigon)
- Consensus layer node (e.g., Prysm, Lighthouse)

## 🔐 **Authentication & Security**

### How do API keys work?

1. Users register via `/auth/register`
2. System generates a unique UUID API key
3. API key is used in RPC endpoint URLs: `/:chain/exec/<API_KEY>` (e.g., `/ethereum/exec/<API_KEY>`)
4. Each request is tracked and rate-limited per API key

### Can I regenerate API keys?

Yes! Use the `/auth/regenerate-api-key` endpoint with a valid JWT token.

### How secure is NodeBridge?

NodeBridge implements multiple security layers:

- JWT authentication for user management
- Unique API keys for RPC access
- Rate limiting with token bucket algorithm
- Input validation and sanitization
- Helmet.js security headers
- MongoDB connection encryption support

### Should I use HTTPS in production?

**Absolutely!** Always run NodeBridge behind a reverse proxy (Nginx/Apache) with SSL/TLS certificates in production.

## ⚡ **Rate Limiting**

### How does rate limiting work?

NodeBridge uses a **token bucket algorithm**:

- Each user has a bucket with capacity = max RPS
- Tokens refill at the user's RPS rate
- Each request consumes one token
- When bucket is empty, requests are rate limited (429 status)

### What are the default rate limits?

- **RPS Limit**: 20 requests per second
- **Daily Limit**: 10,000 requests per day

These can be configured per user or globally via environment variables.

### Can I adjust rate limits for specific users?

Yes! Rate limits are stored per user in MongoDB and can be modified:

```javascript
// Example: Update user rate limits
await User.findByIdAndUpdate(userId, {
  maxRps: 100,
  dailyRequestLimit: 1000000,
});
```

### What happens when I hit rate limits?

- **RPS Limit**: HTTP 429 with `Retry-After` header
- **Daily Limit**: HTTP 429 until next day (UTC)

## 📊 **Monitoring & Metrics**

### What metrics are available?

NodeBridge exposes comprehensive Prometheus metrics:

**Gateway Metrics:**

- `rpc_gateway_requests_total` - Total requests
- `rpc_gateway_request_duration_seconds` - Request latency
- `rpc_gateway_rate_limit_hits_total` - Rate limit violations
- `rpc_gateway_active_connections` - Active connections

**Ethereum Node Metrics:**

- `ethereum_execution_syncing` - Execution sync status
- `ethereum_consensus_syncing` - Consensus sync status
- `ethereum_consensus_head_slot` - Current head slot
- `ethereum_node_health_status` - Overall health

### How do I set up monitoring?

1. **Prometheus**: Scrape `/metrics` endpoint
2. **Grafana**: Import dashboard templates from wiki
3. **Alerting**: Configure alerts for critical metrics

See the [Monitoring Setup](Monitoring-Setup) guide for details.

### Can I disable metrics collection?

Metrics collection is built-in and cannot be completely disabled, but you can:

- Restrict access to `/metrics` endpoint
- Filter metrics in Prometheus configuration
- Set `PROMETHEUS_URL=""` to disable node health collection

## 🔌 **API & Integration**

### Can I use NodeBridge with Web3.js?

Yes! Simply point Web3.js to your NodeBridge endpoint, specifying the chain:

```javascript
const Web3 = require("web3");
const web3 = new Web3("http://your-gateway:8888/ethereum/exec/YOUR_API_KEY");
// Or for other chains: "http://your-gateway:8888/arbitrum/exec/YOUR_API_KEY"
```

### Can I use NodeBridge with Ethers.js?

Yes! Configure Ethers.js provider, specifying the chain:

```javascript
const { JsonRpcProvider } = require("ethers");
const provider = new JsonRpcProvider(
  "http://your-gateway:8888/ethereum/exec/YOUR_API_KEY"
  // Or for other chains: "http://your-gateway:8888/arbitrum/exec/YOUR_API_KEY"
);
```

### Are WebSockets supported?

Not currently. NodeBridge supports HTTP/HTTPS only. WebSocket support is planned for future releases.

### Can I use custom headers?

Yes, NodeBridge passes through most headers to the backend Ethereum node. Standard headers like `Content-Type` and `Authorization` (for JWT) are handled specially.

## 🚀 **Deployment & Production**

### How do I deploy NodeBridge to production?

See the [Production Deployment](Production-Deployment) guide. Key steps:

1. Set up production environment variables
2. Configure MongoDB replica set
3. Set up reverse proxy with SSL
4. Configure monitoring and alerting
5. Set up backup and recovery

### Can I run multiple NodeBridge instances?

Yes! NodeBridge is stateless (except for rate limiting state). You can:

- Run multiple instances behind a load balancer
- Share the same MongoDB database
- Use Redis for distributed rate limiting (future feature)

### How do I handle database backups?

MongoDB backup strategies:

- **mongodump/mongorestore** for simple backups
- **MongoDB Atlas** automated backups
- **Replica set** with delayed secondary for point-in-time recovery

### What about Docker deployment?

NodeBridge includes Docker support:

```bash
# Build image
docker build -t nodebridge-gateway .

# Run container
docker run -d -p 8888:8888 --env-file .env nodebridge-gateway
```

See [Docker Deployment](Docker-Deployment) for complete instructions.

## 🐛 **Troubleshooting**

### Common error messages and solutions

**"MongoDB connection failed"**

- Verify MongoDB is running: `sudo systemctl status mongod`
- Check connection string in `.env`
- Verify network connectivity

**"Ethereum node connection failed"**

- Verify your nodes are running and synced
- Check `EXECUTION_RPC_URL` and `CONSENSUS_API_URL`
- Test direct connection with curl

**"Port already in use"**

- Change `PORT` in `.env`
- Kill process using the port: `sudo lsof -ti:8888 | xargs kill -9`

**"JWT token invalid"**

- Check `JWT_SECRET` is set correctly
- Verify token hasn't expired
- Ensure you're using Bearer authentication

### How do I enable debug logging?

Set environment variable:

```bash
NODE_ENV=development
DEBUG=nodebridge:*
```

### Performance is slow, what should I check?

1. **Node health**: Check `/admin/node-health/:chain` (e.g., `/admin/node-health/ethereum`)
2. **Database performance**: Monitor MongoDB metrics
3. **Rate limiting**: Check if you're hitting limits
4. **Network latency**: Test direct node connection
5. **Resource usage**: Monitor CPU/memory/disk

## 📈 **Performance & Scaling**

### How many requests can NodeBridge handle?

Performance depends on:

- **Server resources** (CPU, RAM, network)
- **MongoDB performance**
- **Ethereum node performance**
- **Request complexity**

Typical performance: 100-1000 RPS per instance on modern hardware.

### How do I scale NodeBridge?

**Vertical Scaling:**

- Increase server resources
- Optimize MongoDB with indexes
- Use SSD storage

**Horizontal Scaling:**

- Run multiple NodeBridge instances
- Load balance with Nginx/HAProxy
- Use MongoDB replica sets

### Can I cache responses?

Not built-in, but you can:

- Add caching middleware (Redis)
- Cache at reverse proxy level
- Cache in client applications

**Note**: Be careful caching blockchain data as it changes frequently.

## 🤝 **Contributing & Support**

### How can I contribute to NodeBridge?

See the [Contributing Guidelines](Contributing-Guidelines) for:

- Code contributions
- Bug reports
- Feature requests
- Documentation improvements

### Where can I get help?

1. **Documentation**: Check this wiki first
2. **GitHub Issues**: Report bugs or request features
3. **GitHub Discussions**: Ask questions and share ideas
4. **Community**: Connect with other users

### Is commercial support available?

NodeBridge is open source. For commercial support, contact the maintainers through GitHub.

---

## 🔍 **Still have questions?**

- 📖 Check the [full documentation](Home)
- 💬 Start a [GitHub Discussion](https://github.com/NodeBridge-Africa/rpc_gateway/discussions)
- 🐛 Report issues on [GitHub](https://github.com/NodeBridge-Africa/rpc_gateway/issues)
- 📧 Email: support@nodebridge.dev

**💡 Tip**: Use the search function in this wiki to quickly find information about specific topics!
