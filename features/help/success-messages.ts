export type SuccessMessage = {
  title: string;
  detail: string;
  nextActionLabel?: string;
  nextActionHref?: string;
};

export const SUCCESS_MESSAGES = {
  campaignCreated(): SuccessMessage {
    return {
      title: "Campaign created",
      detail: "Next step: Generate content for the campaign.",
      nextActionLabel: "Generate content",
      nextActionHref: "/studio",
    };
  },
  contentSaved(): SuccessMessage {
    return {
      title: "Content saved",
      detail: "Next step: Review the draft and move it into scheduling when ready.",
      nextActionLabel: "Open Calendar",
      nextActionHref: "/calendar",
    };
  },
  contentApproved(): SuccessMessage {
    return {
      title: "Draft approved",
      detail: "Next step: Schedule it for publishing.",
      nextActionLabel: "Open Calendar",
      nextActionHref: "/calendar",
    };
  },
  mediaUploaded(): SuccessMessage {
    return {
      title: "Logo uploaded",
      detail: "Next step: Use it in your first campaign.",
      nextActionLabel: "Create Campaign",
      nextActionHref: "/marketing/campaigns",
    };
  },
  billingUpdated(): SuccessMessage {
    return {
      title: "Integration connected",
      detail: "Next step: Test the connection and run your first sync.",
      nextActionLabel: "Test Connection",
      nextActionHref: "/integrations",
    };
  },
  businessProfileSaved(): SuccessMessage {
    return {
      title: "Business profile saved",
      detail: "Next step: Upload your logo and brand assets.",
      nextActionLabel: "Open Media Library",
      nextActionHref: "/media",
    };
  },
};
