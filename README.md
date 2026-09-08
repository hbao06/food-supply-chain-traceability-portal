# Food Supply Chain Traceability & Provenance Portal

> **Software Engineering Final Project – Course 502045**  
> **Group 13 – Topic 19**  
> Web-based platform for food supply-chain traceability and consumer provenance through QR codes.

---

## 📚 Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Objectives](#2-objectives)
- [3. Business Flow](#3-business-flow)
- [4. Core Features](#4-core-features)
- [5. User Roles](#5-user-roles)
- [6. System Architecture](#6-system-architecture)
- [7. Technology Stack](#7-technology-stack)
- [8. Repository Structure](#8-repository-structure)
- [9. Development Phases](#9-development-phases)
- [10. Team Responsibilities](#10-team-responsibilities)
- [11. GitHub Workflow](#11-github-workflow)
- [12. Branch Convention](#12-branch-convention)
- [13. Commit Convention](#13-commit-convention)
- [14. Issue Workflow](#14-issue-workflow)
- [15. Pull Request Workflow](#15-pull-request-workflow)
- [16. Code Review Rules](#16-code-review-rules)
- [17. Local Development Setup](#17-local-development-setup)
- [18. Environment Variables](#18-environment-variables)
- [19. Running the Project](#19-running-the-project)
- [20. Database Workflow](#20-database-workflow)
- [21. API Development](#21-api-development)
- [22. Frontend Development](#22-frontend-development)
- [23. Testing & QA](#23-testing--qa)
- [24. Documentation](#24-documentation)
- [25. Definition of Done](#25-definition-of-done)
- [26. Common Git Commands](#26-common-git-commands)
- [27. Rules & Forbidden Actions](#27-rules--forbidden-actions)
- [28. Troubleshooting](#28-troubleshooting)
- [29. Sprint Plan](#29-sprint-plan)
- [30. Project Deliverables](#30-project-deliverables)
- [31. Current Project Status](#31-current-project-status)

---

# 1. Project Overview

The **Food Supply Chain Traceability & Provenance Portal** records important events throughout a food supply chain, from production to distribution.

Consumers can scan a QR code and view the provenance timeline of a product.

### Main flow

```text
Production
    ↓
Batch Creation
    ↓
Transportation
    ↓
Processing
    ↓
Packaging
    ↓
Distribution
    ↓
QR Code Scanning
    ↓
Consumer Provenance Timeline
```

The project focuses on:

- Traceability
- Transparency
- Supply-chain event tracking
- QR-based lookup
- Role-Based Access Control (RBAC)
- Auditability
- Sequence integrity
- Software quality and testing

---

# 2. Objectives

The system aims to:

1. Allow authorized users to create food batches.
2. Record supply-chain events associated with each batch.
3. Maintain an ordered provenance history.
4. Generate a QR code for each traceable batch.
5. Allow consumers to scan a QR code and view provenance.
6. Provide a clear provenance timeline.
7. Apply RBAC to protected functions.
8. Maintain an append-only audit trail.
9. Validate valid event sequences.
10. Demonstrate professional Agile/Scrum and GitHub practices.

---

# 3. Business Flow

```text
Farmer / Producer
      │
      │ Create batch
      ▼
Batch Management
      │
      ▼
Distributor
      │
      │ Transportation
      ▼
Processor
      │
      │ Processing
      ▼
Packaging
      │
      ▼
Distribution
      │
      ▼
QR Code
      │
      │ Scan
      ▼
Consumer Portal
      │
      ▼
Provenance Timeline
```

Example batch:

```text
Batch ID: BATCH-2026-001
Product: Organic Mango
Production Date: 2026-09-01
Origin: Farm A
```

Timeline:

```text
1. Production
2. Transportation
3. Processing
4. Packaging
5. Distribution
```

---

# 4. Core Features

## 4.1 Batch Creation

Authorized producers can create a food batch.

Typical information:

- Batch ID
- Product name
- Product type
- Origin
- Production date
- Quantity
- Unit
- Producer
- Status

## 4.2 Supply Chain Event Management

Authorized actors can add events such as:

- Production
- Transportation
- Processing
- Packaging
- Distribution

An event may contain:

- Batch ID
- Event type
- Actor
- Timestamp
- Location
- Description
- Status

## 4.3 QR Code Generation

Each traceable batch can have a QR code.

```text
Batch
  ↓
QR Code
  ↓
Consumer Provenance URL
```

The QR should lead to a consumer-facing provenance page rather than expose administrative functions.

## 4.4 Consumer Provenance Portal

Consumers can:

1. Scan QR code.
2. Open the provenance page.
3. View batch information.
4. View the supply-chain timeline.
5. View origin and traceability information.

## 4.5 Audit Trail

Important actions are recorded for accountability:

```text
User created batch
User added transportation event
User added processing event
User generated QR code
```

Audit history is **append-only**. Existing audit records should not be silently modified or deleted.

## 4.6 Role-Based Access Control

Example roles:

```text
ADMIN
PRODUCER
DISTRIBUTOR
PROCESSOR
CONSUMER
```

Protected backend endpoints must validate permissions.

---

# 5. User Roles

| Role              | Main Responsibility                       |
| ----------------- | ----------------------------------------- |
| Administrator     | Users, roles and system administration    |
| Producer / Farmer | Create batches and production information |
| Distributor       | Transportation/distribution events        |
| Processor         | Processing information                    |
| Consumer          | Scan QR and view provenance               |
| QA / Team Member  | Testing and verification                  |

> Exact permissions should be finalized in the SRS and API specification.

---

# 6. System Architecture

Initial architecture:

```text
┌──────────────────────────────┐
│          Frontend            │
│      React / Next.js         │
└──────────────┬───────────────┘
               │ REST / HTTP
               ▼
┌──────────────────────────────┐
│          Backend             │
│       API / Services         │
│                              │
│ - Authentication & RBAC      │
│ - Batch Management           │
│ - Audit Trail                │
│ - Timeline Aggregation       │
│ - QR Code Engine             │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│          Database            │
│       PostgreSQL / MySQL     │
└──────────────────────────────┘
```

## Backend services

### Authentication & RBAC

- Login
- Authentication
- Authorization
- Role validation

### Batch Management

- Create/retrieve batches
- Batch status
- Batch validation

### Audit Trail

- Record important actions
- Maintain historical records

### Timeline Aggregation

- Collect events
- Order events
- Return provenance timeline

### QR Code Engine

- Generate QR codes
- Associate QR codes with batches
- Provide consumer provenance URL

---

# 7. Technology Stack

Recommended stack:

### Frontend

- React / Next.js
- TypeScript / JavaScript
- Bootstrap or Tailwind CSS

### Backend

- Node.js
- Express.js or NestJS

### Database

- PostgreSQL

Alternative:

- MySQL

### Authentication

- JWT or session-based authentication
- Password hashing
- RBAC

### Testing

- Jest
- Supertest
- Playwright
- Postman / Newman

### Version Control

- Git
- GitHub

### Deployment

- Docker
- Docker Compose

> The team must finalize one stack before implementation and keep this README synchronized with the actual project configuration.

---

# 8. Repository Structure

```text
food-supply-chain-traceability-portal/
│
├── README.md
├── .gitignore
├── .env.example
├── docker-compose.yml
│
├── frontend/
├── backend/
├── database/
├── tests/
│
├── docs/
│   ├── SRS/
│   ├── UML/
│   ├── ERD/
│   └── openapi-spec.yaml
│
└── .github/
    ├── PULL_REQUEST_TEMPLATE.md
    └── workflows/
        └── ci.yml
```

---

# 9. Development Phases

## Phase 1 – Leader / Repository Setup

The leader prepares the shared project infrastructure:

- GitHub repository
- Team members
- Branch rules
- `.gitignore`
- Repository structure
- Root README
- PR template
- Issue templates
- `.env.example`
- Docker configuration
- CI skeleton
- Git workflow
- Branch naming
- Commit convention

### Current situation

The repository is already **past the basic repository setup stage**:

- Repository created
- Team structure created
- `main` protection/rules configured
- Initial project structure merged through PR
- User Stories document merged through PR

The remaining Sprint 1 design/documentation work is still in progress.

## Phase 2 – Team Onboarding

Each member independently:

1. Installs required tools.
2. Clones the shared repository.
3. Reads this README.
4. Configures local environment.
5. Runs the project locally.
6. Confirms their environment works.

## Phase 3 – Development

Tasks are divided by responsibility.

```text
Issue
 ↓
Branch
 ↓
Implementation
 ↓
Commit
 ↓
Push
 ↓
Pull Request
 ↓
Peer Review
 ↓
Approval
 ↓
Merge to main
```

---

# 10. Team Responsibilities

## M1 – Trương Huỳnh Hoài Bảo

**Frontend / UI-UX Lead**

Responsibilities:

- Login UI
- Batch creation UI
- QR scanner UI
- Provenance timeline UI
- Consumer portal
- Responsive interface
- API integration

Example branches:

```text
feature/login-ui
feature/create-batch-ui
feature/provenance-scanner
feature/timeline-ui
```

## M2 – Chung Nguyễn Minh Trí

**Backend API / Microservices Lead**

Responsibilities:

- Batch API
- Supply-chain event API
- Audit API
- QR engine
- Timeline API
- Backend validation

Example branches:

```text
feature/batch-api
feature/audit-api
feature/qr-engine
feature/timeline-api
```

## M3 – Lê Bá Khánh Bình

**Database, Auth & Security Lead**

Responsibilities:

- Database schema
- Migrations
- Relationships
- Authentication
- RBAC
- Password security
- Database security

Example branches:

```text
feature/database-schema
feature/auth
feature/rbac
feature/audit-database
```

## M4 – Đặng Vĩnh Quang

**QA, DevOps & Integration Test Lead**

Responsibilities:

- Test plan
- Unit tests
- API integration tests
- Sequence integrity tests
- RBAC/security tests
- CI/CD
- Docker integration
- Deployment verification

Example branches:

```text
test/batch-sequence
test/api-contract
test/integration
test/rbac-security
```

---

# 11. GitHub Workflow

## Golden Rule

> **NEVER work directly on `main`.**

Standard workflow:

```text
GitHub Issue
     ↓
Task branch
     ↓
Develop
     ↓
Commit
     ↓
Push
     ↓
Pull Request
     ↓
Peer Review
     ↓
Fix feedback
     ↓
Approval
     ↓
Merge into main
     ↓
Delete branch
```

---

# 12. Branch Convention

### Feature

```text
feature/<task-name>
```

Examples:

```text
feature/batch-creation
feature/qr-code
feature/provenance-timeline
```

### Bug fix

```text
fix/<problem-name>
```

Examples:

```text
fix/invalid-batch-status
fix/qr-scan-error
```

### Testing

```text
test/<task-name>
```

### Documentation

```text
docs/<task-name>
```

### Maintenance

```text
chore/<task-name>
```

---

# 13. Commit Convention

Use meaningful messages.

```text
feat: implement batch creation form
fix: prevent invalid batch status transition
test: add sequence integrity tests
docs: add use case diagram
refactor: simplify batch service
chore: initialize project structure
```

Avoid:

```text
update
fix
test
abc
final
final2
done
```

---

# 14. Issue Workflow

Every significant task must have a GitHub Issue.

Recommended format:

```text
[SETUP] Initialize project structure
[REQUIREMENTS] Define User Stories & Use Cases
[DESIGN] Create Use Case Diagram
[FEATURE] Implement Batch Creation
[FEATURE] Implement QR Code Generation
[TEST] Add Sequence Integrity Tests
[DOCS] Complete OpenAPI Specification
```

Each Issue should contain:

- Objective
- Description
- Tasks
- Acceptance Criteria
- Definition of Done
- Assignee

User Stories should use Gherkin-style acceptance criteria where required:

```gherkin
Given ...
When ...
Then ...
```

---

# 15. Pull Request Workflow

When a task is complete:

```bash
git push -u origin feature/<task-name>
```

Create a Pull Request.

Recommended title:

```text
feat: implement batch creation API
```

Description should link the Issue:

```text
Closes #<ISSUE_NUMBER>
```

Example:

```text
Closes #15
```

A PR should normally include:

- Linked Issue
- Summary of changes
- Verification/testing
- Reviewer request
- Any known limitations

---

# 16. Code Review Rules

## Author

The author:

- Implements the task.
- Creates the PR.
- Responds to review comments.
- Fixes requested changes.
- Merges after approval.

## Reviewer

The reviewer:

- Reads the changes.
- Checks requirements.
- Checks correctness.
- Checks code quality.
- Checks tests.
- Approves or requests changes.

### Mandatory rule

> **The PR author must not self-approve their own PR.**

Example:

```text
Bảo develops
    ↓
Bảo creates PR
    ↓
Trí reviews
    ↓
Trí approves
    ↓
Bảo merges
```

Reviewer rotation should ensure all members participate.

---

# 17. Local Development Setup

Each member owns their local environment.

The shared repository provides project configuration, but each computer must install its own tools.

## Clone

```bash
git clone <REPOSITORY_URL>
cd food-supply-chain-traceability-portal
```

## Check branch

```bash
git branch
```

## Update main

```bash
git checkout main
git pull origin main
```

## Create a task branch

```bash
git checkout -b feature/<task-name>
```

Example:

```bash
git checkout -b feature/create-batch-ui
```

---

# 18. Environment Variables

Create local environment variables from:

```text
.env.example
```

Example:

```env
APP_PORT=3000
DATABASE_URL=
JWT_SECRET=
```

### Never commit:

```text
.env
.env.local
passwords
API keys
JWT secrets
database credentials
private tokens
```

The `.gitignore` must exclude sensitive local configuration.

---

# 19. Running the Project

The exact commands depend on the finalized stack.

Example frontend:

```bash
cd frontend
npm install
npm run dev
```

Example backend:

```bash
cd backend
npm install
npm run dev
```

Docker Compose:

```bash
docker compose up --build
```

Stop:

```bash
docker compose down
```

> Before the first official development sprint, replace these examples with the exact commands from the actual project configuration.

---

# 20. Database Workflow

Database changes must be coordinated.

Before changing the schema:

1. Create/update an Issue.
2. Discuss the change with the team.
3. Update ERD if needed.
4. Create migration/schema changes.
5. Test locally.
6. Commit.
7. Create PR.
8. Request review.

Main conceptual entities:

```text
User
Batch
SupplyChainEvent
QRCode
```

Conceptual relationship:

```text
User
 ├── creates ──> Batch
 ├── performs ─> Audit Record
 │
Batch
 ├── has ──────> SupplyChainEvent
 └── has ──────> QRCode
```

---

# 21. API Development

Backend APIs must follow the agreed OpenAPI contract:

```text
docs/openapi-spec.yaml
```

Before implementing an endpoint, verify:

- HTTP method
- URL
- Request body
- Parameters
- Authentication
- Authorization
- Response format
- Error responses
- Status codes

Example:

```text
POST /api/batches
```

Frontend and backend members must communicate before changing a shared API contract.

---

# 22. Frontend Development

Main UI areas:

```text
Authentication
    ↓
Dashboard
    ↓
Batch Management
    ↓
Supply Chain Events
    ↓
QR Code
    ↓
Consumer Scanner
    ↓
Provenance Timeline
```

Frontend should handle:

- Form validation
- Loading states
- Error states
- Responsive design
- API integration
- QR scanning
- Timeline visualization

---

# 23. Testing & QA

Testing must be performed throughout development.

## Unit Testing

Test individual functions/services.

Target:

```text
Coverage >= 60%
```

## API Integration Testing

Verify:

- Request
- Authentication
- Authorization
- Database interaction
- Response
- Error handling

## Sequence Integrity

Example valid sequence:

```text
Production
 ↓
Transportation
 ↓
Processing
```

Invalid transitions should be rejected according to the business rules.

## RBAC / Security

Verify each role only accesses authorized operations.

## QR Traceability

Test:

```text
Batch
 ↓
QR
 ↓
Consumer URL
 ↓
Correct Batch
 ↓
Correct Timeline
```

## Audit Immutability

Verify historical audit records cannot be silently modified or deleted.

---

# 24. Documentation

Maintain documentation under:

```text
docs/
├── SRS/
├── UML/
├── ERD/
└── openapi-spec.yaml
```

Documentation should evolve with implementation.

Do not leave all documentation until the final week.

---

# 25. Definition of Done

A task is Done only when:

- [ ] GitHub Issue exists.
- [ ] Issue is assigned.
- [ ] Correct branch is created.
- [ ] Work is completed.
- [ ] Code follows conventions.
- [ ] Tests are added where applicable.
- [ ] Local verification is completed.
- [ ] Meaningful commit exists.
- [ ] Branch is pushed.
- [ ] Pull Request is created.
- [ ] PR links the Issue.
- [ ] Another member reviews the PR.
- [ ] Feedback is addressed.
- [ ] PR is approved.
- [ ] PR is merged into `main`.

---

# 26. Common Git Commands

## Status

```bash
git status
```

## Branches

```bash
git branch
```

## Update main

```bash
git checkout main
git pull origin main
```

## Create branch

```bash
git checkout -b feature/<task-name>
```

## Stage

```bash
git add .
```

## Commit

```bash
git commit -m "feat: description"
```

## Push

```bash
git push -u origin feature/<task-name>
```

## History

```bash
git log --oneline --decorate -5
```

## Update feature branch

```bash
git checkout main
git pull origin main

git checkout feature/<task-name>
git merge main
```

After resolving conflicts:

```bash
git add .
git commit
git push
```

## After PR merge

```bash
git checkout main
git pull origin main
```

Then create the next task branch.

---

# 27. Rules & Forbidden Actions

## ❌ Never push directly to main

Do not use:

```bash
git push origin main
```

for normal development.

## ❌ Do not work directly on main

Always create a task branch.

## ❌ Do not commit secrets

Never commit `.env`, passwords, tokens, API keys or credentials.

## ❌ Do not self-approve

A PR requires review by another team member.

## ❌ Do not create random branch names

Follow the branch convention.

## ❌ Do not change shared API contracts silently

Coordinate frontend/backend changes.

## ❌ Do not overwrite another member's work without communication

Use Issues, discussion and PRs.

---

# 28. Troubleshooting

## Branch is behind main

```bash
git checkout main
git pull origin main
git checkout feature/<task-name>
git merge main
```

## Uncommitted changes

```bash
git status
```

Review changes before switching branches.

Avoid blindly using:

```bash
git reset --hard
```

because local work can be lost.

## Merge conflict

1. Open conflicted files.
2. Resolve conflict markers.
3. Test the project.
4. Stage files:

```bash
git add .
```

5. Complete the merge.
6. Push the branch.

## PR cannot merge

Check:

- Required review
- CI checks
- Merge conflicts
- Branch status
- Repository rules

---

# 29. Sprint Plan

## Sprint 1 – Foundation & Planning

**Weeks 1–2**

Goals:

- Project setup
- Requirements
- User Stories
- Use Cases
- ERD
- API contract
- UI wireframes
- Test plan

Outputs:

```text
GitHub Issues
User Stories
Use Case Diagram
ERD
OpenAPI Specification
UI Wireframes
Test Plan
```

## Sprint 2 – Core Implementation

**Weeks 3–4**

Goals:

- Authentication
- RBAC
- Database
- Batch Creation API
- Batch Creation UI

## Sprint 3 – Traceability

**Weeks 5–6**

Goals:

- Audit Trail API
- QR Code Engine
- Consumer Scanner
- Provenance Timeline
- Integration testing

## Sprint 4 – QA, Security & Finalization

**Weeks 7–8**

Goals:

- Timeline aggregation
- Sequence integrity
- Security testing
- Integration testing
- Bug fixing
- CI
- Deployment
- Documentation
- Final demo

---

# 30. Project Deliverables

## Source code

```text
frontend/
backend/
database/
tests/
```

## Documentation

```text
README.md
docs/SRS/
docs/UML/
docs/ERD/
docs/openapi-spec.yaml
```

## GitHub evidence

The repository should demonstrate:

- Issues
- Assigned tasks
- Individual commits
- Feature branches
- Pull Requests
- Peer reviews
- Approvals
- Merged PRs
- Testing evidence
- CI evidence

## Deployment

Either:

```text
Public application URL
```

or:

```text
Working docker-compose
```

---

# 31. Current Project Status

## Current stage

The project is currently at:

> **Sprint 1 – Foundation & Planning / Repository & Requirements Setup**

The GitHub foundation has already been established and the team has successfully tested the basic Issue → Branch → Commit → Push → Pull Request → Review → Merge workflow.

### Completed

```text
✅ GitHub repository
✅ Team repository structure
✅ main branch protection/rules
✅ Initial project structure
✅ PR workflow tested
✅ [SETUP] Initialize project structure
✅ User Stories document
```

### Still needed in Sprint 1

```text
⏳ Use Case Diagram
⏳ ERD
⏳ OpenAPI specification
⏳ UI wireframes
⏳ Test Plan
⏳ Finalize technology stack
⏳ Complete team onboarding
```

### Not yet the main focus

```text
⏳ Authentication implementation
⏳ RBAC implementation
⏳ Batch API
⏳ Batch UI
⏳ QR Engine
⏳ Provenance Timeline
⏳ Integration testing
⏳ CI/CD
⏳ Deployment
```

---

# 👑 Leader Principle

The leader should not become the only person who knows how the project works.

The target workflow is:

```text
Leader sets up repository
        ↓
Members clone repository
        ↓
Members read README
        ↓
Members configure their own environment
        ↓
Members understand Git workflow
        ↓
Members receive assigned Issues
        ↓
Members develop on branches
        ↓
Members create PRs
        ↓
Members review each other
        ↓
Team integrates through main
```

Every member should be able to:

- Clone the project
- Configure the environment
- Run the project
- Understand the architecture
- Find assigned tasks
- Create branches
- Commit changes
- Push changes
- Create PRs
- Review another member's PR
- Update branches
- Continue development

---

# 🤝 Team Principles

1. Communicate before changing another module.
2. Keep Issues and PRs clear.
3. Use meaningful commit messages.
4. Review code objectively.
5. Review the implementation, not the person.
6. Address review feedback.
7. Keep documentation synchronized with implementation.
8. Every member must have genuine GitHub contribution evidence.
9. Test before asking for review.
10. Keep `main` stable.

---

# 📜 Academic / Team Rule

> **Code is not officially integrated until it enters `main` through the team's Pull Request and peer-review process.**

> **Every member must maintain genuine individual GitHub contribution evidence throughout the project.**

> **Quality, traceability, collaboration and reproducibility are as important as writing code.**

---

## 👨‍💻 Group 13

**Topic:** Food Supply Chain Traceability & Provenance Portal  
**Course:** Software Engineering – 502045  
**Group:** 13

| Member                | Role                               |
| --------------------- | ---------------------------------- |
| Trương Huỳnh Hoài Bảo | Frontend / UI-UX Lead              |
| Chung Nguyễn Minh Trí | Backend API / Microservices Lead   |
| Lê Bá Khánh Bình      | Database, Auth & Security Lead     |
| Đặng Vĩnh Quang       | QA, DevOps & Integration Test Lead |

---

## ⭐ Build transparently. Review carefully. Test continuously. Ship together.
