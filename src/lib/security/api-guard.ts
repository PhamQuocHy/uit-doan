import { NextResponse } from 'next/server';
import { InputError, readJson, securityEvent } from './controls';

/** Route boundary: bounded JSON parsing, consistent errors, no sensitive response caching. */
export function withApiGuard<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      const request = args[0];
      if (request instanceof Request && !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
          request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        const body = await readJson(request, 12 * 1024 * 1024);
        request.json = async () => body;
      }
      const response = await handler(...args);
      if (response.status >= 400) securityEvent('api_rejected', { status: response.status, requestId });
      response.headers.set('Cache-Control', 'no-store');
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (error) {
      const status = error instanceof InputError ? error.status : error instanceof SyntaxError ? 400 : 500;
      securityEvent(status === 500 ? 'api_error' : 'invalid_input', { status, requestId });
      return NextResponse.json({ error: status === 500 ? 'Lỗi hệ thống. Vui lòng thử lại sau.' : 'Dữ liệu yêu cầu không hợp lệ', requestId },
        { status, headers: { 'Cache-Control': 'no-store', 'X-Request-Id': requestId } });
    }
  };
}
