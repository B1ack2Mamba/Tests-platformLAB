import type { NextApiRequest, NextApiResponse } from "next";
import { getServerFitRoleProfiles } from "@/lib/serverFitProfiles";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const profiles = await getServerFitRoleProfiles();
    return res.status(200).json({ ok: true, profiles });
  } catch (error: any) {
    return res.status(200).json({ ok: true, profiles: [], warning: error?.message || "fallback" });
  }
}
