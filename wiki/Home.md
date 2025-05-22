# NodeBridge RPC Gateway Wiki

Welcome to the **NodeBridge RPC Gateway** documentation wiki! This comprehensive guide will help you understand, deploy, and contribute to the project.

## 🚀 Quick Navigation

### 📖 **Getting Started**

- [Installation Guide](Installation-Guide) - Step-by-step setup instructions
- [Configuration Guide](Configuration-Guide) - Environment and settings configuration
- [Quick Start Tutorial](Quick-Start-Tutorial) - Get up and running in 10 minutes

### 📚 **API Documentation**

- [Authentication API](Authentication-API) - User registration, login, and JWT handling
- [RPC Proxy API](RPC-Proxy-API) - Ethereum execution and consensus layer access
- [Monitoring API](Monitoring-API) - Health checks and metrics endpoints
- [Admin API](Admin-API) - Administrative endpoints and node health

### 🛠️ **Development**

- [Development Setup](Development-Setup) - Local development environment
- [Testing Guide](Testing-Guide) - Running and writing tests
- [Contributing Guidelines](Contributing-Guidelines) - How to contribute to the project
- [Code Style Guide](Code-Style-Guide) - Coding standards and conventions

### 🚀 **Deployment**

- [Production Deployment](Production-Deployment) - Deploy to production servers
- [Docker Deployment](Docker-Deployment) - Containerized deployment
- [Monitoring Setup](Monitoring-Setup) - Prometheus and Grafana configuration
- [Security Best Practices](Security-Best-Practices) - Production security guidelines

### 🔧 **Operations**

- [Troubleshooting](Troubleshooting) - Common issues and solutions
- [Performance Tuning](Performance-Tuning) - Optimization guidelines
- [Backup & Recovery](Backup-Recovery) - Data backup strategies
- [Scaling Guide](Scaling-Guide) - Horizontal and vertical scaling

### 📊 **Monitoring & Analytics**

- [Metrics Overview](Metrics-Overview) - Understanding available metrics
- [Grafana Dashboards](Grafana-Dashboards) - Pre-built dashboard templates
- [Alerting Rules](Alerting-Rules) - Prometheus alerting configuration
- [Log Analysis](Log-Analysis) - Log aggregation and analysis

### 🔌 **Integrations**

- [Web3.js Integration](Web3js-Integration) - Using with Web3.js
- [Ethers.js Integration](Ethersjs-Integration) - Using with Ethers.js
- [Client SDKs](Client-SDKs) - Available client libraries
- [Webhook Configuration](Webhook-Configuration) - Event notifications

### ❓ **FAQ & Support**

- [Frequently Asked Questions](FAQ) - Common questions and answers
- [Error Codes](Error-Codes) - Error code reference
- [API Rate Limits](API-Rate-Limits) - Understanding rate limiting
- [Support Channels](Support-Channels) - Getting help

## 🎯 **What is NodeBridge?**

NodeBridge RPC Gateway is a **production-ready**, multi-tenant RPC gateway that provides controlled access to your private Ethereum Sepolia node infrastructure. It's similar to services like Alchemy or Infura, but designed for your own nodes with enterprise-grade monitoring and security.

### Key Features:

- 🔐 **Multi-tenant security** with JWT authentication
- ⚡ **Advanced rate limiting** with token bucket algorithm
- 📊 **Enterprise monitoring** with Prometheus metrics
- 🌐 **Dual layer support** for execution and consensus layers
- 🛡️ **Production security** with comprehensive protection

## 🏗️ **Architecture Overview**

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Client    │───▶│  NodeBridge      │───▶│  Ethereum Node     │
│  (Web3.js)  │    │  RPC Gateway     │    │  (Execution +      │
│  (Ethers)   │    │                  │    │   Consensus)       │
│   (curl)    │    │  ┌─────────────┐ │    │                    │
└─────────────┘    │  │ Auth        │ │    └─────────────────────┘
                   │  │ Rate Limit  │ │              │
                   │  │ Metrics     │ │              │
                   │  │ Validation  │ │    ┌─────────────────────┐
                   │  └─────────────┘ │    │  Prometheus         │
                   └──────────────────┘    │  Metrics Server     │
                            │              │  (Optional)         │
                   ┌──────────────────┐    └─────────────────────┘
                   │   MongoDB        │
                   │   (Users & Usage)│
                   └──────────────────┘
```

## 🤝 **Community & Support**

- **GitHub Repository**: [nodebridge_rpc_backend](https://github.com/kcpele/nodebridge_rpc_backend)
- **Issues**: [Report bugs or request features](https://github.com/kcpele/nodebridge_rpc_backend/issues)
- **Discussions**: [Community discussions](https://github.com/kcpele/nodebridge_rpc_backend/discussions)
- **Wiki**: You're here! 📍

## 📝 **Latest Updates**

Check the [Changelog](Changelog) for the latest features, bug fixes, and improvements.

## 🔄 **Quick Links**

| Resource                                 | Description                 |
| ---------------------------------------- | --------------------------- |
| [Installation Guide](Installation-Guide) | Complete setup instructions |
| [API Reference](API-Reference)           | Complete API documentation  |
| [Docker Guide](Docker-Deployment)        | Container deployment        |
| [Troubleshooting](Troubleshooting)       | Common issues and solutions |
| [Contributing](Contributing-Guidelines)  | How to contribute           |

---

**📋 Wiki Navigation**: Use the sidebar or the links above to navigate through the documentation. If you can't find what you're looking for, try the search function or [ask a question](https://github.com/kcpele/nodebridge_rpc_backend/discussions).

**🔄 Keep Updated**: This wiki is actively maintained. Star the repository to stay updated with the latest changes!
