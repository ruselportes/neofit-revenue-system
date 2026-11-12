import { DomainError, ValidationError } from '@neofit/core';
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import {
  CloudError,
  CloudNotConfiguredError,
  CloudUnavailableError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../errors';
import type { TokenClaims, TokenService } from '../services/security';

export interface AuthedRequest extends Request {
  user?: TokenClaims;
}

/** Every route behind this needs a valid JWT. */
export function requireAuth(tokens: TokenService): RequestHandler {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    const header = req.header('authorization') ?? '';
    const match = /^Bearer (.+)$/i.exec(header);
    if (!match) return next(new UnauthorizedError('Sign in required.'));
    try {
      req.user = tokens.verify(match[1]!);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Turns errors into JSON responses. Unexpected errors are logged and never shown to the client. */
export function errorHandler(log: (err: unknown) => void = console.error): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof UnauthorizedError) return void res.status(401).json({ error: err.message });
    if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message });
    if (err instanceof ConflictError) return void res.status(409).json({ error: err.message });
    if (err instanceof CloudNotConfiguredError || err instanceof CloudUnavailableError) {
      return void res.status(503).json({ error: err.message });
    }
    if (err instanceof CloudError) return void res.status(502).json({ error: err.message });
    if (err instanceof ValidationError) return void res.status(400).json({ error: err.message });
    if (err instanceof DomainError) return void res.status(400).json({ error: err.message });
    if ((err as { type?: string })?.type === 'entity.too.large') return void res.status(413).json({ error: 'Request is too large.' });
    if (err instanceof SyntaxError) return void res.status(400).json({ error: 'Invalid JSON.' });
    log(err);
    res.status(500).json({ error: 'Something went wrong.' });
  };
}
