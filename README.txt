Updated demo-project logic:

1. Demo project now uses an explicit slug list instead of a broad type filter.
2. 16PF-B is excluded intentionally.
3. Included demo slugs:
   - 16pf-a
   - negotiation-style
   - motivation-cards
   - belbin
   - situational-guidance
   - time-management
   - learning-typology
   - usk
   - color-types
   - emin

4. Important behavior change:
   if a generator for one of these slugs is missing, the route throws an error
   instead of silently skipping the test. That makes the missing branch obvious.

Apply the patch in:
pages/api/admin/demo-project-create.ts
