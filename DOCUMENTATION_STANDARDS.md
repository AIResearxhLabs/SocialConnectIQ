# 📚 Universal Documentation Standards for AI-Assisted Projects

**Version:** 1.0.0  
**Purpose:** Standard documentation structure and rules for all projects  
**Audience:** AI Coding Assistants (Cline, Cursor, etc.) and Human Developers

---

## 🎯 Core Principles

### The Golden Rules

1. **UPDATE, DON'T CREATE** - Always update existing documents instead of creating new fix/patch documents
2. **ONE TOPIC, ONE FILE** - Each topic has exactly one authoritative document
3. **TRACK IN CHANGELOG** - All changes, fixes, and updates tracked in CHANGELOG.md
4. **CLEAR NAVIGATION** - README.md in docs/ serves as the documentation hub
5. **NO ORPHANS** - Every document must be linked from docs/README.md

### Why These Rules Matter

- **Prevents sprawl**: Keeps documentation manageable (6-12 core docs vs 30+ scattered files)
- **Single source of truth**: Eliminates confusion about which document is current
- **Easy maintenance**: Update one place instead of managing multiple versions
- **Better discoverability**: Clear structure makes information easy to find
- **Change tracking**: CHANGELOG provides complete project history

---

## 📁 Mandatory File Structure

Every project MUST have these core documentation files:

```
project-root/
├── README.md                        # Project overview, quick start
└── docs/
    ├── README.md                    # Documentation index & navigation
    ├── CHANGELOG.md                 # All changes tracked here
    ├── ARCHITECTURE.md              # System design & architecture
    ├── TROUBLESHOOTING.md           # Common issues & solutions
    └── [feature-guides]/            # Feature-specific documentation
```

### Optional but Recommended

```
docs/
├── API_REFERENCE.md                 # API endpoints & schemas
├── DEPLOYMENT.md                    # Deployment procedures
├── TESTING.md                       # Testing procedures & scripts
├── CONTRIBUTING.md                  # Contribution guidelines
└── archive/                         # Deprecated/old documents
```

---

## 📝 File Naming Conventions

### Standard File Names (DO USE)

| File | Purpose | Naming Convention |
|------|---------|-------------------|
| Core docs | Main documentation | `UPPERCASE.md` (e.g., `ARCHITECTURE.md`) |
| Feature guides | Feature documentation | `lowercase-with-hyphens.md` (e.g., `oauth-integration-guide.md`) |
| Requirements | Business/technical specs | `lowercase-specification.md` or `requirements.md` |

### NEVER Use These Names

❌ `*_FIX.md` - Update the main document instead  
❌ `*_PATCH.md` - Update the main document instead  
❌ `*_UPDATE.md` - Update the main document instead  
❌ `*_V2.md` - Version in CHANGELOG, not filename  
❌ `TEMP_*.md` - Either commit or delete  
❌ `OLD_*.md` - Move to `docs/archive/` if needed  

### Examples

✅ **GOOD:**
- `ARCHITECTURE.md` - Main architecture doc
- `oauth-integration-guide.md` - OAuth feature guide
- `TROUBLESHOOTING.md` - Problem resolution guide
- `CHANGELOG.md` - Change history

❌ **BAD:**
- `OAUTH_FIX.md` - Should update `oauth-integration-guide.md`
- `ARCHITECTURE_UPDATE_V3.md` - Should update `ARCHITECTURE.md`
- `NEW_FEATURE_SETUP.md` - Should be a section in relevant guide
- `TEMP_NOTES.md` - Don't commit temporary files

---

## 📋 Content Guidelines

### docs/README.md (Documentation Hub)

**Purpose:** Central navigation and documentation index

**Must Include:**
- Table of contents with links to all documents
- Brief description of each document's purpose
- "Getting Started" quick links
- Document status (Current vs Archived)
- Last updated date

**Template:**
```markdown
# 📚 [Project Name] Documentation

## 🚀 Getting Started
- [Quick Start Guide](../README.md)
- [Architecture Overview](ARCHITECTURE.md)

## 📖 Core Documentation
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design
- **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Problem resolution
- etc.

## 🗂️ Document Status
### Current & Maintained
- List of current docs

### Archived
- List of archived docs (in docs/archive/)

*Last Updated: YYYY-MM-DD*
```

---

### CHANGELOG.md (Change History)

**Purpose:** Track ALL changes, fixes, features, and updates

**Must Include:**
- Dated entries in reverse chronological order (newest first)
- Clear categorization (Added, Changed, Fixed, Removed, Security)
- Links to related commits/PRs when applicable
- Migration notes for breaking changes

**Format Standard:**
```markdown
# Changelog

## [Unreleased]
### Added
- New features not yet released

### Fixed
- Bug fixes not yet released

## [YYYY-MM-DD] - Feature/Release Name
### Added
- **Feature Name**: Description
  - Detail 1
  - Detail 2

### Changed
- **Component**: What changed and why

### Fixed
- **Issue**: What was broken
  - Cause: Why it happened
  - Fix: How it was resolved

### Removed
- **Deprecated Feature**: Reason for removal

## Migration Notes
Notes about breaking changes or required updates
```

**Categories:**
- **Added**: New features, endpoints, functionality
- **Changed**: Modifications to existing features
- **Deprecated**: Features marked for removal
- **Removed**: Deleted features or files
- **Fixed**: Bug fixes (include cause and solution)
- **Security**: Security patches and updates

---

### ARCHITECTURE.md (System Design)

**Purpose:** Complete system architecture and design patterns

**Must Include:**
- System overview and architecture diagram
- Component descriptions and responsibilities
- Data flow diagrams
- Technology stack
- Design patterns used
- Deployment architecture
- Integration points

**Structure:**
```markdown
# Architecture

## Overview
High-level system description

## Architecture Diagram
[ASCII or Mermaid diagram]

## Components
### Component 1
- Purpose
- Technologies
- Responsibilities
- APIs/Interfaces

## Data Flow
How data moves through the system

## Design Patterns
Patterns used and why

## Technology Stack
- Frontend: [technologies]
- Backend: [technologies]
- Database: [technologies]
- Infrastructure: [technologies]

## Deployment Architecture
How the system is deployed

*Last Updated: YYYY-MM-DD*
```

---

### TROUBLESHOOTING.md (Problem Resolution)

**Purpose:** Common issues and their solutions

**Must Include:**
- Searchable problem descriptions
- Clear symptoms
- Root causes
- Step-by-step solutions
- Prevention tips

**Structure:**
```markdown
# Troubleshooting Guide

## Quick Diagnostic Checklist
- [ ] Are all services running?
- [ ] Are environment variables set?
- etc.

## Common Issues

### Issue: [Clear Description]
**Symptoms:**
- What the user sees/experiences

**Cause:**
- Why this happens

**Solution:**
1. Step-by-step fix
2. Verification steps

**Prevention:**
- How to avoid this issue

### Issue: [Next Issue]
...
```

---

### Feature Guides (e.g., oauth-integration-guide.md)

**Purpose:** Complete documentation for a specific feature

**Must Include:**
- Feature overview
- Setup/configuration
- Usage examples
- API reference (if applicable)
- Testing procedures
- Troubleshooting
- Related features

**Structure:**
```markdown
# [Feature Name] Guide

## Overview
What this feature does and why

## Architecture
How this feature works

## Setup
### Prerequisites
- List of requirements

### Configuration
- Environment variables
- Configuration files

## Usage
### Basic Usage
Code examples

### Advanced Usage
More complex scenarios

## API Reference
Endpoints, parameters, responses

## Testing
How to test this feature

## Troubleshooting
Common issues specific to this feature

*Last Updated: YYYY-MM-DD*
```

---

## 🔄 Update Rules for AI Assistants

### When to UPDATE Existing Documents

✅ **UPDATE when:**
- Fixing bugs or issues with existing features
- Adding new capabilities to existing features
- Improving/clarifying existing documentation
- Correcting errors or outdated information
- Adding examples to existing sections

### When to CREATE New Documents

✅ **CREATE when:**
- Documenting a genuinely new feature/component
- Adding a new integration guide
- Creating specialized guides (deployment, testing, etc.)
- **BUT ONLY IF** no existing document covers this topic

### The Decision Tree

```
Need to document something?
    │
    ├─ Is there an existing doc for this topic?
    │   ├─ YES → UPDATE that document
    │   │         + Add entry to CHANGELOG.md
    │   │         + Update "Last Updated" date
    │   │
    │   └─ NO → Is this a genuinely new topic?
    │       ├─ YES → CREATE new document
    │       │         + Add to docs/README.md
    │       │         + Add entry to CHANGELOG.md
    │       │
    │       └─ NO → This belongs in existing doc
    │                 + UPDATE relevant document
    │                 + Add to CHANGELOG.md
```

---

## 🤖 AI Assistant Specific Instructions

### MANDATORY Rules for AI Coding Assistants

When an AI assistant (Cline, Cursor, etc.) is asked to document changes:

#### Rule 1: Check Existing Documentation FIRST
```
BEFORE creating any document:
1. Read docs/README.md to find relevant existing document
2. Check if the topic is already covered
3. If covered, update that document
4. If not covered, check if it belongs in an existing doc
5. Only create new document if truly new topic
```

#### Rule 2: NEVER Create These Files
```
FORBIDDEN file names:
- *_FIX.md
- *_PATCH.md
- *_UPDATE.md
- *_V2.md
- *_NEW.md
- TEMP_*.md
- *_BACKUP.md
```

#### Rule 3: ALWAYS Update These Files
```
When making ANY change that affects documentation:
1. Update relevant document(s)
2. Add entry to CHANGELOG.md
3. Update docs/README.md if adding new document
4. Update "Last Updated" date in modified documents
```

#### Rule 4: CHANGELOG Entry Format
```
Every fix/feature must have a CHANGELOG entry:

## [YYYY-MM-DD] - [Feature/Fix Name]
### Fixed (or Added, Changed, etc.)
- **[Component]**: [What changed]
  - Issue: [What was wrong]
  - Cause: [Why it happened]
  - Fix: [How it was resolved]
```

#### Rule 5: Ask Before Creating
```
If uncertain whether to create new document:
1. Explain what you want to document
2. Show which existing docs you checked
3. Ask: "Should I update [existing doc] or create new [proposed doc]?"
4. Wait for user confirmation
```

---

## ✅ Do's and ❌ Don'ts

### Documentation Content

| ✅ DO | ❌ DON'T |
|-------|----------|
| Update existing documents with new information | Create separate fix/patch documents |
| Add comprehensive examples | Leave examples incomplete or broken |
| Include troubleshooting sections | Ignore common problems |
| Use clear, descriptive headings | Use vague titles like "Notes" or "Stuff" |
| Keep documents focused on one topic | Mix unrelated topics in one document |
| Include "Last Updated" dates | Leave documents undated |
| Link related documents | Create isolated, unlinked documents |

### File Management

| ✅ DO | ❌ DON'T |
|-------|----------|
| Archive old documents to `docs/archive/` | Delete historical documentation |
| Use consistent naming conventions | Mix naming styles (UPPERCASE, lowercase, CamelCase) |
| Organize by topic/feature | Organize by date or author |
| Link all docs from docs/README.md | Create orphaned documents |
| Version content in CHANGELOG.md | Version with filenames (*_v2.md) |

### Change Tracking

| ✅ DO | ❌ DON'T |
|-------|----------|
| Document every significant change in CHANGELOG | Skip CHANGELOG updates |
| Include cause and solution for fixes | Just say "fixed bug" without details |
| Date all CHANGELOG entries | Use vague timing ("recently", "last week") |
| Group related changes together | Scatter related changes across entries |
| Link to commits/PRs when relevant | Omit references to code changes |

---

## 📋 Quick Reference Checklist

### For AI Assistants: Before Documenting

- [ ] Have I read `docs/README.md` to find existing documents?
- [ ] Is there an existing document that covers this topic?
- [ ] If yes, am I updating that document (not creating new)?
- [ ] Am I avoiding forbidden file name patterns (*_FIX.md, etc.)?
- [ ] Will I add an entry to CHANGELOG.md?
- [ ] Will I update the "Last Updated" date?
- [ ] If creating new doc, will I add it to docs/README.md?

### After Documenting

- [ ] Did I update all relevant existing documents?
- [ ] Did I add a CHANGELOG.md entry with:
  - [ ] Date
  - [ ] Category (Added/Changed/Fixed/etc.)
  - [ ] Clear description
  - [ ] Cause (for fixes)
  - [ ] Solution (for fixes)
- [ ] Did I update docs/README.md if I created a new document?
- [ ] Did I update "Last Updated" dates?
- [ ] Are all new documents linked from docs/README.md?
- [ ] Did I check for broken links?

---

## 🎓 Examples

### Example 1: Fixing a Bug

**❌ WRONG Approach:**
```
1. Create OAUTH_BUG_FIX.md
2. Document the fix
3. Leave it as separate file
```

**✅ CORRECT Approach:**
```
1. Read docs/README.md → Find oauth-integration-guide.md
2. Update oauth-integration-guide.md:
   - Add/update troubleshooting section
   - Document the fix
   - Update "Last Updated" date
3. Add entry to CHANGELOG.md:
   ## [2025-12-12] - OAuth Bug Fix
   ### Fixed
   - **OAuth Flow**: Token refresh failing after 24 hours
     - Cause: Token expiry not checked before API calls
     - Fix: Added token validation middleware
```

### Example 2: Adding New Feature

**❌ WRONG Approach:**
```
1. Create NEW_VOICE_INPUT_FEATURE.md
2. Document everything about voice input
3. Leave as standalone file
```

**✅ CORRECT Approach:**
```
1. Read docs/README.md → Find relevant guide (e.g., user-interface-guide.md)
2. Update user-interface-guide.md:
   - Add "Voice Input" section
   - Include setup, usage, troubleshooting
   - Update "Last Updated" date
3. Add entry to CHANGELOG.md:
   ## [2025-12-12] - Voice Input Feature
   ### Added
   - **Voice Input**: Speech-to-text for content composition
     - Web Speech API integration
     - Real-time transcription
     - Browser compatibility detection
```

### Example 3: Genuinely New Topic

**✅ CORRECT Approach (when truly new):**
```
1. Read docs/README.md → Confirm no existing doc covers this
2. Create new document: payment-integration-guide.md
3. Add to docs/README.md:
   - **[payment-integration-guide.md](payment-integration-guide.md)** - Payment processing
4. Add entry to CHANGELOG.md:
   ## [2025-12-12] - Payment Integration Documentation
   ### Added
   - Created payment-integration-guide.md
     - Stripe integration
     - Webhook handling
     - Testing procedures
```

---

## 🔧 Implementation Guide

### For New Projects

1. **Create mandatory structure:**
   ```bash
   mkdir -p docs
   touch docs/README.md
   touch docs/CHANGELOG.md
   touch docs/ARCHITECTURE.md
   touch docs/TROUBLESHOOTING.md
   ```

2. **Populate docs/README.md** with navigation structure

3. **Initialize CHANGELOG.md** with project creation entry

4. **Document initial architecture** in ARCHITECTURE.md

### For Existing Projects

1. **Audit current documentation:**
   ```bash
   ls docs/ | wc -l  # Count documents
   ```

2. **Identify consolidation opportunities:**
   - Group related *_FIX.md files
   - Find duplicate content
   - Identify missing core documents

3. **Consolidate systematically:**
   - Create/update core documents
   - Migrate content from fix files
   - Update docs/README.md
   - Archive old files to docs/archive/

4. **Create CHANGELOG.md** and document consolidation

### For AI Assistant Configuration

**Add to `.clinerules/` or project instructions:**

```markdown
# Documentation Standards

When documenting changes:

1. **NEVER create *_FIX.md, *_PATCH.md, or *_UPDATE.md files**
2. **ALWAYS check docs/README.md** to find the right document to update
3. **ALWAYS add an entry** to docs/CHANGELOG.md
4. **ALWAYS update** the "Last Updated" date in modified documents
5. **Follow** the structure defined in DOCUMENTATION_STANDARDS.md

See DOCUMENTATION_STANDARDS.md for complete rules.
```

---

## 📞 Support & Questions

### For AI Assistants

When uncertain about documentation:
1. Read this entire document
2. Check docs/README.md in the project
3. Ask the user: "Should I update [existing doc] or create [new doc]?"
4. Explain your reasoning
5. Wait for confirmation

### For Humans

When an AI assistant creates inappropriate documents:
1. Point them to this document
2. Ask them to consolidate into existing docs
3. Update their configuration with these rules
4. Consider adding project-specific rules to `.clinerules/`

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-12 | Initial release - Universal documentation standards |

---

## 📄 License

This documentation standard is provided as-is for use in any project.  
Feel free to adapt to your specific needs.

---

**Remember: Good documentation is living documentation.**  
**Update it with your code, not after.**
