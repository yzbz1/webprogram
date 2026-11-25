import { AuthorSummary, FeedContext, LibraryStats, MediaItem } from '../types/douyin';

export function mediaUrl(relPath: string): string {
  return `/api/media?path=${encodeURIComponent(relPath)}`;
}

export async function fetchStats(): Promise<LibraryStats> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchFeed(
  ctx: FeedContext,
  opts: { limit?: number; offset?: number; excludeIds?: string[] } = {}
): Promise<{ items: MediaItem[]; total: number; hasMore: boolean; startIndex?: number }> {
  const params = new URLSearchParams();
  params.set('tab', ctx.tab);
  params.set('limit', String(opts.limit ?? 15));
  if (opts.offset !== undefined) params.set('offset', String(opts.offset));
  if (ctx.author) params.set('author', ctx.author);
  if (ctx.tag) params.set('tag', ctx.tag);
  if (ctx.mix) params.set('mix', ctx.mix);
  if (ctx.startId) params.set('startId', ctx.startId);
  if (opts.excludeIds && opts.excludeIds.length > 0) {
    params.set('exclude', opts.excludeIds.slice(-250).join(','));
  }

  const res = await fetch(`/api/feed?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json();
}

export async function fetchAuthors(
  q = '',
  sort: 'count' | 'recent' | 'followed' = 'count'
): Promise<{ authors: AuthorSummary[]; total: number }> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('sort', sort);
  const res = await fetch(`/api/authors?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch authors');
  return res.json();
}

export async function searchWorks(
  q: string,
  offset = 0,
  limit = 48
): Promise<{ items: MediaItem[]; total: number; hasMore: boolean }> {
  const params = new URLSearchParams({
    q,
    offset: String(offset),
    limit: String(limit),
  });
  const res = await fetch(`/api/search?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to search works');
  return res.json();
}

export async function sendInteract(payload: {
  action: 'like' | 'collect' | 'follow' | 'view' | 'signal';
  itemId?: string;
  authorName?: string;
  forceLike?: boolean;
  kind?: 'finish' | 'skip';
}): Promise<Record<string, unknown>> {
  const res = await fetch('/api/interact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function revealInExplorer(relPath: string): Promise<void> {
  await fetch('/api/open-explorer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: relPath }),
  });
}
