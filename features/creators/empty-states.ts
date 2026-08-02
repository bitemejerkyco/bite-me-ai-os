export const CREATOR_EMPTY_STATES = {
  dashboard: {
    title: "No creator campaigns yet.",
    description: "Discover creators and build your first creator partnership.",
  },
  discover: {
    title: "No creators match your current filters.",
    description: "Clear filters or broaden your search.",
  },
  pipeline: {
    title: "Your creator pipeline is empty.",
    description: "Save a creator or add one from Discover.",
  },
  campaigns: {
    title: "No creator campaigns yet.",
    description: "Create a campaign and invite creators.",
  },
  contentReview: {
    title: "No creator content is waiting for review.",
    description: "Submitted creator assets will appear here.",
  },
  ugc: {
    title: "No approved creator assets yet.",
    description: "Approve creator content to build your UGC library.",
  },
  analytics: {
    title: "Creator analytics will appear after campaigns begin collecting results.",
    description: "Measured and demo-labeled metrics will populate as campaigns run.",
  },
} as const;
