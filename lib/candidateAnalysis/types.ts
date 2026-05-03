import type { AssessmentGoal } from "@/lib/commercialGoals";
import type { ResolvedFitMatrix } from "@/lib/fitProfiles";

export type AttemptLike = {
  test_slug: string;
  test_title?: string | null;
  result: any;
};

export type CandidateProjectLike = {
  id?: string | null;
  title: string;
  goal: string;
  package_mode?: string | null;
  person_name?: string | null;
  person_email?: string | null;
  current_position?: string | null;
  notes?: string | null;
  target_role?: string | null;
  registry_comment?: string | null;
};

export type SignalFamily =
  | "16PF"
  | "Belbin"
  | "ЭМИН"
  | "УСК"
  | "Переговорный стиль"
  | "Мотивационные карты"
  | "Тайм-менеджмент"
  | "Типология обучения"
  | "Цветотипы"
  | "Ситуативное руководство"
  | "Другое";

export type NumericSignal = {
  family: SignalFamily;
  key: string;
  label: string;
  raw: number;
  score100: number;
  level?: string | null;
  sourceSlug: string;
  sourceTitle: string;
  scale: "sten" | "percent" | "count" | "derived";
};

export type CandidateFeatures = {
  attemptsCount: number;
  completedSlugs: string[];
  values: Partial<Record<SignalFamily, Record<string, NumericSignal>>>;
  topSignals: NumericSignal[];
};

export type EvidenceHit = {
  family: SignalFamily;
  key?: string;
  label: string;
  source: "core" | "supportive" | "contra" | "registry";
  strength: "weak" | "medium" | "strong";
  score100?: number;
};

export type CompetencyScore = {
  id: string;
  name: string;
  cluster: string;
  definition: string;
  score: number;
  level: "low" | "medium" | "high";
  status: string;
  evidence: EvidenceHit[];
  contra: EvidenceHit[];
  families: SignalFamily[];
  confidence: "low" | "medium" | "high";
  interviewQuestions: string[];
  notes: string[];
};

export type DomainKey =
  | "thinking"
  | "management"
  | "communication"
  | "selfOrganization"
  | "emotional"
  | "motivation";

export type DomainScores = Record<DomainKey, number>;

export type RegistryCalibrationIntent = {
  id: string;
  label: string;
  reason: string;
  weightAdjustments: Record<string, number>;
  criticalCompetencies: string[];
};

export type RegistryCalibration = {
  hasComment: boolean;
  comment: string;
  intents: RegistryCalibrationIntent[];
  matrix: ResolvedFitMatrix;
  competencyAdjustments: Array<{
    competencyId: string;
    delta: number;
    reason: string;
  }>;
};

export type FitSnapshot = {
  index: number;
  label: string;
  matrix: ResolvedFitMatrix;
  domains: DomainScores;
  competencies: CompetencyScore[];
  strengths: string[];
  risks: string[];
  bestFor: string[];
  interviewQuestions: string[];
  explanation: string[];
};

export type CandidateRegistryAnalysis = {
  candidate: {
    projectId?: string | null;
    name: string | null;
    title: string;
    goal: AssessmentGoal | string;
    currentPosition: string | null;
    targetRole: string | null;
  };
  features: CandidateFeatures;
  baseline: FitSnapshot;
  calibrated: FitSnapshot;
  delta: {
    index: number;
    domains: DomainScores;
    competencies: Array<{
      competencyId: string;
      name: string;
      before: number;
      after: number;
      delta: number;
      reason: string;
    }>;
  };
  registryCalibration: RegistryCalibration;
  summary: string;
  comparisonLine: string;
};
