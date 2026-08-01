import { describe, expect, it } from "vitest";
import { SUCCESS_MESSAGES } from "@/features/help/success-messages";

describe("help success messages", () => {
  it("guides next steps for campaign creation", () => {
    const message = SUCCESS_MESSAGES.campaignCreated();
    expect(message.title).toBe("Campaign created");
    expect(message.nextActionLabel).toBe("Generate content");
    expect(message.nextActionHref).toBe("/studio");
  });

  it("guides approval outcomes into scheduling", () => {
    const message = SUCCESS_MESSAGES.contentApproved();
    expect(message.title).toBe("Draft approved");
    expect(message.nextActionLabel).toBe("Open Calendar");
    expect(message.nextActionHref).toBe("/calendar");
  });

  it("provides setup-oriented next steps for profile and media completion", () => {
    const profile = SUCCESS_MESSAGES.businessProfileSaved();
    expect(profile.title).toBe("Business profile saved");
    expect(profile.nextActionLabel).toBe("Open Media Library");
    expect(profile.nextActionHref).toBe("/media");

    const media = SUCCESS_MESSAGES.mediaUploaded();
    expect(media.title).toBe("Logo uploaded");
    expect(media.nextActionLabel).toBe("Create Campaign");
    expect(media.nextActionHref).toBe("/marketing/campaigns");
  });
});
