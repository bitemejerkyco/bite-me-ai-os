export type SuccessMessage = {
  title: string;
  detail: string;
  nextActionLabel?: string;
  nextActionHref?: string;
};

export const SUCCESS_MESSAGES = {
  campaignCreated(): SuccessMessage {
    return {
      title: "Campaign created successfully.",
      detail: "Recommended next step: generate content from this plan.",
      nextActionLabel: "Generate content",
      nextActionHref: "/studio",
    };
  },
  contentSaved(): SuccessMessage {
    return {
      title: "Content saved successfully.",
      detail: "Recommended next step: review the draft and move it into scheduling when ready.",
      nextActionLabel: "Open calendar",
      nextActionHref: "/calendar",
    };
  },
  contentApproved(): SuccessMessage {
    return {
      title: "Draft approved successfully.",
      detail: "Recommended next step: schedule it in the publishing calendar.",
      nextActionLabel: "Schedule content",
      nextActionHref: "/calendar",
    };
  },
  mediaUploaded(): SuccessMessage {
    return {
      title: "Media uploaded successfully.",
      detail: "Recommended next step: use it in a new draft or video project.",
      nextActionLabel: "Open AI Studio",
      nextActionHref: "/studio",
    };
  },
  billingUpdated(): SuccessMessage {
    return {
      title: "Billing details updated.",
      detail: "Recommended next step: return to usage and credits to confirm your workspace is ready.",
      nextActionLabel: "Open billing",
      nextActionHref: "/settings/billing",
    };
  },
};
