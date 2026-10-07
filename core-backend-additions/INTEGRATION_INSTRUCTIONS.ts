/**
 * ──────────────────────────────────────────────────────────────────
 *  INTEGRATION INSTRUCTIONS FOR paralearn-backend (Core RMS)
 * ──────────────────────────────────────────────────────────────────
 *
 *  1. Copy the `cbt-import/` folder into:
 *       paralearn-backend/src/cbt-import/
 *
 *  2. Fix the Prisma import path in cbt-import.module.ts:
 *       Change: import { PrismaModule } from '../prisma/prisma.module';
 *       To:     import { PrismaModule } from 'src/prisma/prisma.module';
 *       (or whatever your project's import convention is)
 *
 *  3. Register the module in app.module.ts:
 *
 *       import { CbtImportModule } from './cbt-import/cbt-import.module';
 *
 *       @Module({
 *         imports: [
 *           ...existing modules,
 *           CbtImportModule,  // <--- add this
 *         ],
 *       })
 *
 *  4. Add the route prefix to TenantMiddleware exclusions in app.module.ts:
 *       The controller already uses 'non-tenant/cbt-import' prefix, which
 *       is covered by the existing 'non-tenant/(.*)' exclusion pattern.
 *       No changes needed.
 *
 *  5. Add CBT_SERVICE_SECRET to your .env if not already present:
 *       CBT_SERVICE_SECRET="pln_cbt_internal_secret_2026"
 *       (Must match the same value in the CBT microservice's .env)
 *
 *  New Endpoints:
 *    POST /non-tenant/cbt-import/classes
 *      Headers: x-cbt-service-key: <CBT_SERVICE_SECRET>
 *      Body:    { email: string, schoolId: string }
 *      Returns: { user, tier, classes: [{ id, name, code, level, stream, activeStudents }] }
 *
 *    POST /non-tenant/cbt-import/students
 *      Headers: x-cbt-service-key: <CBT_SERVICE_SECRET>
 *      Body:    { email: string, schoolId: string, classIds: string[] }
 *      Returns: { user, totalStudents, classesRequested, students: [...] }
 */
export {};
