export const logger = {
  info(message: string, context?: unknown) {
    console.info(`[bite-me-ai-os] ${message}`, context ?? "");
  },
  warn(message: string, context?: unknown) {
    console.warn(`[bite-me-ai-os] ${message}`, context ?? "");
  },
  error(message: string, context?: unknown) {
    console.error(`[bite-me-ai-os] ${message}`, context ?? "");
  },
};
