# 📚 SocialConnectIQ Documentation

Welcome to the SocialConnectIQ documentation. This index helps you find the information you need quickly.

---

## 🚀 Getting Started

| Document | Description |
|----------|-------------|
| [Getting Started Guide](../README.md) | Quick start guide for setting up the project |
| [Service Management](SERVICE_MANAGEMENT.md) | How to start, stop, and manage services |

---

## 📖 Core Documentation (8 Files)

### Architecture & Design
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - **⭐ DEFINITIVE service architecture reference** - Read this when confused about service responsibilities

### Requirements & Specifications
- **[product-requirements.md](product-requirements.md)** - Product requirements and business goals
- **[functional-specification.md](functional-specification.md)** - Functional requirements and specifications

### Feature Guides
- **[linkedin-integration-guide.md](linkedin-integration-guide.md)** - Complete guide covering:
  - LinkedIn OAuth integration
  - Token management and security
  - Posting to LinkedIn
  - **Content refinement with AI** (GPT-4o)
  - **Voice input** (Web Speech API)
  - Testing and troubleshooting
- **[MCP_SETUP_GUIDE.md](MCP_SETUP_GUIDE.md)** - Model Context Protocol setup and usage

### Operations & History
- **[SERVICE_MANAGEMENT.md](SERVICE_MANAGEMENT.md)** - Starting, stopping, and managing services
- **[CHANGELOG.md](CHANGELOG.md)** - Complete history of all changes, fixes, and features

### Standards (Project Root)
- **[../DOCUMENTATION_STANDARDS.md](../DOCUMENTATION_STANDARDS.md)** - Universal documentation standards for all projects
- **[../.clinerules/gDocumentationRules.md](../.clinerules/gDocumentationRules.md)** - AI assistant documentation rules

---

## 🗂️ Documentation Status

### ✅ Current & Maintained (8 Core Documents)

**Active documents** - These are the only documents you should reference:

1. **README.md** (This file) - Documentation hub and navigation
2. **ARCHITECTURE.md** - **⭐ Service architecture and responsibilities (READ FIRST when confused)**
3. **CHANGELOG.md** - All changes, fixes, and features tracked here
4. **product-requirements.md** - Product vision and business goals
5. **functional-specification.md** - Technical specifications
6. **linkedin-integration-guide.md** - LinkedIn features (OAuth, posting, AI refinement, voice input)
7. **MCP_SETUP_GUIDE.md** - MCP integration guide
8. **SERVICE_MANAGEMENT.md** - Operations and service management

### 📦 Archived (31 Documents Consolidated)

**These documents have been moved to `docs/archive/` after consolidation:**

**Architecture & Design:**
- `ai-agent-architecture.md`
- `ARCHITECTURE_FIX_MCP_ROUTING.md`
- `SIMPLIFIED_ARCHITECTURE.md`

**LinkedIn Integration (9 files consolidated into linkedin-integration-guide.md):**
- `LINKEDIN_AUTH_TESTING_GUIDE.md`
- `LINKEDIN_CONNECTION_DEBUGGING.md`
- `LINKEDIN_CONNECTION_DEBUGGING_ENHANCED.md`
- `LINKEDIN_CONNECTION_STATUS_FIX.md`
- `LINKEDIN_INTEGRATION_FIXES.md`
- `LINKEDIN_MCP_INTEGRATION_FIX.md`
- `LINKEDIN_REDIRECT_URI_FIX.md`
- `OAUTH_FIX_TEST_GUIDE.md`
- `OAUTH_POPUP_CALLBACK_FIX.md`

**Logging & Monitoring (5 files):**
- `CENTRALIZED_LOGGING_GUIDE.md`
- `ENHANCED_LOGGING_GUIDE.md`
- `LOGGING_IMPLEMENTATION_SUMMARY.md`
- `CORRELATION_LOGGING_IMPLEMENTATION.md`
- `CORRELATION_ID_IMPLEMENTATION_COMPLETE.md`

**API & Routing (5 files):**
- `API_ROUTING_ABSOLUTE_URL_FIX.md`
- `DIRECT_BACKEND_ROUTING_FIX.md`
- `PROXY_CONFIGURATION_FIX.md`
- `PROXY_FIX_SUMMARY.md`
- `MCP_CALLBACK_URL_FIX.md`

**MCP Integration:**
- `LLM_MCP_INTEGRATION_IMPLEMENTATION.md`
- `MCP_CONFIGURATION_CHANGES.md`
- `MCP_INTEGRATION_TEST_REPORT.md`

**UI & Frontend:**
- `BROWSER_STORAGE_MANAGEMENT.md`
- `CONSOLE_ERRORS_FIX.md`
- `COMPOSER_ENHANCED_STATUS_TRACKING.md`

**Other:**
- `INTEGRATION_SERVICE_FIX.md`
- `OPENAI_API_KEY_CACHE_FIX.md`
- `SOLUTION_SUMMARY.md`

**Result:** Documentation reduced from **38 files to 7 core documents** (82% reduction)

---

## 🔍 Quick Reference

### Common Tasks

**Architecture Questions**
- **"Which service does X?"** → See [ARCHITECTURE.md](ARCHITECTURE.md)
- **"Who calls MCP?"** → Only Agent Service (Port 8006)
- **"Where are tokens stored?"** → Integration Service manages, Firestore stores

**Setup & Installation**
```bash
# See main README.md in project root
./start-all-services.sh
```

**LinkedIn Integration**
- Setup OAuth: See [linkedin-integration-guide.md](linkedin-integration-guide.md) → "Implementation Details" section
- Content refinement: See [linkedin-integration-guide.md](linkedin-integration-guide.md) → "Content Refinement & Voice Input" section
- Test voice input: Open Composer page, click 🎤 microphone button
- Test refinement: Run `./scripts/test-content-refinement.sh`

**Service Management**
- Start/stop services: See [SERVICE_MANAGEMENT.md](SERVICE_MANAGEMENT.md)
- Health checks: `curl http://localhost:800X/health` (where X is service port)
- View logs: `tail -f logs/centralized.log`

**MCP Integration**
- Setup: See [MCP_SETUP_GUIDE.md](MCP_SETUP_GUIDE.md)
- Configuration: Environment variables in service config files

**Feature Development**
- Requirements: [functional-specification.md](functional-specification.md)
- Product goals: [product-requirements.md](product-requirements.md)
- Coding standards: `.clinerules/` in project root
- Change tracking: [CHANGELOG.md](CHANGELOG.md)

---

## 📝 Documentation Principles

To keep documentation maintainable (follow these rules strictly):

1. **UPDATE, DON'T CREATE** - Update existing docs rather than creating new fix/patch documents
2. **CONSOLIDATE** - Merge related information into comprehensive guides
3. **SINGLE SOURCE OF TRUTH** - Each topic has ONE authoritative document
4. **TRACK IN CHANGELOG** - All changes documented in CHANGELOG.md
5. **CLEAR STRUCTURE** - Maintain consistent organization

**For AI Assistants:** See `.clinerules/gDocumentationRules.md` for complete rules

---

## 🔄 Recent Updates

See [CHANGELOG.md](CHANGELOG.md) for complete history.

### Latest (December 12, 2025)
- ✨ Voice input for content composition (Web Speech API)
- 🤖 LLM-powered content refinement (OpenAI GPT-4o)
- 📚 Documentation consolidation (38 → 7 files)
- 📊 Enhanced logging with correlation IDs
- 🔗 MCP integration for LinkedIn automation

---

## 📞 Need Help?

1. **Check relevant guide** - Use navigation above
2. **Search CHANGELOG** - Find when/why things changed
3. **Run test scripts** - Located in `scripts/` directory
4. **Check logs** - `logs/` directory for all service logs

---

## 📊 Documentation Metrics

- **Core Documents**: 8 (ARCHITECTURE.md added December 15, 2025)
- **Archived Documents**: 31 (historical reference only)
- **Reduction**: 79% fewer files (from 38)
- **Clarity**: Single source of truth for each topic

---

**Last Updated**: December 15, 2025
