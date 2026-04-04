import type { AssessmentGoal } from "@/lib/commercialGoals";
import {
  type FitExpectationTag,
  type FitRoleProfile,
  type ResolvedFitMatrix,
  getWeightedCompetencyLabels,
  resolveFitMatrixFromConfig,
} from "@/lib/fitProfiles";
import { loadFitConfigSnapshot } from "@/lib/serverFitConfig";

export async function getServerFitRoleProfiles(): Promise<FitRoleProfile[]> {
  const snapshot = await loadFitConfigSnapshot();
  return snapshot.profiles;
}

export async function getServerFitExpectationTags(): Promise<FitExpectationTag[]> {
  const snapshot = await loadFitConfigSnapshot();
  return snapshot.expectations;
}

export async function getServerFitProfileById(id: string | null | undefined): Promise<FitRoleProfile | null> {
  if (!id) return null;
  const profiles = await getServerFitRoleProfiles();
  return profiles.find((item) => item.id === id) || null;
}

export async function resolveFitMatrixServer(args: {
  goal: AssessmentGoal;
  fitProfileId?: string | null;
  fitRequest?: string | null;
  targetRole?: string | null;
}): Promise<ResolvedFitMatrix> {
  const snapshot = await loadFitConfigSnapshot();
  return resolveFitMatrixFromConfig(args, snapshot.profiles, snapshot.expectations);
}

export { getWeightedCompetencyLabels };
