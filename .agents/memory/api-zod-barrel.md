---
name: api-zod barrel collision fix
description: How to resolve TS2308 collisions in lib/api-zod/src/index.ts when Orval generates both a Zod const and a TypeScript type with the same name.
---

## Rule
`lib/api-zod/src/index.ts` is a MANUALLY maintained barrel (not auto-generated).
It must use `export * from "./generated/api"` for Zod schemas, then
`export type * from "./generated/types/<each-file>"` for EVERY type file INDIVIDUALLY,
EXCLUDING any file whose name collides with a Zod const export in `api.ts`.

Currently excluded: `hireMedicalStaffBody` (the Zod const `HireMedicalStaffBody` in api.ts clashes).

**Why:** Orval emits `export const HireMedicalStaffBody = zod.object(...)` in `api.ts` and
also `export type HireMedicalStaffBody = {...}` in `types/hireMedicalStaffBody.ts`. TypeScript
raises TS2308 "already exported" even with `export type *` because the generated types/index.ts
uses plain `export *` (not type-only), making the re-export ambiguous.

**How to apply:** Whenever codegen runs and new request-body schemas are added that have both a
Zod const AND a types file with the same PascalCase name, add them to the explicit list in
`index.ts` but skip the conflicting types file. Run `pnpm --filter @workspace/beach-volleyball run typecheck`
to confirm no TS2308 errors after any codegen run.
