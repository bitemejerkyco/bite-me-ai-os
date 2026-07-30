export type AgentRole =
  | "PROMPT_DIRECTOR"
  | "BRAND_STRATEGIST"
  | "CHANNEL_SPECIALIST"
  | "CREATIVE_DIRECTOR"
  | "COPYWRITER"
  | "COMPLIANCE_REVIEWER"
  | "PERFORMANCE_ANALYST";

export type AgentJob = {
  jobType: "CONTENT" | "VIDEO_PLAN";
  businessName: string;
  channel: string;
  objective: string;
  roles: AgentRole[];
  facts: string[];
  constraints: string[];
  learningSignals?: string[];
  requiredOutput: string[];
  task: string;
};

const PERSONAS: Record<AgentRole, string> = {
  PROMPT_DIRECTOR:
    "Translate the user's request into an exact production brief. Preserve facts and resolve ambiguity conservatively.",
  BRAND_STRATEGIST:
    "Protect the brand's positioning, audience fit, voice, continuity, and stated business goal.",
  CHANNEL_SPECIALIST:
    "Adapt the work to the selected channel's format, audience behavior, and publishing conventions.",
  CREATIVE_DIRECTOR:
    "Create an original, compelling concept with a strong opening hook and a coherent visual or narrative arc.",
  COPYWRITER:
    "Write concise, natural, action-oriented copy without inventing unsupported facts or claims.",
  COMPLIANCE_REVIEWER:
    "Apply industry, rights, safety, and platform constraints. Flag uncertainty and require human review when appropriate.",
  PERFORMANCE_ANALYST:
    "Use only supplied learning signals and proven knowledge. Prefer repeatable patterns without copying prior work verbatim.",
};

export function buildAgentPrompt(job: AgentJob): string {
  return [
    "POSTMOTIVE AGENT JOB BRIEF",
    `Job type: ${job.jobType}`,
    `Business: ${job.businessName}`,
    `Channel: ${job.channel}`,
    `Objective: ${job.objective}`,
    "",
    "Assigned agent personas:",
    ...job.roles.map((role) => `- ${role}: ${PERSONAS[role]}`),
    "",
    "Authoritative business facts:",
    ...job.facts.map((fact) => `- ${fact}`),
    "",
    "Mandatory constraints:",
    ...job.constraints.map((constraint) => `- ${constraint}`),
    ...(job.learningSignals?.length
      ? [
          "",
          "Workspace learning signals:",
          ...job.learningSignals.map((signal) => `- ${signal}`),
        ]
      : []),
    "",
    "Required output:",
    ...job.requiredOutput.map((item) => `- ${item}`),
    "",
    "Production task:",
    job.task,
    "",
    "The Prompt Director must silently verify that the response follows every fact, constraint, persona, and output requirement before returning it. Do not reveal private reasoning or chain-of-thought.",
  ].join("\n");
}

