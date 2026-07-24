import { z } from "zod";

const safeIdentifier = z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._:-]+$/);

export const amazonAdsSandboxQuerySchema = z.object({
  workspaceSlug: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/),
  connectorId: safeIdentifier,
  profileId: z.string().regex(/^\d{1,30}$/),
  marketplaceId: safeIdentifier,
  region: z.enum(["na", "eu", "fe"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  timezone: z.string().trim().min(1).max(100).regex(/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$|^UTC$/),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  nextToken: z.string().trim().min(1).max(4096).regex(/^[A-Za-z0-9._~+\/=-]+$/).optional(),
  maxResults: z.coerce.number().int().min(1).max(1000).default(100),
  attributionWindow: z.enum(["1d", "7d", "14d", "30d"]).default("14d"),
}).refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: "startDate must be on or before endDate.",
});

