export type HelpAudience = "customer" | "admin";

export type HelpMode = "ON" | "OFF" | "AUTO";

export type HelpQuickStartStep = {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  route?: string;
};

export type HelpTermDefinition = {
  term: string;
  definition: string;
};

export type HelpQuestionAnswer = {
  question: string;
  answer: string;
};

export type HelpRelatedPage = {
  label: string;
  href: string;
};

export type PageHelpEntry = {
  id: string;
  route: string;
  title: string;
  shortDescription: string;
  purpose: string;
  whyItMatters: string;
  recommendedFirstAction: string;
  estimatedTime?: string;
  quickStartSteps: HelpQuickStartStep[];
  tips: string[];
  terminology: HelpTermDefinition[];
  commonQuestions: HelpQuestionAnswer[];
  relatedPages: HelpRelatedPage[];
  videoUrl?: string;
  academyLessonId?: string;
  audience?: HelpAudience;
  comingSoon?: string[];
};

export type AcademyLesson = {
  lessonId: string;
  category: string;
  title: string;
  summary: string;
  durationMinutes: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  prerequisites: string[];
  learningObjectives: string[];
  steps: Array<{
    id: string;
    title: string;
    description: string;
    route?: string;
  }>;
  relatedRoutes: string[];
  videoUrl?: string;
  quiz?: Array<{
    question: string;
    answers: string[];
    correctIndex: number;
  }>;
};

export type WalkthroughStep = {
  id: string;
  title: string;
  description: string;
  targetSelector?: string;
  route?: string;
};

export type WalkthroughDefinition = {
  id: string;
  route: string;
  version: string;
  title: string;
  steps: WalkthroughStep[];
};

export type HelpSearchResult = {
  id: string;
  kind: "page" | "lesson" | "faq" | "term" | "step";
  title: string;
  body: string;
  href: string;
  relatedLessonId?: string;
  route?: string;
  score: number;
};

export type OnboardingChecklistStep = {
  id: string;
  title: string;
  completed: boolean;
  description: string;
  estimatedMinutes: number;
  href: string;
};
