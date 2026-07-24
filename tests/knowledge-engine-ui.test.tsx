import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KnowledgeHubClient } from "@/features/knowledge-engine/components/knowledge-hub-client";

function jsonResponse(data: unknown, ok = true) {
  return {
    ok,
    json: async () => ({ ok, data, error: ok ? undefined : { message: "failed" } }),
  } as Response;
}

describe("KnowledgeHubClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("/api/knowledge-engine/collections?")) {
          return jsonResponse({ collections: [] });
        }
        if (input.includes("/api/knowledge-engine/documents?")) {
          return jsonResponse({ documents: [] });
        }
        return jsonResponse({}, false);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the empty state", async () => {
    render(<KnowledgeHubClient />);
    await waitFor(() => {
      expect(screen.getByText(/No documents yet/i)).toBeInTheDocument();
    });
  });

  it("shows a client-side validation error for blocked uploads", async () => {
    const { container } = render(<KnowledgeHubClient />);
    await waitFor(() => {
      expect(screen.getByText(/No documents yet/i)).toBeInTheDocument();
    });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([65])], "script.exe", { type: "application/octet-stream" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/Files with \.exe extension are blocked\./i)).toBeInTheDocument();
  });

  it("renders status badges and inspector details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.includes("/api/knowledge-engine/collections?")) {
          return jsonResponse({ collections: [{ id: "col_1", name: "Playbooks", slug: "playbooks" }] });
        }
        if (input.includes("/api/knowledge-engine/documents/doc_1?")) {
          return jsonResponse({
            document: {
              id: "doc_1",
              filename: "launch-playbook.md",
              originalFilename: "launch-playbook.md",
              title: "Launch Playbook",
              author: "Alex",
              company: "PostMotive",
              language: "en",
              mimeType: "text/markdown",
              status: "FAILED",
              sizeBytes: 1024,
              checksum: "abcdef1234567890abcdef1234567890",
              source: null,
              collection: { id: "col_1", name: "Playbooks" },
              uploadedAt: "2026-07-21T00:00:00.000Z",
              processedAt: null,
              failureReason: "Processor failed",
              metadata: {},
              chunkCount: 2,
              citationCount: 3,
              chunks: [{ id: "chunk_1", stableKey: "ck_1", chunkIndex: 0, text: "Snippet text", pageNumber: 1, heading: "Intro" }],
              jobs: [],
            },
          });
        }
        if (input.includes("/api/knowledge-engine/documents?")) {
          return jsonResponse({
            documents: [
              {
                id: "doc_1",
                filename: "launch-playbook.md",
                originalFilename: "launch-playbook.md",
                title: "Launch Playbook",
                mimeType: "text/markdown",
                status: "FAILED",
                sizeBytes: 1024,
                checksum: "abcdef1234567890abcdef1234567890",
                collectionId: "col_1",
                uploadedAt: "2026-07-21T00:00:00.000Z",
                processedAt: null,
                failureReason: "Processor failed",
              },
            ],
          });
        }
        return jsonResponse({}, false);
      })
    );

    render(<KnowledgeHubClient />);

    const rowLabel = await screen.findByText("launch-playbook.md");
    expect(await screen.findByText("FAILED")).toBeInTheDocument();

    fireEvent.click(rowLabel);

    expect(await screen.findByText("Launch Playbook")).toBeInTheDocument();
    expect(await screen.findByText("Processor failed")).toBeInTheDocument();
    expect(await screen.findByText("Chunk Preview")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeEnabled();
  });
});
