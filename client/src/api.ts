import type { ServerReceipt, Stats, VersionInfo } from './types';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function getReceipts(params?: {
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}): Promise<{ receipts: ServerReceipt[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.sort)  qs.set('sort',  params.sort);
  if (params?.order) qs.set('order', params.order);
  if (params?.q)     qs.set('q',     params.q);
  const query = qs.toString() ? `?${qs}` : '';
  return apiFetch(`/receipts${query}`);
}

export async function deleteReceipt(id: number): Promise<void> {
  await apiFetch(`/receipts/${id}`, { method: 'DELETE' });
}

export async function getStats(): Promise<Stats> {
  return apiFetch('/stats');
}

export async function getVersion(): Promise<VersionInfo> {
  return apiFetch('/version');
}

export async function updateVersion(data: VersionInfo): Promise<void> {
  await apiFetch('/version', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}
