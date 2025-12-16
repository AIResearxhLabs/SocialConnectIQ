# 📚 Documentation Rules for AI Assistants

**Source:** DOCUMENTATION_STANDARDS.md (Full version in project root)

---

## 🚨 CRITICAL RULES - READ FIRST

### Rule 1: NEVER Create These Files
```
FORBIDDEN:
❌ *_FIX.md
❌ *_PATCH.md
❌ *_UPDATE.md
❌ *_V2.md
❌ *_NEW.md
❌ TEMP_*.md
❌ *_BACKUP.md
```

### Rule 2: ALWAYS Check First
```
BEFORE creating ANY documentation:
1. Read docs/README.md
2. Find the relevant existing document
3. Update that document (don't create new)
4. Add entry to docs/CHANGELOG.md
5. Update "Last Updated" date
```

### Rule 3: Golden Rules
1. **UPDATE, DON'T CREATE** - Update existing docs instead of creating new ones
2. **ONE TOPIC, ONE FILE** - Each topic has ONE authoritative document
3. **TRACK IN CHANGELOG** - All changes go in CHANGELOG.md
4. **NO ORPHANS** - Every doc must be linked from docs/README.md

---

## 📋 Decision Tree

```
Need to document something?
    │
    ├─ Read docs/README.md first
    │
    ├─ Is there an existing doc for this topic?
    │   ├─ YES → UPDATE that document
    │   │         + Add to CHANGELOG.md
    │   │         + Update date
    │   │
    │   └─ NO → Ask user first!
    │            "Should I update [X] or create [Y]?"
```

---

## ✅ Required Actions for Every Change

When making ANY code or documentation change:

- [ ] Update relevant existing document (not create new)
- [ ] Add entry to docs/CHANGELOG.md with:
  - Date: `[YYYY-MM-DD]`
  - Category: Added/Changed/Fixed/Removed
  - Description with cause and solution
- [ ] Update "Last Updated: YYYY-MM-DD" in modified docs
- [ ] If creating new doc (rare), add to docs/README.md

---

## 📝 CHANGELOG Entry Format

```markdown
## [2025-12-12] - Feature/Fix Name
### Fixed (or Added, Changed, etc.)
- **[Component]**: [What changed]
  - Issue: [What was wrong]
  - Cause: [Why it happened]
  - Fix: [How it was resolved]
```

---

## 🎯 Examples

### ❌ WRONG: Fixing a Bug
```
1. Create OAUTH_BUG_FIX.md ← NO!
2. Document the fix
```

### ✅ CORRECT: Fixing a Bug
```
1. Read docs/README.md
2. Find oauth-integration-guide.md
3. Update oauth-integration-guide.md
   - Add to troubleshooting section
   - Update "Last Updated" date
4. Add to docs/CHANGELOG.md:
   ### Fixed
   - **OAuth**: Token refresh issue
     - Cause: Token expiry not checked
     - Fix: Added validation middleware
```

### ❌ WRONG: New Feature
```
1. Create NEW_FEATURE_GUIDE.md ← NO!
```

### ✅ CORRECT: New Feature
```
1. Read docs/README.md
2. Find relevant existing guide
3. Add section to existing guide
4. Add to docs/CHANGELOG.md:
   ### Added
   - **Feature Name**: Description
```

---

## 🔍 Mandatory Documentation Structure

Every project MUST have:
```
docs/
├── README.md           ← Documentation hub
├── CHANGELOG.md        ← ALL changes tracked here
├── ARCHITECTURE.md     ← System design
└── TROUBLESHOOTING.md  ← Common issues
```

---

## 🤖 AI Assistant Checklist

Before documenting anything:

- [ ] Have I read docs/README.md?
- [ ] Is there an existing doc for this topic?
- [ ] Am I updating (not creating)?
- [ ] Am I avoiding forbidden file names?
- [ ] Will I update CHANGELOG.md?
- [ ] Will I update "Last Updated" date?

---

## 💡 When Uncertain

**ASK THE USER:**
```
"I need to document [X].

I checked docs/README.md and found:
- [existing-doc.md] covers similar topics

Should I:
A) Update [existing-doc.md] with a new section
B) Create new [proposed-doc.md]

Which approach do you prefer?"
```

**Wait for user response before proceeding.**

---

## 📖 Full Documentation

For complete guidelines, templates, and examples:
**See DOCUMENTATION_STANDARDS.md in project root**

---

**Remember:**
- ✅ Update existing docs
- ✅ Track in CHANGELOG
- ❌ Never create *_FIX.md files
- ❌ Never create duplicate documents
