import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIA_UI_STATE,
  parseMediaUiState,
} from "@/features/media/media-ui-state";

describe("media ui state", () => {
  it("returns defaults for missing or invalid state", () => {
    expect(parseMediaUiState(null)).toEqual(DEFAULT_MEDIA_UI_STATE);
    expect(parseMediaUiState("{bad-json")).toEqual(DEFAULT_MEDIA_UI_STATE);
  });

  it("normalizes supported persisted values", () => {
    const parsed = parseMediaUiState(
      JSON.stringify({
        folderFilter: "folder_1",
        query: "logo",
        typeFilter: "IMAGE",
        sourceFilter: "UPLOADED",
        sortBy: "NAME",
        favoriteOnly: true,
        showArchived: true,
        viewMode: "list",
      }),
    );

    expect(parsed.folderFilter).toBe("folder_1");
    expect(parsed.query).toBe("logo");
    expect(parsed.typeFilter).toBe("IMAGE");
    expect(parsed.sourceFilter).toBe("UPLOADED");
    expect(parsed.sortBy).toBe("NAME");
    expect(parsed.favoriteOnly).toBe(true);
    expect(parsed.showArchived).toBe(true);
    expect(parsed.viewMode).toBe("list");
  });
});
