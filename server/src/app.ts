import express, { type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import type { CatalogueService } from './catalogue/CatalogueService';
import type { EnquiryService } from './enquiry/EnquiryService';
import { errorHandler, notFoundHandler } from './http/errors';
import { createApiRouter } from './http/routes';

export interface AppDependencies {
  catalogue: CatalogueService;
  enquiries: EnquiryService;
  /** How many proxies sit in front of the app (1 = nginx), so we see each visitor's real IP address. */
  trustProxy?: number;
  /** Max enquiries one visitor (IP address) can send per 15 minutes. Tests set it lower. */
  enquiryLimit?: number;
}

/** Builds the Express app. The services are passed in, so tests can pass in fake ones. */
export function createApp({
  catalogue,
  enquiries,
  trustProxy = 0,
  enquiryLimit = 10,
}: AppDependencies): Express {
  const app = express();
  app.set('trust proxy', trustProxy);

  app.use(helmet()); // adds standard security headers to every response
  app.use(express.json({ limit: '10kb' })); // reads JSON request bodies; rejects bodies over 10 KB

  // Limits how many enquiries one visitor can send, to protect against spam.
  const enquiryRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: enquiryLimit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many enquiries. Please try again later.' },
  });

  // Order matters: our routes first, then "not found", then the error handler last.
  app.use('/api', createApiRouter({ catalogue, enquiries, enquiryRateLimiter }));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
