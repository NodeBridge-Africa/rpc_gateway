# Contributing to NodeBridge RPC Gateway

Thank you for your interest in contributing to NodeBridge! This guide will help you get started with contributing to our multi-tenant Ethereum RPC gateway.

## 🤝 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct. Please be respectful, inclusive, and constructive in all interactions.

## 🚀 Quick Start for Contributors

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Set up the development environment**
4. **Create a feature branch**
5. **Make your changes**
6. **Test thoroughly**
7. **Submit a pull request**

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ LTS
- MongoDB 6.0+
- Git
- Yarn package manager

### Local Setup

```bash
# Clone your fork
git clone https://github.com/YOUR-USERNAME/nodebridge_rpc_backend.git
cd nodebridge_rpc_backend

# Add upstream remote
git remote add upstream https://github.com/kcpele/nodebridge_rpc_backend.git

# Install dependencies
yarn install

# Copy environment file
cp .env.example .env
# Edit .env with your local settings

# Start MongoDB
sudo systemctl start mongod

# Run tests to verify setup
yarn test
```

### Development Workflow

```bash
# Start development server
yarn dev

# Run tests in watch mode
yarn test:watch

# Check code style
yarn lint

# Fix code style issues
yarn lint:fix

# Type checking
yarn type-check

# Build project
yarn build
```

## 📋 Types of Contributions

We welcome various types of contributions:

### 🐛 Bug Fixes

- Fix existing issues
- Improve error handling
- Resolve edge cases
- Performance improvements

### ✨ New Features

- Authentication enhancements
- Monitoring improvements
- New API endpoints
- Protocol optimizations

### 📚 Documentation

- README improvements
- API documentation
- Code comments
- Wiki articles

### 🧪 Testing

- Unit tests
- Integration tests
- Performance tests
- Security tests

### 🎨 Code Quality

- Code refactoring
- Type safety improvements
- ESLint rule updates
- Performance optimizations

## 📝 Development Guidelines

### Code Style

We use TypeScript with strict typing and ESLint for code quality:

```bash
# Check code style
yarn lint

# Auto-fix style issues
yarn lint:fix

# Type checking
yarn type-check
```

**Style Guidelines:**

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public functions
- Follow existing naming conventions
- Use async/await over Promises where possible

### Testing Requirements

All contributions must include appropriate tests:

**Test Categories:**

- **Unit Tests**: For utility functions and pure logic
- **Integration Tests**: For API endpoints and workflows
- **Database Tests**: For model operations
- **Metrics Tests**: For Prometheus integration

**Testing Guidelines:**

- Maintain >90% test coverage
- Mock external dependencies appropriately
- Write descriptive test names
- Test both success and error cases
- Include edge case testing

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature commits
git commit -m "feat: add consensus layer health monitoring"

# Bug fixes
git commit -m "fix: resolve rate limiting edge case"

# Documentation
git commit -m "docs: update API documentation"

# Tests
git commit -m "test: add integration tests for auth flow"

# Refactoring
git commit -m "refactor: optimize metrics collection"

# Breaking changes
git commit -m "feat!: update API response format"
```

**Commit Types:**

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

## 🔄 Pull Request Process

### Before Submitting

1. **Ensure all tests pass**:

   ```bash
   yarn test
   yarn lint
   yarn build
   ```

2. **Update documentation** if needed:

   - README.md for new features
   - API documentation
   - Inline code comments
   - Wiki pages

3. **Add or update tests** for your changes

4. **Check for breaking changes** and update version accordingly

### Pull Request Guidelines

1. **Clear title and description**

   - Use conventional commit format in title
   - Explain what the PR does and why
   - Reference related issues

2. **Complete the PR template**

   - Fill out all relevant sections
   - Include test evidence
   - Add screenshots for UI changes

3. **Keep PRs focused**

   - One feature or fix per PR
   - Avoid mixing different types of changes
   - Split large changes into smaller PRs

4. **Address review feedback promptly**
   - Respond to comments
   - Make requested changes
   - Ask for clarification if needed

### Review Process

1. **Automated checks** must pass:

   - Tests (unit, integration, database)
   - Linting (ESLint)
   - Type checking (TypeScript)
   - Build verification

2. **Code review** by maintainers:

   - Code quality and style
   - Architecture and design
   - Security considerations
   - Performance impact

3. **Testing verification**:
   - Manual testing when needed
   - Performance testing for critical changes
   - Security testing for auth changes

## 🎯 Contribution Areas

### 🔐 Security & Authentication

- OAuth 2.0 / OpenID Connect integration
- API key rotation mechanisms
- Advanced rate limiting strategies
- Audit logging improvements
- Security vulnerability fixes

### 📊 Monitoring & Analytics

- Additional Prometheus metrics
- Grafana dashboard templates
- Alerting rule definitions
- Performance optimization
- Custom monitoring integrations

### 🌐 Network & Protocols

- WebSocket support
- Additional blockchain networks
- Protocol optimizations
- Connection pooling
- Load balancing improvements

### 🧪 Testing & Quality

- Performance benchmarks
- Load testing scenarios
- Security testing
- End-to-end tests
- Test automation improvements

### 🚀 DevOps & Deployment

- Docker improvements
- Kubernetes manifests
- CI/CD pipeline enhancements
- Infrastructure as Code
- Deployment automation

## 🐛 Bug Reports

When reporting bugs, please use our [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) and include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected vs. actual behavior**
4. **Environment information**
5. **Error logs** and stack traces
6. **Configuration details** (redacted)

## 💡 Feature Requests

For feature requests, please use our [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) and include:

1. **Problem description** and use case
2. **Proposed solution**
3. **Alternative approaches** considered
4. **Implementation ideas** if any
5. **Impact assessment** on existing functionality

## ❓ Questions and Discussions

- **Questions**: Use [GitHub Discussions](https://github.com/kcpele/nodebridge_rpc_backend/discussions)
- **General discussions**: Community forum in Discussions
- **Technical questions**: Tag with appropriate labels
- **Feature brainstorming**: Use the Ideas category

## 🏆 Recognition

Contributors are recognized through:

- **CONTRIBUTORS.md**: All contributors listed
- **Release notes**: Significant contributions mentioned
- **Documentation credits**: Documentation contributors credited
- **Maintainer invitations**: Active contributors may be invited as maintainers

## 📞 Getting Help

If you need help with contributing:

1. **Check existing documentation**:

   - [README.md](README.md)
   - [Wiki](https://github.com/kcpele/nodebridge_rpc_backend/wiki)
   - [FAQ](wiki/FAQ.md)

2. **Search existing issues and discussions**

3. **Ask questions in Discussions**

4. **Contact maintainers** through GitHub

## 🔒 Security Issues

For security vulnerabilities:

- **Do NOT** create public issues
- **Email**: security@nodebridge.dev
- **Use**: [Security advisory](https://github.com/kcpele/nodebridge_rpc_backend/security/advisories)
- **Include**: Detailed description and reproduction steps

## 📄 License

By contributing to NodeBridge, you agree that your contributions will be licensed under the same [MIT License](LICENSE) that covers the project.

---

## 🙏 Thank You!

Every contribution, no matter how small, helps make NodeBridge better for everyone. We appreciate your time and effort in improving this project!

**Happy Contributing!** 🚀

---

For more detailed information, check out our [Wiki](https://github.com/kcpele/nodebridge_rpc_backend/wiki) and [API Documentation](README.md#api-documentation).
