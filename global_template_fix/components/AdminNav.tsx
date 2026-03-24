import Link from "next/link";
import { useSession } from "@/lib/useSession";
import { isAdminEmail } from "@/lib/admin";

export function AdminNav() {
  const { session, user } = useSession();
  if (!session || !user) return null;
  if (!isAdminEmail(user.email)) return null;

  return (
    <Link href="/admin" className="btn btn-secondary btn-sm">
      Админ
    </Link>
  );
}
