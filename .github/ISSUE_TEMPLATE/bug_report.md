---
name: 🐛 Bug Report
about: Report a bug to help us improve NodeBridge RPC Gateway
title: "[BUG] "
labels: bug
assignees: ""
---

## 🐛 Bug Description

**A clear and concise description of what the bug is.**

## 🔄 Steps to Reproduce

1. Go to '...'
2. Send request to '...'
3. Configure '...'
4. See error

## ✅ Expected Behavior

**A clear description of what you expected to happen.**

## ❌ Actual Behavior

**A clear description of what actually happened.**

## 📸 Screenshots/Logs

If applicable, add screenshots or error logs to help explain your problem:

```
Paste error logs here
```

## 🖥️ Environment

**Please complete the following information:**

- **OS**: [e.g. Ubuntu 22.04, Windows 11, macOS 13]
- **Node.js version**: [e.g. v18.17.0]
- **MongoDB version**: [e.g. v6.0.8]
- **Gateway version**: [e.g. v1.0.0]
- **Browser** (if applicable): [e.g. Chrome 115]

## ⚙️ Configuration

**Relevant configuration (please redact secrets):**

```env
# Your .env settings (without secrets)
PORT=8888
NODE_ENV=development
EXECUTION_RPC_URL=http://localhost:8545
# etc...
```

## 🔄 Request Details

**If this is a RPC/API issue, please provide:**

- **Endpoint**: [e.g. `/exec/<api-key>`, `/cons/<api-key>/eth/v1/beacon/headers`]
- **Method**: [e.g. POST, GET]
- **Request body** (if applicable):

```json
{
  "jsonrpc": "2.0",
  "method": "eth_blockNumber",
  "params": [],
  "id": 1
}
```

## 📋 Additional Context

**Add any other context about the problem here.**

## ✅ Checklist

- [ ] I have searched existing issues for duplicates
- [ ] I have included all relevant information above
- [ ] I have tested this with the latest version
- [ ] I have redacted sensitive information from logs/configs
