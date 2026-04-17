Production-oriented cleanup for evaluation/results flow.

Files:
- pages/api/commercial/projects/evaluation.ts
- pages/projects/[projectId]/results.tsx

What changed:
1. Frontend no longer keeps stacking duplicate evaluation requests for the same mode.
   - previous in-flight request is aborted before a new one starts
   - stale responses are ignored
   - requests use cache: no-store

2. Frontend now aborts evaluation requests on unmount.

3. Premium AI+ cache on the page is invalidated when AI+/fit parameters change,
   so the page does not keep showing stale evaluation for new inputs.

4. API now:
   - sends Cache-Control: private, no-store
   - sanitizes batch_start / batch_size
   - caps batch_size server-side
   - skips loading test_interpretations when the current stage does not need test bodies

Intent:
- reduce repeated work on /api/commercial/projects/evaluation
- make staged loading more stable under real usage
- avoid wasteful queries in summary/competency stages
