import { ENV } from '../config/env';

export async function apiFetch(path, options = {}) {
  const url = `${ENV.API_BASE}${path}`;

  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const contentType = response.headers.get('content-type');

  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
