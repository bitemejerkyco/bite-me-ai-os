export function inferHelpRouteFromQuestion(question: string) {
  const text = question.toLowerCase();
  if (text.includes("connect tiktok")) return "/settings/integrations/tiktok";
  if (text.includes("connect amazon")) return "/settings/integrations/amazon-ads";
  if (text.includes("approve") || text.includes("approval")) return "/approvals";
  if (text.includes("publish") || text.includes("publishing")) return "/publishing-queue";
  if (text.includes("credit") || text.includes("billing") || text.includes("plan")) return "/settings/billing";
  if (text.includes("logo") || text.includes("brand")) return "/settings/branding";
  if (text.includes("product")) return "/products";
  if (text.includes("schedule")) return "/calendar";
  if (text.includes("content")) return "/content";
  return null;
}
