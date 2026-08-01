import { describe, expect, it } from "vitest";
import { buildAdminGuideSections, buildDocumentationMetadata, buildUserGuideSections } from "@/features/help/documentation-metadata";

describe("help documentation metadata", () => {
  it("builds non-empty user and admin guide sections", () => {
    expect(buildUserGuideSections().length).toBeGreaterThan(0);
    expect(buildAdminGuideSections().length).toBeGreaterThan(0);
  });

  it("includes release note drafts only when coming soon notes exist", () => {
    const metadata = buildDocumentationMetadata();
    metadata.releaseNoteDrafts.forEach((draft) => {
      expect(draft.notes.length).toBeGreaterThan(0);
    });
  });
});
