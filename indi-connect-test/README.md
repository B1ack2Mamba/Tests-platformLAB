# Indi Connect Test

Small Vercel probe for checking Supabase Indi connectivity from Russia without VPN.

## Vercel setup

1. Import this repository into Vercel.
2. Set **Root Directory** to `indi-connect-test`.
3. Deploy.

The project has public fallback values for the Indi Supabase URL and publishable key, so env variables are optional. If you prefer explicit env settings, add:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not add service role keys or database passwords to this test project.
