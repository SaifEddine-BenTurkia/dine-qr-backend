import { describe as describeError } from './http-exception.filter';

describe('describe', () => {
  it('keeps the stack of real errors', () => {
    expect(describeError(new Error('boom'))).toContain('boom');
  });

  it('never includes credentials from SDK error objects', () => {
    const cloudinaryError = {
      request_options: {
        hostname: 'api.cloudinary.com',
        auth: '993852842733263:super-secret-value',
      },
      error: { message: "Can't find folder", http_code: 404 },
    };
    const text = describeError(cloudinaryError);
    expect(text).toBe("Non-Error thrown (HTTP 404): Can't find folder");
    expect(text).not.toContain('super-secret-value');
  });

  it('handles primitives', () => {
    expect(describeError('oops')).toBe('Non-Error thrown: oops');
  });
});
