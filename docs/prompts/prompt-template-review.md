# Prompt Template: Review Existing Work

You are reviewing DegreeWiki implementation work.

Read only:

- docs/00-project-overview.md
- docs/01-product-decisions.md
- docs/02-architecture.md
- docs/06-status.md
- docs/phases/[CURRENT_PHASE].md
- files changed in the implementation

Review for:

1. Requirement match
2. Architecture consistency
3. Database correctness
4. RLS/security issues
5. Cloudflare compatibility
6. TypeScript quality
7. SEO implications
8. Data quality/verification implications
9. Overengineering
10. Missing tests/checks

Return:

- approved / needs changes
- critical issues
- recommended improvements
- files that need edits
- exact fix plan

Do not rewrite unrelated code.
Do not expand scope.