# ParaLearn Computer-Based Testing (CBT) Backend Microservice
[![NestJS](https://img.shields.io/badge/Framework-NestJS%2011-ea2845.svg)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%206-2d3748.svg)](https://www.prisma.io/)
[![Redis](https://img.shields.io/badge/Cache-Redis%20ioRedis-dc382d.svg)](https://redis.io/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-3178c6.svg)](https://www.typescriptlang.org/)

Autonomous, high-throughput Computer-Based Testing (CBT) microservice engine for **ParaLearn**. Designed to handle live mock exams (JAMB, WAEC, NECO) and continuous assessment tests with sub-millisecond timer synchronization, zero-DB-write live answer buffering, real-time malpractice telemetry, deterministic auto-grading, and automated term report card synchronization.

---

## Key Features

1. **Dual Workspace Abstraction:**
   - **`INSTITUTION` (ParaLearn Schools):** Integrated via SSO with unlimited candidate testing. Scores auto-export into continuous assessment term report cards.
   - **`STANDALONE_HALL` (Independent Tutors & Exam Centers):** Self-service accounts with 30 free candidate credits on signup, automated credit deductions, and developer API key access.
2. **Sub-Millisecond Timers & Answer Buffering:**
   - Candidates submit answers to an ephemeral Redis hash table (<5ms latency), avoiding database bottlenecks during high-concurrency exams.
   - Resilient in-memory fallback if Redis is temporarily unreachable.
3. **Anti-Cheat Malpractice Proctoring:**
   - Real-time tracking of browser window blur, tab switches, and fullscreen exits.
   - Automatic candidate disqualification when `maxTabViolations` is exceeded.
4. **Deterministic Auto-Grading & WAEC Scoring:**
   - Automatic evaluation of MCQ, True/False, and Multi-Select questions with standard Nigerian WAEC grades (`A1`, `B2`, `B3`, `C4`, `C5`, `C6`, `D7`, `E8`, `F9`).
5. **Bulk Question Ingestion:**
   - Multipart Excel (`.xlsx`) parser mapping question sheets directly into active exams and the workspace question bank.
   - Markdown and KaTeX LaTeX formula support (`$E = mc^2$`).
6. **Developer Platform & Webhooks:**
   - HMAC-SHA256 signed webhooks (`exam.attempt.completed`) dispatched directly to external application endpoints.

---

## Architecture Overview

```mermaid
flowchart TD
    subgraph Clients["Candidate & Teacher Clients"]
        C1["Candidate Runner (/take/:code/live)"]
        C2["Educator Studio (/cbt/exams/:id)"]
        C3["Live Invigilator Board (/cbt/exams/:id/monitor)"]
        C4["External Applications (via API Key)"]
    end

    subgraph Service["ParaLearn CBT Microservice (Port 4000)"]
        API["NestJS REST Controllers"]
        W["Workspaces Module"]
        E["Exams Module"]
        Q["Questions Module"]
        A["Attempts & Grading Engine"]
        S["Sync & Webhook Dispatcher"]
        R["Redis Caching Layer (Sub-ms Timers & Ephemeral Buffer)"]
        DB[("PostgreSQL DB (Prisma ORM)")]
    end

    subgraph Core["ParaLearn Core (SIS)"]
        SIS["Continuous Assessment / Report Cards"]
    end

    Clients --> API
    API --> W & E & Q & A & S
    A <--> R
    W & E & Q & A --> DB
    S -- "POST /rms/cbt-sync" --> SIS
```

---

## Quickstart

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in your database credentials:
```bash
cp .env.example .env
```

Key environment variables:
```env
PORT=4000
CBT_DATABASE_URL="postgresql://user:password@localhost:5432/paralearn_cbt?schema=public"
REDIS_HOST="localhost"
REDIS_PORT=6379
PARALEARN_CORE_API_URL="http://localhost:3000/api"
CBT_SERVICE_SECRET="pln_cbt_internal_secret_2026"
```

### 2. Install & Generate Database Client
```bash
npm install
npm run prisma:generate
```

### 3. Run Migrations
```bash
npx prisma migrate dev --name init
```

### 4. Start the Application
```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

### 5. Interactive API Documentation
Once running, open your browser to view the OpenAPI Swagger documentation:
```
http://localhost:4000/api/docs
```

---

## API Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/workspaces/standalone` | Create independent exam hall & receive API key |
| `POST` | `/workspaces/institution` | Sync or retrieve ParaLearn school workspace |
| `POST` | `/exams` | Provision exam, room access code, and anti-cheat policies |
| `GET` | `/exams/code/:accessCode` | Candidate lobby gate (strips correct answers) |
| `GET` | `/exams/:id/monitor` | Real-time invigilation board metrics |
| `POST` | `/questions/bulk` | Bulk create questions with Markdown/LaTeX |
| `POST` | `/questions/import-excel` | Multipart upload for `.xlsx` question bank |
| `POST` | `/attempts/start` | Launch test session, deduct credit, start timer |
| `POST` | `/attempts/:id/answer` | Ephemeral answer buffering in Redis (<5ms) |
| `POST` | `/attempts/:id/telemetry` | Report tab switch / blur malpractice event |
| `POST` | `/attempts/:id/submit` | Final submission & instant deterministic auto-grading |
| `GET` | `/attempts/:id/slip` | Retrieve candidate result slip |
| `POST` | `/sync/export-scores/:examId` | Dispatch scores to ParaLearn Core Term Report Cards |
| `GET` | `/sync/export-csv/:examId` | Download CSV score sheet |

---

## External Integrations & Webhooks
For complete developer guides, HMAC-SHA256 signature verification code in Node.js, Python, and PHP, see [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md).

---

## License
Proprietary &copy; 2026 ParaLearn Hub Nigeria. All rights reserved.
