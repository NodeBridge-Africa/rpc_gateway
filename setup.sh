#!/bin/bash

# NodeBridge RPC Gateway Setup Script
echo "🚀 Setting up NodeBridge RPC Gateway..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18 or higher. Current version: $(node -v)"
    exit 1
fi

print_status "Node.js version: $(node -v) ✓"

# Check if Yarn is installed
if ! command -v yarn &> /dev/null; then
    print_warning "Yarn is not installed. Installing yarn..."
    npm install -g yarn
fi

print_status "Yarn version: $(yarn -v) ✓"

# Install dependencies
print_status "Installing dependencies..."
yarn install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi

print_status "Dependencies installed successfully ✓"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating .env file..."
    cat > .env << EOF
# MongoDB Configuration
MONGO_URI=mongodb://rpcadmin:STRONG_DB_PASSWORD@127.0.0.1:27017/rpcaas

# JWT Secret for authentication (CHANGE THIS!)
JWT_SECRET=$(openssl rand -base64 32)

# Server Configuration
PORT=8888
NODE_ENV=development

# Metrics
ENABLE_METRICS=true

# Default Rate Limiting (for new users)
DEFAULT_MAX_RPS=20
DEFAULT_DAILY_REQUESTS=10000

# ------------------------------------------------------------------------------------
# DYNAMIC MULTI-CHAIN CONFIGURATION
# ------------------------------------------------------------------------------------
# Define configurations for each blockchain by prefixing variables with a chain name
# (e.g., ETHEREUM_, SEPOLIA_). The prefix (lowercase) is used in API routes.
# Supported suffixes: _EXECUTION_RPC_URL, _CONSENSUS_API_URL, _PROMETHEUS_URL (optional)

# Example: Ethereum Mainnet (uncomment and update with your actual URLs if needed)
# ETHEREUM_EXECUTION_RPC_URL=http://127.0.0.1:8545
# ETHEREUM_CONSENSUS_API_URL=http://127.0.0.1:5052
# ETHEREUM_PROMETHEUS_URL=http://127.0.0.1:9091

# Example: Sepolia Testnet (defaulted to local, update if using public provider)
# RPC URLs can be a single URL or a comma-separated list for load balancing e.g., "http://node1:port,http://node2:port"
SEPOLIA_EXECUTION_RPC_URL="http://127.0.0.1:8546,http://127.0.0.1:8547"
SEPOLIA_CONSENSUS_API_URL="http://127.0.0.1:5053,http://127.0.0.1:5054"
# For public providers, comment lines above and uncomment below (ensure to use comma-separated format if needed):
# SEPOLIA_EXECUTION_RPC_URL="https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID,https://another-sepolia-provider.com/YOUR_KEY"
# SEPOLIA_CONSENSUS_API_URL="https://sepolia-beacon.infura.io/v3/YOUR_INFURA_PROJECT_ID,https://another-sepolia-beacon.com/YOUR_KEY"
# SEPOLIA_PROMETHEUS_URL=
EOF
    print_status ".env file created with secure JWT secret ✓"
else
    print_warning ".env file already exists. Skipping creation."
fi

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    print_warning "MongoDB is not installed."
    echo "To install MongoDB on Ubuntu/Debian:"
    echo "  wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -"
    echo "  echo 'deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse' | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list"
    echo "  sudo apt-get update"
    echo "  sudo apt-get install -y mongodb-org"
    echo "  sudo systemctl enable --now mongod"
else
    # Check if MongoDB is running
    if systemctl is-active --quiet mongod; then
        print_status "MongoDB is running ✓"
    else
        print_warning "MongoDB is installed but not running. Starting MongoDB..."
        sudo systemctl start mongod
        if systemctl is-active --quiet mongod; then
            print_status "MongoDB started successfully ✓"
        else
            print_error "Failed to start MongoDB"
        fi
    fi
fi

# Create MongoDB user (if MongoDB is running)
if systemctl is-active --quiet mongod; then
    print_status "Setting up MongoDB database and user..."
    mongo --eval "
    use rpcaas;
    try {
        db.createUser({
            user: 'rpcadmin',
            pwd: 'STRONG_DB_PASSWORD',
            roles: [{ role: 'readWrite', db: 'rpcaas' }]
        });
        print('Database user created successfully');
    } catch(e) {
        if (e.code === 11000) {
            print('Database user already exists');
        } else {
            print('Error creating user: ' + e);
        }
    }
    " 2>/dev/null && print_status "Database setup complete ✓" || print_warning "Could not setup database user (might already exist)"
fi

# Build TypeScript
print_status "Building TypeScript..."
yarn build

if [ $? -ne 0 ]; then
    print_warning "TypeScript build failed. This is normal if there are missing dependencies."
    print_warning "Run 'yarn dev' to start in development mode."
else
    print_status "TypeScript build successful ✓"
fi

# Final instructions
echo ""
print_status "Setup complete! 🎉"
echo ""
echo "Next steps:"
echo "1. Review .env:"
echo "   - Ensure MONGO_URI matches your MongoDB setup. The script attempts to create a user 'rpcadmin' with password 'STRONG_DB_PASSWORD'."
echo "   - Configure your desired blockchain RPC URLs. Examples for Sepolia are provided."
echo "     For each chain (e.g., 'sepolia', 'ethereum'), you can define:"
echo "       <CHAIN_NAME_UPPERCASE>_EXECUTION_RPC_URL=http://..."
echo "       <CHAIN_NAME_UPPERCASE>_CONSENSUS_API_URL=http://..."
echo "       <CHAIN_NAME_UPPERCASE>_PROMETHEUS_URL=http://... (optional)"
echo "     The <CHAIN_NAME_LOWERCASE> will be part of the API path (e.g., /sepolia/exec/...)"

echo "2. Start the gateway:"
echo "   Development: yarn dev"
echo "   Production:  yarn start"
echo ""
echo "API will be available at: http://localhost:8888 (or your configured PORT)"
echo "Useful Endpoints (replace <API_KEY> and <chain> as needed):"
echo "  - API Info:           GET /"
echo "  - Health Check:       GET /health"
echo "  - Prometheus Metrics: GET /metrics"
echo "  - Auth Register:      POST /auth/register"
echo "  - Auth Login:         POST /auth/login"
echo "  - Auth Account:       GET /auth/account"
echo "  - RPC Execution:      ALL /<chain>/exec/<API_KEY>/*"
echo "  - RPC Consensus:      ALL /<chain>/cons/<API_KEY>/*"
echo "  - RPC Health:         GET /health/<chain>"
echo "  - App Management:     POST /api/v1/apps, GET /api/v1/apps"
echo "  - Admin Routes:       GET /admin/node-health/<chain>, GET /admin/chains, etc."
echo "  - Default Settings:   GET /api/v1/admin/settings/app-defaults"

echo ""
print_status "Happy coding! 🚀" 