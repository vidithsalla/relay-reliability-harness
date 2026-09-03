export class EnterpriseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean
  ) {
    super(message);
  }
}

export class EnterpriseTimeoutError extends EnterpriseError {
  constructor(message = "Enterprise adapter timed out.") {
    super(message, "ENTERPRISE_TIMEOUT", true);
  }
}

export class EnterpriseTransientError extends EnterpriseError {
  constructor(message = "Enterprise adapter returned a transient error.") {
    super(message, "ENTERPRISE_TRANSIENT", true);
  }
}

export class EnterpriseVersionConflictError extends EnterpriseError {
  constructor(
    message = "Claim changed since the action was planned.",
    public readonly observedVersion?: number
  ) {
    super(message, "VERSION_CONFLICT", false);
  }
}

export class EnterpriseMalformedResponseError extends EnterpriseError {
  constructor(message = "Enterprise adapter returned a malformed response.") {
    super(message, "MALFORMED_RESPONSE", false);
  }
}

export class EnterpriseReadbackError extends EnterpriseError {
  constructor(message = "Authoritative read-back failed.") {
    super(message, "READBACK_FAILED", true);
  }
}

export function normalizeError(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
  observedVersion?: number;
} {
  if (error instanceof EnterpriseVersionConflictError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      observedVersion: error.observedVersion
    };
  }
  if (error instanceof EnterpriseError) {
    return { code: error.code, message: error.message, retryable: error.retryable };
  }
  if (error instanceof Error) {
    return { code: "UNKNOWN_ERROR", message: error.message, retryable: false };
  }
  return { code: "UNKNOWN_ERROR", message: "Unknown error.", retryable: false };
}
