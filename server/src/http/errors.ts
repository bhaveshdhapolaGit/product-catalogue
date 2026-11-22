import type { ErrorRequestHandler, RequestHandler } from 'express';
import { z, ZodError } from 'zod';
import { EmailDeliveryError } from '../email/EmailSender';
import { UnknownProductError } from '../enquiry/EnquiryService';
import { ProductSourceError } from '../products/ProductSource';

/** An error that carries an HTTP status code, e.g. 404 Not found. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Runs when no route matched. Sends a 404 in the same JSON format as every other error. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'Not found'));
};

/**
 * Turns any error into a clear JSON response. For server-side problems we log the full
 * details for ourselves, but only show the user a general message, so internal details never leak.
 *
 * Express knows this is an error handler because it has 4 parameters (error, req, res, next).
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  // If we already started sending a response, we can't send another one; let Express close it.
  if (res.headersSent) {
    next(error);
    return;
  }

  // 400: the input failed validation (e.g. an invalid email address)
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', fields: z.flattenError(error).fieldErrors });
    return;
  }
  // Our own errors, e.g. 404 Not found
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  // 422: an enquiry about a product that doesn't exist
  if (error instanceof UnknownProductError) {
    res.status(422).json({ error: 'This product is no longer available' });
    return;
  }
  // 502: the product data provider failed
  if (error instanceof ProductSourceError) {
    console.error('Product source failure:', error);
    res.status(502).json({ error: 'The product catalogue is temporarily unavailable' });
    return;
  }
  // 502: the email provider failed
  if (error instanceof EmailDeliveryError) {
    console.error('Email delivery failure:', error);
    res.status(502).json({ error: 'We could not send your enquiry. Please try again shortly.' });
    return;
  }

  // Errors from Express's JSON reader: broken JSON (400) or a body that's too large (413)
  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({ error: (error as Error).message });
    return;
  }

  // Anything else is a bug: log it and send a general 500 error
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Something went wrong' });
};
