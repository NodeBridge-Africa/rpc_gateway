# API Routes Documentation

This document provides a detailed overview of all available API routes for the NodeBridge RPC Gateway.

## Authentication Routes (`src/routes/auth.routes.ts`)

These routes handle user registration, login, account management, and API key generation.

### Register New User
- **Method**: `POST`
- **Path**: `/auth/register`
- **Description**: Registers a new user.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "token": "jwt.token.string",
      "apiKey": "user-api-key",
      "user": {
        "id": "user-id",
        "email": "user@example.com",
        "apiKey": "user-api-key",
        "maxRps": 20,
        "dailyRequestLimit": 10000,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    }
  }
  ```
- **Example cURL**:
  ```bash
  curl -X POST http://localhost:8888/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "email": "developer@example.com",
      "password": "SecurePassword123!"
    }'
  ```

### User Login
- **Method**: `POST`
- **Path**: `/auth/login`
- **Description**: Logs in an existing user.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response**: (Similar to registration)
  ```json
  {
    "success": true,
    "data": {
      "token": "jwt.token.string",
      "apiKey": "user-api-key",
      "user": {
        "id": "user-id",
        "email": "user@example.com",
        "apiKey": "user-api-key",
        "maxRps": 20,
        "dailyRequestLimit": 10000,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    }
  }
  ```
- **Example cURL**:
  ```bash
  curl -X POST http://localhost:8888/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "developer@example.com",
      "password": "SecurePassword123!"
    }'
  ```

### Get Account Information
- **Method**: `GET`
- **Path**: `/auth/account`
- **Description**: Retrieves account information for the authenticated user.
- **Authentication**: Bearer Token required.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "user-id",
        "email": "user@example.com",
        "apiKey": "user-api-key",
        "maxRps": 20,
        "dailyRequestLimit": 10000,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    }
  }
  ```
- **Example cURL**:
  ```bash
  curl -X GET http://localhost:8888/auth/account \
    -H "Authorization: Bearer YOUR_JWT_TOKEN"
  ```

### Regenerate API Key
- **Method**: `POST`
- **Path**: `/auth/regenerate-api-key`
- **Description**: Generates a new API key for the authenticated user.
- **Authentication**: Bearer Token required.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "apiKey": "new-user-api-key"
    }
  }
  ```
- **Example cURL**:
  ```bash
  curl -X POST http://localhost:8888/auth/regenerate-api-key \
    -H "Authorization: Bearer YOUR_JWT_TOKEN"
  ```

### Get Usage Statistics
- **Method**: `GET`
- **Path**: `/auth/usage`
- **Description**: Retrieves API usage statistics for the authenticated user.
- **Authentication**: Bearer Token required.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "usage": {
        "dailyRequests": 500,
        "totalRequests": 12000,
        "lastRequestAt": "2024-01-01T10:00:00.000Z"
      }
    }
  }
  ```
- **Example cURL**:
  ```bash
  curl -X GET http://localhost:8888/auth/usage \
    -H "Authorization: Bearer YOUR_JWT_TOKEN"
  ```

## Admin Routes (`src/routes/admin.routes.ts`)

These routes are for administrative purposes, such as checking node health and metrics. Access to these routes might be restricted.

### Get Node Health
- **Method**: `GET`
- **Path**: `/admin/node-health/:chain`
- **Description**: Checks the health of the node infrastructure for a specific chain.
- **Path Parameters**:
  - `chain`: The name of the blockchain (e.g., `ethereum`, `sepolia`).
- **Response**:
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
- **Example cURL**:
  ```bash
  curl -X GET http://localhost:8888/admin/node-health/sepolia
  ```

### Get Node Metrics Summary
- **Method**: `GET`
- **Path**: `/admin/node-metrics/:chain`
- **Description**: Retrieves a summary of metrics for the specified chain's nodes.
- **Path Parameters**:
  - `chain`: The name of the blockchain (e.g., `ethereum`, `sepolia`).
- **Response**:
  ```json
  {
    "chain": "sepolia",
    "metrics": {
      "executionNode": {
        "pendingTransactions": 10,
        "gasPrice": "20000000000",
        "latestBlock": "1234567"
      },
      "consensusNode": {
        "peersConnected": 50,
        "syncProgress": "99.99%"
      }
    }
  }
  ```
- **Example cURL**:
  ```bash
  curl -X GET http://localhost:8888/admin/node-metrics/sepolia
  ```

### Update App Limits
- **Method**: `PUT`
- **Path**: `/admin/apps/:appId/limits`
- **Description**: Updates the rate limits (maxRps and/or dailyRequestsLimit) for a specific application. Admin access required.
- **Path Parameters**:
  - `appId` (string, MongoDB ObjectId): ID of the application to update.
- **Headers**:
  - `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- **Request Body (JSON)**:
  ```json
  {
    "maxRps": 50,
    "dailyRequestsLimit": 20000
  }
  ```
  *At least one of `maxRps` or `dailyRequestsLimit` must be provided.*
- **Success Response (200 OK)**:
  - **Content**: The application object with updated limits.
  - **Example**:
    ```json
    {
      "success": true,
      "message": "App limits updated successfully.",
      "data": {
        "app": {
          "_id": "app_id_here",
          "name": "My Test App",
          "userId": "user_id_here",
          "apiKey": "generated_api_key_here",
          "chainName": "Sepolia",
          "chainId": "11155111",
          "maxRps": 50,
          "dailyRequestsLimit": 20000,
          "isActive": true,
          "createdAt": "2024-03-10T10:00:00.000Z",
          "updatedAt": "2024-03-10T10:00:00.000Z"
        }
      }
    }
    ```
- **Error Responses**:
  - `400 Bad Request`: Invalid input (e.g., `appId` not provided, no limits provided, invalid limit values).
  - `401 Unauthorized`: Missing or invalid admin token.
  - `403 Forbidden`: Token does not have admin privileges.
  - `404 Not Found`: Application with the given `appId` not found.
- **Example cURL**:
  ```bash
  curl -X PUT http://localhost:8888/admin/apps/YOUR_APP_ID/limits \
    -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "maxRps": 100,
      "dailyRequestsLimit": 50000
    }'
  ```

### Update App Details
- **Method**: `PATCH`
- **Path**: `/admin/apps/:appId`
- **Description**: Updates details for a specific application. Admin access required.
- **Path Parameters**:
  - `appId` (string, MongoDB ObjectId): ID of the application to update.
- **Headers**:
  - `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- **Request Body (JSON)**:
  - A JSON object containing the fields to update. All fields are optional.
  - **Updatable Fields**:
    - `name` (string, min 1, max 100)
    - `description` (string, max 500, can be empty)
    - `userId` (string, MongoDB ObjectId, ID of the user owning the app)
    - `chainName` (string, min 1, max 50)
    - `chainId` (string, min 1, max 50)
    - `maxRps` (integer, min 0)
    - `dailyRequestsLimit` (integer, min 0)
    - `isActive` (boolean)
    - `apiKey` (string, UUID v4 - for setting a new specific key. If empty string, it's ignored.)
    - `requests` (integer, min 0 - for resetting/adjusting counter)
    - `dailyRequests` (integer, min 0 - for resetting/adjusting counter)
    - `lastResetDate` (string, ISO 8601 date - for manually triggering a reset)
  - **Example Request**:
    ```json
    {
      "name": "Updated App Name",
      "maxRps": 50,
      "isActive": false
    }
    ```
- **Success Response (200 OK)**:
  - **Content**: The updated application object.
  - **Example**:
    ```json
    {
      "success": true,
      "message": "App details updated successfully.",
      "data": {
        "app": {
          "_id": "app_id_here",
          "name": "Updated App Name",
          "description": "Original Description",
          "userId": "user_id_here",
          "apiKey": "original_api_key_here",
          "chainName": "Sepolia",
          "chainId": "11155111",
          "maxRps": 50,
          "dailyRequestsLimit": 1000,
          "requests": 0,
          "dailyRequests": 0,
          "lastResetDate": "2024-03-10T10:00:00.000Z",
          "isActive": false,
          "createdAt": "2024-03-10T10:00:00.000Z",
          "updatedAt": "2024-03-11T12:00:00.000Z"
        }
      }
    }
    ```
- **Error Responses**:
  - `400 Bad Request`: Invalid input (e.g., validation error on fields, malformed App ID, empty request body).
  - `401 Unauthorized`: Missing or invalid admin token.
  - `403 Forbidden`: Token does not have admin privileges.
  - `404 Not Found`: Application with the given `appId` not found.
- **Example cURL**:
  ```bash
  curl -X PATCH http://localhost:8888/admin/apps/YOUR_APP_ID \
    -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "My Super DApp Renamed",
      "isActive": true,
      "description": "Now with more features!"
    }'
  ```

### Update User Details
- **Method**: `PATCH`
- **Path**: `/admin/users/:userId`
- **Description**: Updates details for a specific user. Admin access required.
- **Path Parameters**:
  - `userId` (string, MongoDB ObjectId): ID of the user to update.
- **Headers**:
  - `Authorization: Bearer <ADMIN_JWT_TOKEN>`
- **Request Body (JSON)**:
  - A JSON object containing the fields to update. All fields are optional.
  - **Updatable Fields**:
    - `email` (string, valid email format)
    - `password` (string, min 8, max 128 characters - for changing/setting password)
    - `isActive` (boolean)
  - **Example Request**:
    ```json
    {
      "email": "newuseremail@example.com",
      "isActive": true
    }
    ```
- **Success Response (200 OK)**:
  - **Content**: The updated user object (password field will be excluded).
  - **Example**:
    ```json
    {
      "success": true,
      "message": "User details updated successfully.",
      "data": {
        "user": {
          "_id": "user_id_here",
          "email": "newuseremail@example.com",
          "isActive": true,
          "apiKey": "user_api_key_here", 
          "maxRps": 20, 
          "dailyRequestsLimit": 10000, 
          "requests": 0,
          "dailyRequests": 0,
          "lastResetDate": "2024-03-10T00:00:00.000Z",
          "createdAt": "2024-03-10T00:00:00.000Z",
          "updatedAt": "2024-03-11T13:00:00.000Z"
        }
      }
    }
    ```
- **Error Responses**:
  - `400 Bad Request`: Invalid input (e.g., validation error, malformed User ID, empty request body, empty password string).
  - `401 Unauthorized`: Missing or invalid admin token.
  - `403 Forbidden`: Token does not have admin privileges.
  - `404 Not Found`: User with the given `userId` not found.
  - `409 Conflict`: If trying to update email to one that already exists.
- **Example cURL**:
  ```bash
  curl -X PATCH http://localhost:8888/admin/users/USER_ID_TO_UPDATE \
    -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "isActive": false,
      "email": "deactivated.user@example.com"
    }'
  ```

## Proxy Routes (`src/routes/proxy.routes.ts`)

These routes proxy requests to your Ethereum execution and consensus layer nodes. They require an API key.

### Execution Layer RPC Proxy
- **Method**: `POST` (typically, but supports other methods the node supports)
- **Path**: `/:chain/exec/:apiKey/...`
- **Description**: Proxies JSON-RPC requests to the execution layer node for the specified chain. The path after `/:apiKey/` is forwarded to the node.
- **Path Parameters**:
  - `chain`: The name of the blockchain (e.g., `ethereum`, `sepolia`).
  - `apiKey`: Your unique API key.
- **Request Body**: Standard Ethereum JSON-RPC payload.
  ```json
  {
    "jsonrpc": "2.0",
    "method": "eth_blockNumber",
    "params": [],
    "id": 1
  }
  ```
- **Response**: Standard Ethereum JSON-RPC response.
  ```json
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": "0x123abc"
  }
  ```
- **Example cURL**:
  ```bash
  curl -X POST http://localhost:8888/sepolia/exec/YOUR_API_KEY \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "method": "eth_blockNumber",
      "params": [],
      "id": 1
    }'
  ```

### Consensus Layer Beacon API Proxy
- **Method**: `GET` (typically, but supports other methods the node supports)
- **Path**: `/:chain/cons/:apiKey/...`
- **Description**: Proxies requests to the Beacon API of the consensus layer node for the specified chain. The path after `/:apiKey/` is forwarded to the node.
- **Path Parameters**:
  - `chain`: The name of the blockchain (e.g., `ethereum`, `sepolia`).
  - `apiKey`: Your unique API key.
- **Response**: Response from the Beacon API. For example, for `/eth/v1/node/syncing`:
  ```json
  {
    "data": {
      "head_slot": "7685000",
      "sync_distance": "0",
      "is_syncing": false
    }
  }
  ```
- **Example cURL**:
  ```bash
  curl -X GET http://localhost:8888/sepolia/cons/YOUR_API_KEY/eth/v1/node/syncing
  ```

## General Endpoints

Endpoints for general gateway status and metrics.

### Gateway Health Check
- **Method**: `GET`
- **Path**: `/health`
- **Description**: General health check for the NodeBridge RPC Gateway itself.
- **Response**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "version": "1.0.0",
    "environment": "development"
  }
  ```
- **Example cURL**:
  ```bash
  curl -X GET http://localhost:8888/health
  ```

### Chain Proxy Health Check
- **Method**: `GET`
- **Path**: `/health/:chain`
- **Description**: Checks the proxy connection health to the configured nodes for a specific chain.
- **Path Parameters**:
  - `chain`: The name of the blockchain (e.g., `ethereum`, `sepolia`).
- **Response Example**:
  ```json
  {
    "chain": "sepolia",
    "execution": {
      "status": "healthy",
      "message": "Successfully connected to execution node"
    },
    "consensus": {
      "status": "healthy",
      "message": "Successfully connected to consensus node"
    },
    "overall": "healthy"
  }
  ```
- **Example cURL**:
  ```bash
  curl -X GET http://localhost:8888/health/sepolia
  ```

### Prometheus Metrics
- **Method**: `GET`
- **Path**: `/metrics`
- **Description**: Exposes Prometheus metrics for monitoring.
- **Response**: Prometheus metrics format (text-based).
- **Example cURL**:
  ```bash
  curl -X GET http://localhost:8888/metrics
  ```
