# Prompt Template: Implementation Plan First

You are working on DegreeWiki.

Before coding, read only these files:

- docs/00-project-overview.md
- docs/01-product-decisions.md
- docs/02-architecture.md
- docs/06-status.md
- docs/phases/[CURRENT_PHASE].md

Do not read unrelated docs unless needed.

Task:
[PASTE TASK HERE]

Rules:

1. Do not write code yet.
2. First return only:
   - understanding summary
   - implementation plan
   - files you expect to create/change
   - database changes, if any
   - RLS/security considerations, if any
   - risks/assumptions
   - questions only if blocked
3. Do not change architecture silently.
4. Do not implement beyond the approved task.
5. Keep Cloudflare Workers compatibility in mind.
6. Avoid Node-only runtime APIs unless explicitly approved.

After I approve the plan, implement.

After implementation:

1. Provide summary of changes.
2. List changed files.
3. List commands run.
4. List tests/checks run.
5. List remaining issues.
6. Update docs/06-status.md.
7. Append to docs/07-task-log.md.