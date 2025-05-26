# NodeBridge RPC Gateway Wiki

Welcome to the **NodeBridge RPC Gateway** documentation wiki! This comprehensive guide will help you understand, deploy, and contribute to the project.

## 🚀 Quick Navigation

### 📖 **Getting Started**

- [Installation Guide](Installation-Guide) - Step-by-step setup instructions
- [Configuration Guide](Configuration-Guide) - Environment and settings configuration
- [Quick Start Tutorial](Quick-Start-Tutorial) - Get up and running with the new App-based API key system.

### 📚 **API Documentation**

- [Authentication API](Authentication-API) - User registration, login, and JWT handling.
- [Application API](Application-API) - Managing user-created Applications (Apps) and their API keys. (This page might need to be created or combined)
- [RPC Proxy API](RPC-Proxy-API) - Using App-specific API keys for Ethereum execution and consensus layer access.
- [Admin API](Admin-API) - Administrative endpoints for managing Chains and viewing node health.
- [Monitoring API](Monitoring-API) - Health checks and metrics endpoints.

### 🛠️ **Development**

- [Development Setup](Development-Setup) - Local development environment.
- [Testing Guide](Testing-Guide) - Running and writing tests.
- [Contributing Guidelines](CONTRIBUTING.md) - How to contribute to the project.
- [Code Style Guide](Code-Style-Guide) - Coding standards and conventions.

### 🚀 **Deployment**

- [Production Deployment](Production-Deployment) - Deploy to production servers.
- [Docker Deployment](Docker-Deployment) - Containerized deployment.
- [Monitoring Setup](Monitoring-Setup) - Prometheus and Grafana configuration.
- [Security Best Practices](Security-Best-Practices) - Production security guidelines.

### 🔧 **Operations**

- [Troubleshooting](Troubleshooting) - Common issues and solutions.
- [Performance Tuning](Performance-Tuning) - Optimization guidelines.
- [Backup & Recovery](Backup-Recovery) - Data backup strategies.
- [Scaling Guide](Scaling-Guide) - Horizontal and vertical scaling.

### 📊 **Monitoring & Analytics**

- [Metrics Overview](Metrics-Overview) - Understanding available metrics (including per-App metrics).
- [Grafana Dashboards](Grafana-Dashboards) - Pre-built dashboard templates.
- [Alerting Rules](Alerting-Rules) - Prometheus alerting configuration.
- [Log Analysis](Log-Analysis) - Log aggregation and analysis.

### 🔌 **Integrations**

- [Web3.js Integration](Web3js-Integration) - Using with Web3.js and App API keys.
- [Ethers.js Integration](Ethersjs-Integration) - Using with Ethers.js and App API keys.
- [Client SDKs](Client-SDKs) - Available client libraries.
- [Webhook Configuration](Webhook-Configuration) - Event notifications.

### ❓ **FAQ & Support**

- [Frequently Asked Questions](FAQ) - Common questions and answers about the App-based system.
- [Error Codes](Error-Codes) - Error code reference.
- [API Rate Limits](API-Rate-Limits) - Understanding per-App rate limiting.
- [Support Channels](Support-Channels) - Getting help.

## 🎯 **What is NodeBridge?**

NodeBridge RPC Gateway is a **production-ready**, multi-tenant RPC gateway. It provides controlled, rate-limited access to your private blockchain node infrastructure (e.g., Ethereum Sepolia). It's similar to services like Alchemy or Infura, but designed for your own nodes, offering enterprise-grade monitoring and security.

### Key Features:

- 🔐 **Multi-tenant security** with JWT authentication for user accounts.
- 📱 **App-based API Keys**: Users create "Apps" for specific blockchains (managed by an admin) to obtain unique API keys.
- ⚡ **Advanced Per-App Rate Limiting**: Token bucket algorithm applied per App API key for both RPS and daily limits.
- ⛓️ **Admin-Managed Chains**: Administrators control the list of available blockchains.
- 📊 **Enterprise monitoring** with Prometheus metrics (including per-App tracking).
- 🌐 **Dual layer support** for execution and consensus layers (e.g., for Ethereum).
- 🛡️ **Production security** with comprehensive protection.

## 🏗️ **Architecture Overview**

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Client    │───▶│  NodeBridge      │───▶│  Blockchain Node   │
│  (Web3.js)  │    │  RPC Gateway     │    │  (e.g., Ethereum   │
│  (Ethers)   │    │                  │    │   Execution +      │
│   (curl)    │    │  (App API Key)   │    │   Consensus)       │
└─────────────┘    │  ┌─────────────┐ │    │                    │
                   │  │ User Auth   │ │    └─────────────────────┘
                   │  │ App Mgmt    │ │              │
                   │  │ Chain Mgmt  │ │              │
                   │  │ API Key Guard│ │    ┌─────────────────────┐
                   │  │ Rate Limit  │ │    │  Prometheus         │
                   │  │ Metrics     │ │    │  Metrics Server     │
                   │  └─────────────┘ │    │  (Optional)         │
                   └──────────────────┘    └─────────────────────┘
                            │
                   ┌──────────────────┐
                   │   MongoDB        │
                   │(Users, Apps, Chains)│
                   └──────────────────┘
```

## 🤝 **Community & Support**

- **GitHub Repository**: [rpc_gateway](https://github.com/NodeBridge-Africa/rpc_gateway)
- **Issues**: [Report bugs or request features](https://github.com/NodeBridge-Africa/rpc_gateway/issues)
- **Discussions**: [Community discussions](https://github.com/NodeBridge-Africa/rpc_gateway/discussions)
- **Wiki**: You're here! 📍

## 📝 **Latest Updates**

Check the [Changelog](Changelog) for the latest features, bug fixes, and improvements, including the recent shift to App-based API key management.

## 🔄 **Quick Links**

| Resource                                 | Description                 |
| ---------------------------------------- | --------------------------- |
| [Installation Guide](Installation-Guide) | Complete setup instructions |
| [Quick Start Tutorial](Quick-Start-Tutorial) | Get started with Apps & API Keys |
| [API Reference](API-Reference)           | Complete API documentation (to be updated for Apps/Chains) |
| [Docker Guide](Docker-Deployment)        | Container deployment        |
| [Troubleshooting](Troubleshooting)       | Common issues and solutions |
| [Contributing](Contributing-Guidelines)  | How to contribute           |

---

**📋 Wiki Navigation**: Use the sidebar or the links above to navigate through the documentation. If you can't find what you're looking for, try the search function or [ask a question](https://github.com/NodeBridge-Africa/rpc_gateway/discussions).

**🔄 Keep Updated**: This wiki is actively maintained. Star the repository to stay updated with the latest changes!
