# ✍️ Project Coding Standards & Clean Code Rules

These mandatory rules define the expected quality, structure, and style of all source code contributed to this project. Adherence to these standards is enforced via automated linters and code reviews to ensure maintainability, readability, and consistency.

---

## 1. Naming Conventions

Names must be clear, descriptive, and unambiguous. Avoid clever or abbreviated names unless they are standard industry abbreviations (e.g., `HTTP`, `URL`).

| Element | Rule / Convention | Example (Good) | Example (Bad) |
| :--- | :--- | :--- | :--- |
| **Classes/Interfaces** | Use **PascalCase** (CamelCase with a capital first letter). Noun phrases. | `UserService`, `PaymentGateway` | `user_svc`, `pg` |
| **Functions/Methods** | Use **camelCase**. Verb phrases describing action. | `calculateTotal()`, `fetchUserDetails()` | `calc()`, `handleData` |
| **Variables/Properties** | Use **camelCase**. Clear description of content. | `userName`, `accountBalance` | `usr`, `a` |
| **Constants** | Use **SCREAMING_SNAKE_CASE**. Defined once and never changed. | `MAX_RETRIES`, `DEFAULT_TIMEOUT_MS` | `MaxRetries`, `timeout` |
| **Booleans** | Should read as a question. | `isActive`, `hasPermission` | `status`, `perm` |

## 2. Functions and Methods

Keep functions small, focused, and testable.

| Principle | Description | Mandatory Rule |
| :--- | :--- | :--- |
| **Single Responsibility Principle (SRP)** | Every function must do **one thing**, and do it well. | Functions should generally be no longer than **20-30 lines** of executable code. |
| **Clean Arguments** | Reduce the number of parameters a function takes. | Aim for **zero to two arguments**. Three is the absolute maximum. Refactor complex arguments into a dedicated input object/DTO. |
| **Avoid Flag Arguments** | Do not use a boolean argument to decide which path the function will execute. | Instead of `process(data, isAsync)`, create two separate functions: `processAsync(data)` and `processSync(data)`. |
| **Error Handling (Guard Clauses)** | Handle error conditions early and exit the function to avoid deep nesting. | Use **early returns** (guard clauses) for failure cases (`if (invalid) { return; }`) instead of wrapping the entire function body in a single `if/else` block. |

## 3. Formatting and Style

Consistency is paramount. These rules are non-negotiable and enforced by a linter (e.g., Prettier, ESLint, Black, gofmt).

| Style Rule | Standard | Enforcement |
| :--- | :--- | :--- |
| **Indentation** | **4 Spaces** (Tabs are forbidden). | Configured in the project's linter/formatter file. |
| **Line Length** | Maximum of **100 characters** per line. Break long lines to enhance readability. | Enforced by linter warning/error. |
| **Blank Lines** | Use blank lines to separate logical sections of code, such as: | - Between method/function definitions. - Between sections of a large method (e.g., variable declarations vs. core logic). |
| **Brace Style** | **One True Brace Style (OTBS)** / K&R style: Opening brace on the same line as the statement. | `if (condition) { // code }` |
| **Semicolons** | Mandatory for languages that support them to prevent unexpected behavior (e.g., JavaScript). | Enforced by linter. |

## 4. Documentation and Comments

Code should be largely self-documenting. Comments are for *why*, not *what*.

| Guideline | Description | Avoid |
| :--- | :--- | :--- |
| **Explain Intent (The "Why")** | Comments must explain the **business reasoning**, design choice, or **potential pitfall** of a non-obvious piece of code. | Comments that merely restate the obvious code, e.g., `// Add 1 to the count`. |
| **Public API (Docstrings)** | All public classes, methods, and functions **must** have a descriptive docstring/Javadoc/TSDoc comment explaining its purpose, parameters, return value, and exceptions. | Outdated or incomplete documentation. |
| **Commented-Out Code** | Never commit commented-out code. | If code is no longer needed, **delete it**. Git is for history. |
| **"Magic Numbers"** | Avoid using raw, unexplained literal values (magic numbers) or strings in the core logic. | Use named **constants** (See Section 1) or configuration variables instead. |

---

## 5. Architectural Principles (DRY & KISS)

| Principle | Acronym | Mandatory Application |
| :--- | :--- | :--- |
| **Don't Repeat Yourself** | **DRY** | Avoid duplication of logic or code blocks. Abstract common functionality into reusable components (functions, classes, utility modules). |
| **Keep It Simple, Stupid** | **KISS** | Favor the simplest possible implementation that satisfies the requirements. Do not over-engineer a solution with unnecessary complexity or abstractions. |
| **Single Source of Truth** | **SSOT** | Ensure configuration, data schema definitions, and key logic exist in only one location. |
| **YAGNI (You Aren't Gonna Need It)** | - | Do not write code for features that are not currently required, no matter how certain you are they will be needed later. Focus on the current scope. |

## 6. Code Review (PR) Guidelines

All code is subject to peer review. PRs will be rejected if they violate any of the rules above.

1.  **PR Size:** Keep Pull Requests small and focused on a single logical change (ideally under 400 lines of change).
2.  **Linter Pass:** All linter and static analysis checks **must** pass.
3.  **Test Coverage:** New features and bug fixes must include unit/integration tests and meet the required coverage thresholds.
4.  **Security:** All user input must be validated and sanitized. Do not hard-code sensitive credentials.