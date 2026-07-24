import { describe, expect, it } from "vitest";
import { errorResponse, successResponse } from "@/lib/api-response";

describe("api response helpers", () => {
  it("creates a success response envelope", async () => {
    const response = successResponse({ id: "abc" }, { message: "created", status: 201 });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual({
      ok: true,
      data: { id: "abc" },
      message: "created",
    });
  });

  it("creates an error response envelope without stack traces", async () => {
    const response = errorResponse("INVALID_INPUT", "Validation failed", {
      status: 422,
      details: { field: "email" },
    });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.stack).toBeUndefined();
  });
});
