# Read-only migration export

Run on the new Linux server. These tools use a shared PostgreSQL snapshot,
verify-full TLS, COPY row-count checks and per-table content hashes.
The source password is entered through getpass and is never a command argument.
All dumps and detailed diagnostics remain in `/opt/kadrlab/backups` (root only).

`fetch_upstream.py` downloads four official Supabase CLI v2.121.0 files directly
from the pinned URLs in `upstream.json` and checks their SHA-256. These upstream
files are not redistributed in this repository. Run the downloader before export.
The public Supabase CA certificate is included as the TLS trust anchor.

The `bin/` wrappers use the official PostgreSQL 17 container with a host network
and read-only bind mounts. Install psycopg 3 in a private Python virtual environment,
pull `postgres:17`, and make the three wrappers executable before export.
Set `SOURCE_DB_HOST` and `SOURCE_DB_USER` for the source session pooler.

The filtered roles/schema/data files are migration inputs. The unfiltered custom
archive is a recovery copy; do not restore it over managed Supabase system schemas.
A completed export does not prove a tested restore or a production cutover.
