# 🏛️ Project Governance and Development Rules

These rules establish the mandatory process, documentation, and quality requirements for all feature development, code changes, and documentation updates within this project.

---

## 1. Source of Truth (SSOT) & Documentation

To maintain consistency and minimize conflicting information, we must strictly adhere to the following Single Source of Truth principles:

### 1.1. Core Requirements
| Document | Role / Source of Truth | Mandatory Reference |
| :--- | :--- | :--- |
| **Functional Requirements (FRD)** | Definitive source for **how** the system behaves. | Must be linked from the task/story. Code logic must directly implement the logic defined here. |
| **Product Requirements (PRD)** | Definitive source for **why** a feature exists and **what** business problem it solves. | Must be reviewed before starting development. |
| **API/Data Contracts** | Definitive source for input/output structure, data types, and service interactions. | Code must be generated or strongly validated against these contracts. |

### 1.2. The **README.md** File
The root `README.md` is the Single Source of Truth for project setup, deployment, and high-level architecture.

**Mandatory Rule:** Any change to core dependencies, environment variables, setup scripts, or architecture **must** be accompanied by an update to the `README.md` and any respective documentation files (e.g., install guides, wiki pages).

---

## 2. Planning and Scope Management

All development must be preceded by a clear plan. Avoid starting work on an ambiguous ticket.

### 2.1. Define and Restrict Scope 🎯
1.  **Scope Alignment:** Every task or Pull Request (PR) must align with the **Product Requirements** and **Functional Requirements**.
2.  **Scope Creep:** If the implementation uncovers a *new* requirement or bug outside the original ticket's scope, the new work **must** be logged as a separate task/issue. Do not integrate out-of-scope work into the current PR.
3.  **Refactoring:** Necessary refactoring to support the feature is allowed, but large-scale, unrelated refactoring must be done in a separate, dedicated PR.

### 2.2. Plan Before Code 📝
Before writing production code, the developer must:
* Identify the **exact files** and components to be modified.
* Outline the **verification steps** and anticipated test cases.
* Discuss and agree on any new public **API/function signatures** with the team during design or ticket refinement.

---

## 3. Definition of Done (DoD) ✅

No feature is considered complete and no Pull Request (PR) can be merged until **all** of the following criteria are met:

| Criteria | Detail | Check / Gate |
| :--- | :--- | :--- |
| **Code Functionality** | The feature meets all acceptance criteria defined in the ticket/issue. | Manual Verification / Code Review |
| **Automated Build** | The build completes successfully without errors. | CI Pipeline Pass |
| **Linter Clean** | The code passes all static analysis and linting rules with **zero errors/warnings**. | CI Pipeline Pass |
| **Tests Pass** | **All** Unit, Integration, and relevant E2E tests run successfully. | CI Pipeline Pass |
| **Test Verification** | New functionality is covered by new or updated tests. **Tests must pass locally** before pushing the branch. | Local Verification / CI Pipeline Pass |
| **Documentation Updated** | `README.md`, Public API documentation, environment variable lists, and other relevant documentation are updated to reflect the changes. | Code Review Check |
| **Verification Steps** | Clear, repeatable manual verification steps are provided in the PR description for reviewers. | Code Review Check |
| **Security Review** | Automated SAST (Static Analysis) scans show zero critical/high security vulnerabilities. (If applicable) | CI Pipeline Pass / Security Review |