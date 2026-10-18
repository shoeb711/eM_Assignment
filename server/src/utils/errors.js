// One error type for every "expected" failure. The error handler turns it into a
// predictable JSON response:  { error: { code, message, details, requestId } }
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Please sign in.') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have permission to do this.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Record') => new AppError(404, 'NOT_FOUND', `${what} not found.`);
export const conflict = (message) => new AppError(409, 'CONFLICT', message);

// Used when an UPDATE ... WHERE version = $n matched nothing: someone else saved first.
export const staleVersion = () =>
  conflict('This record was changed by someone else since you opened it. Please reload and try again.');
