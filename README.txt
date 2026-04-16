Patch purpose:
Disable paid author interpretation purchase for test pages opened via ?invite=...

Files:
- pages/tests/[slug]/take.tsx
- global_template_fix/pages/tests/[slug]/take.tsx

What changed:
- Conditions that triggered paid interpretation flow now also require !isInviteMode().
- This prevents "Insufficient balance" on invited/project test completion while preserving normal paid flow outside invite mode.
