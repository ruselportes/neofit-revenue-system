import { DomainError } from '@neofit/core';

export class NotFoundError extends DomainError {}
export class UnauthorizedError extends DomainError {}
export class ConflictError extends DomainError {}

/** The cloud connection has not been set up on this computer (HTTP 503). */
export class CloudNotConfiguredError extends DomainError {
  constructor() {
    super('The cloud connection is not set up on this computer.');
  }
}

/** The cloud could not be reached, for example because the computer is offline (HTTP 503). */
export class CloudUnavailableError extends DomainError {
  constructor(detail?: string) {
    super(`Cannot reach the cloud. Check the internet connection and try again.${detail ? ` (${detail})` : ''}`);
  }
}

/** The cloud answered with an error (HTTP 502). */
export class CloudError extends DomainError {}
