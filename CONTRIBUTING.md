# Contributing to BetTracer

Thank you for your interest in contributing to BetTracer! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different viewpoints and experiences

## Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/your-username/BetTracer.git
   cd BetTracer
   ```

3. **Set up development environment**
   - Follow the setup instructions in [README.md](./README.md)
   - Install all dependencies for frontend, backend, and ML service

4. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

1. **Create an issue** (if one doesn't exist) describing the feature or bug fix
2. **Create a branch** from `develop` (or `main` for hotfixes)
3. **Make your changes** following the code style guidelines
4. **Write tests** for your changes
5. **Update documentation** if needed
6. **Commit your changes** with descriptive commit messages
7. **Push to your fork** and create a Pull Request

## Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for code formatting
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Python

- Follow PEP 8 style guide
- Use type hints where possible
- Add docstrings for functions and classes
- Use meaningful variable and function names

### React/Next.js

- Use functional components with hooks
- Use TypeScript for all components
- Follow Next.js 13+ App Router conventions
- Use React Hook Form for forms
- Use Zod for validation

### Database

- Use migrations for schema changes
- Follow the database design in `BetTracerGuide.md`
- Ensure RLS policies are properly configured
- Add indexes for performance-critical queries

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(backend): add bet creation endpoint
fix(frontend): resolve authentication token issue
docs: update API documentation
test(backend): add integration tests for bets API
```

## Pull Requests

1. **Keep PRs focused** - One feature or bug fix per PR
2. **Write a clear title** - Describe what the PR does
3. **Add a description** - Explain the changes and why they were made
4. **Link to issues** - Reference related issues
5. **Update documentation** - If your changes affect documentation
6. **Ensure tests pass** - All tests must pass before merging
7. **Request reviews** - Request reviews from team members

### PR Template

```markdown
## Description
Brief description of changes

## Related Issues
Closes #issue-number

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added and passing
```

## Testing

### Backend Tests

```bash
cd backend
npm test              # Run all tests
npm test:watch        # Run tests in watch mode
npm test:coverage     # Run tests with coverage
```

### Frontend Tests

```bash
cd frontend
npm test              # Run all tests
npm test:watch        # Run tests in watch mode
npm test:coverage     # Run tests with coverage
```

### ML Service Tests

```bash
cd ml_service
pytest                # Run all tests
pytest --cov          # Run tests with coverage
```

## Documentation

- Update `BetTracerGuide.md` for architectural changes
- Update API documentation for endpoint changes
- Add JSDoc comments for public APIs
- Update README.md for new features or setup changes

## Questions?

If you have questions, please:
1. Check the documentation in `BetTracerGuide.md`
2. Search existing issues
3. Create a new issue with the `question` label
4. Reach out to the team

Thank you for contributing to BetTracer! 🎉

