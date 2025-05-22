// Copy this file to .env in the root directory and update the values

/*
# MongoDB Configuration
MONGO_URI=mongodb://rpcadmin:STRONG_DB_PASSWORD@127.0.0.1:27017/rpcaas

# JWT Secret for authentication
JWT_SECRET=your-super-secure-jwt-secret-key-here-please-change-this-to-something-secure

# Server Configuration
PORT=8888
NODE_ENV=development

# Sepolia Node Endpoints (local)
EXECUTION_RPC_URL=http://127.0.0.1:8545
CONSENSUS_API_URL=http://127.0.0.1:5052

# Rate Limiting (default values)
DEFAULT_MAX_RPS=20
DEFAULT_DAILY_REQUESTS=10000

# Metrics
ENABLE_METRICS=true
*/

export const requiredEnvVars = [
  "MONGO_URI",
  "JWT_SECRET",
  "EXECUTION_RPC_URL",
  "CONSENSUS_API_URL",
] as const;

export function validateEnv() {
  const missing = requiredEnvVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}
