// Copy this file to .env in the root directory and update the values.
// Ensure that all placeholder values, especially secrets and keys, are replaced with your actual production values.

/*
# -----------------------------------------------------------------------------
# Server Configuration
# -----------------------------------------------------------------------------

# PORT: The port on which the NodeBridge RPC Gateway server will listen.
# Default: 8888
# Example: PORT=8888
PORT=8888

# NODE_ENV: The runtime environment for the application.
# Affects logging, error handling, and potentially other behaviors.
# Options: development | test | production
# Example: NODE_ENV=development
NODE_ENV=development

# -----------------------------------------------------------------------------
# MongoDB Configuration
# -----------------------------------------------------------------------------

# MONGO_URI: The connection string for your MongoDB database.
# This database stores user accounts, API keys, and usage statistics.
# Example (local development): mongodb://localhost:27017/nodebridge_dev
# Example (production with auth): mongodb://rpcadmin:YOUR_STRONG_DB_PASSWORD@127.0.0.1:27017/nodebridge_prod
# Example (MongoDB Atlas): mongodb+srv://YOUR_USER:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/nodebridge_prod
MONGO_URI=mongodb://rpcadmin:STRONG_DB_PASSWORD@127.0.0.1:27017/rpcaas

# -----------------------------------------------------------------------------
# Security Configuration
# -----------------------------------------------------------------------------

# JWT_SECRET: A long, random, and secret string used to sign and verify JSON Web Tokens (JWTs).
# This is critical for securing user authentication.
# **IMPORTANT**: Change this in production to a strong, unique secret. Consider using a password generator.
# Example: JWT_SECRET='your-very-secure-and-long-jwt-secret-key-please-change-this-for-production-environments'
JWT_SECRET=your-super-secure-jwt-secret-key-here-please-change-this-to-something-secure

# ------------------------------------------------------------------------------------
# DYNAMIC MULTI-CHAIN CONFIGURATION
# ------------------------------------------------------------------------------------
# Define configurations for each blockchain you want to support by prefixing
# the variables with a unique chain name (e.g., ETHEREUM_, SEPOLIA_, MYCUSTOMCHAIN_).
# The prefix (in lowercase) will be used as the chain identifier in API routes (e.g., /ethereum/exec, /sepolia/cons).
# Supported suffixes:
#   _EXECUTION_RPC_URL: (Required for execution layer access) URL for the chain's execution layer JSON-RPC endpoint.
#                       Can be a single URL or a comma-separated list of URLs for load balancing (e.g., "http://node1:8545,http://node2:8545").
#   _CONSENSUS_API_URL: (Required for consensus layer access) URL for the chain's consensus layer Beacon API endpoint.
#                       Can be a single URL or a comma-separated list of URLs for load balancing (e.g., "http://beacon1:5052,http://beacon2:5052").
#   _PROMETHEUS_URL:    (Optional) URL for a Prometheus instance specific to this chain's nodes.
#
# At least _EXECUTION_RPC_URL or _CONSENSUS_API_URL must be provided for a chain to be functional.

# Example: Ethereum Mainnet (replace with your actual URLs)
ETHEREUM_EXECUTION_RPC_URL="http://localhost:8545,http://eth-mainnet-backup:8545"
ETHEREUM_CONSENSUS_API_URL="http://localhost:5052,http://eth-mainnet-beacon-backup:5052"
# ETHEREUM_PROMETHEUS_URL=http://localhost:9091

# Example: Sepolia Testnet (using a public provider, replace YOUR_PROJECT_ID)
SEPOLIA_EXECUTION_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID,https://another-sepolia-provider.io/v3/YOUR_OTHER_PROJECT_ID"
SEPOLIA_CONSENSUS_API_URL="https://sepolia-beacon.infura.io/v3/YOUR_INFURA_PROJECT_ID,https://another-sepolia-beacon-provider.io/v3/YOUR_OTHER_PROJECT_ID"
# SEPOLIA_PROMETHEUS_URL=

# Example: Holesky Testnet (Execution layer only)
HOLESKY_EXECUTION_RPC_URL="https://rpc.holesky.ethpandaops.io,https://holesky-backup-rpc.example.com"
# HOLESKY_CONSENSUS_API_URL= (not configured for this example)

# Example: A custom chain named 'ENTERPRISE' (ensure prefix is uppercase in .env)
# ENTERPRISE_EXECUTION_RPC_URL="http://10.0.0.5:8545,http://10.0.0.6:8545"
# ENTERPRISE_CONSENSUS_API_URL="http://10.0.0.5:5052,http://10.0.0.6:5052"

# -----------------------------------------------------------------------------
# Rate Limiting Configuration
# -----------------------------------------------------------------------------

# DEFAULT_MAX_RPS: The default maximum requests per second (RPS) allowed for new users.
# This can be overridden on a per-user basis.
# Example: DEFAULT_MAX_RPS=20
DEFAULT_MAX_RPS=20

# DEFAULT_DAILY_REQUESTS: The default maximum number of requests allowed per day for new users.
# This can be overridden on a per-user basis.
# Example: DEFAULT_DAILY_REQUESTS=10000
DEFAULT_DAILY_REQUESTS=10000

# -----------------------------------------------------------------------------
# Metrics and Monitoring Configuration
# -----------------------------------------------------------------------------

# ENABLE_METRICS: Boolean to enable or disable the Prometheus metrics endpoint (`/metrics`).
# This is a general toggle for the gateway's own metrics.
# Chain-specific Prometheus instances can be configured above using <CHAIN_NAME>_PROMETHEUS_URL.
# Default: true
# Example: ENABLE_METRICS=true
ENABLE_METRICS=true

*/
