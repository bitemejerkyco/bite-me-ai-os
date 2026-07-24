import { NextResponse } from "next/server";
import type { ApiError, ApiSuccess } from "@/types/api";

export function successResponse<T>(data: T, init?: { status?: number; message?: string }) {
  const payload: ApiSuccess<T> = {
    ok: true,
    data,
    message: init?.message,
  };

  return NextResponse.json(payload, { status: init?.status ?? 200 });
}

export function errorResponse(
  code: string,
  message: string,
  init?: {
    status?: number;
    details?: Record<string, unknown>;
  }
) {
  const payload: ApiError = {
    ok: false,
    error: {
      code,
      message,
      details: init?.details,
    },
  };

  return NextResponse.json(payload, { status: init?.status ?? 400 });
}

export function fromUnknownError(error: unknown, fallbackMessage = "Request failed") {
  if (error instanceof Error) {
    return errorResponse("INTERNAL_ERROR", fallbackMessage, {
      status: 500,
      details: process.env.NODE_ENV === "development" ? { name: error.name } : undefined,
    });
  }

  return errorResponse("INTERNAL_ERROR", fallbackMessage, { status: 500 });
}
