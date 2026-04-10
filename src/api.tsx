const BASE = import.meta.env.VITE_API_URL;

export const api = {
  get:  (path: string) => fetch(`${BASE}${path}`).then(r => r.json()),
  post: (path: string, body: any) => fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()),
};