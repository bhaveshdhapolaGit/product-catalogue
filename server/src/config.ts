import { z } from 'zod';

/** Turns "3, 11 ,12" into ["3", "11", "12"]. */
const commaSeparatedList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== ''),
  );

/**
 * All settings come from environment variables. Each one has a default,
 * so the app runs without any setup.
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  /** How many proxies sit in front of the API (1 = nginx in Docker). Needed to see each visitor's real IP address. */
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // Product data
  FAKESTORE_BASE_URL: z.url().default('https://fakestoreapi.com'),
  FEATURED_PRODUCT_IDS: commaSeparatedList,

  // Enquiry email (the defaults point at the local Mailpit inbox)
  SALES_INBOX_EMAIL: z.email().default('sales@example.com'),
  EMAIL_FROM: z.string().min(1).default('Product Catalogue <no-reply@example.com>'),
  SMTP_HOST: z.string().min(1).default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
});

/** The checked settings (this TypeScript type is created from the rules above). */
export type Config = z.infer<typeof envSchema>;

/** Reads and checks the settings. If any are invalid, the app stops at startup with a clear message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${problems}`);
  }
  return result.data;
}
