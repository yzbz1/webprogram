import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEDIA_ROOT = path.resolve(process.env.DOUYIN_MEDIA_ROOT || 'J:\\GitProject\\DouzyDownload');
const PORT = Number(process.env.PORT || 3002);
const STATE_FILE = path.join(__dirname, 'user-state.json');

/** @typedef {{
 *   id: string,
 *   authorName: string,
 *   authorUrl: string,
 *   desc: string,
 *   tags: string[],
 *   mediaType: 'video' | 'images',
 *   files: string[],
 *   date: string,
 *   publishTimestamp: number,
 *   mixName?: string,
 *   searchHaystack: string
 * }} MediaItem
 */

/** @type {MediaItem[]} */
let allItems = [];
/** @type {Map<string, MediaItem>} */
const itemById = new Map();
/** @type {Map<string, MediaItem[]>} */
const itemsByAuthor = new Map();
/** @type {Map<string, MediaItem[]>} */
const itemsByTag = new Map();
/** @type {Map<string, { name: string, authorName: string, items: MediaItem[] }>} */
const mixesMap = new Map();
/** @type {MediaItem[]} */
let videoItems = [];
/** @type {MediaItem[]} */
let imageItems = [];
/** @type {{ tag: string, count: number }[]} */
let topTags = [];

let indexStatus = {
  ready: false,
  mediaRoot: MEDIA_ROOT,
  totalItems: 0,
  videoCount: 0,
  imageCount: 0,
  authorCount: 0,
  mixCount: 0,
  indexedMs: 0,
  error: null,
};

// Persistent local user state (likes, collects, follows, history, recommendation profile)
let userState = {
  likedIds: [],
  collectedIds: [],
  followedAuthors: [],
  historyIds: [],
  authorWeights: {},
  tagWeights: {},
};

let likedSet = new Set();
let collectedSet = new Set();
let followedSet = new Set();
let saveTimer = null;

function loadUserState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      userState = {
        likedIds: Array.isArray(raw.likedIds) ? raw.likedIds : [],
        collectedIds: Array.isArray(raw.collectedIds) ? raw.collectedIds : [],
        followedAuthors: Array.isArray(raw.followedAuthors) ? raw.followedAuthors : [],
        historyIds: Array.isArray(raw.historyIds) ? raw.historyIds : [],
        authorWeights: raw.authorWeights && typeof raw.authorWeights === 'object' ? raw.authorWeights : {},
        tagWeights: raw.tagWeights && typeof raw.tagWeights === 'object' ? raw.tagWeights : {},
      };
      likedSet = new Set(userState.likedIds);
      collectedSet = new Set(userState.collectedIds);
      followedSet = new Set(userState.followedAuthors);
    }
  } catch (err) {
    console.warn('[State] Failed to load user-state.json:', err.message);
  }
}

function scheduleSaveUserState() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(userState, null, 2), 'utf8');
    } catch (err) {
      console.warn('[State] Save failed:', err.message);
    }
  }, 400);
}

function normalizeRelPath(p) {
  return String(p || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function extractTagsFromDesc(desc) {
  const matches = String(desc || '').match(/#([^\s#@,，。！？!?]+)/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1).trim()).filter(Boolean)));
}

function addItemToIndex(item) {
  if (itemById.has(item.id)) return;
  itemById.set(item.id, item);
  allItems.push(item);

  if (item.mediaType === 'video') videoItems.push(item);
  else imageItems.push(item);

  let authorList = itemsByAuthor.get(item.authorName);
  if (!authorList) {
    authorList = [];
    itemsByAuthor.set(item.authorName, authorList);
  }
  authorList.push(item);

  for (const tag of item.tags) {
    let tList = itemsByTag.get(tag);
    if (!tList) {
      tList = [];
      itemsByTag.set(tag, tList);
    }
    tList.push(item);
  }

  if (item.mixName) {
    const mixKey = `${item.authorName}::${item.mixName}`;
    let mix = mixesMap.get(mixKey);
    if (!mix) {
      mix = { name: item.mixName, authorName: item.authorName, items: [] };
      mixesMap.set(mixKey, mix);
    }
    mix.items.push(item);
  }
}

function parseFilenameMeta(fileName) {
  // Format: 2026-06-15_title..._76512415123456.mp4
  const noExt = fileName.replace(/\.[^.]+$/, '');
  const dateMatch = noExt.match(/^(\d{4}-\d{2}-\d{2})_(.+)$/);
  const date = dateMatch ? dateMatch[1] : '';
  const rest = dateMatch ? dateMatch[2] : noExt;
  const idMatch = rest.match(/^(.*)_(\d{15,22})(?:_(\d+))?$/);
  const desc = idMatch ? idMatch[1] : rest;
  const id = idMatch ? idMatch[2] : `${date}_${noExt}`;
  return { date, desc: desc === 'no_title' ? '' : desc, id };
}

async function scanMixDirectories() {
  if (!fs.existsSync(MEDIA_ROOT)) return;
  const authorEntries = await fs.promises.readdir(MEDIA_ROOT, { withFileTypes: true });
  for (const entry of authorEntries) {
    if (!entry.isDirectory()) continue;
    const authorName = entry.name;
    const mixRoot = path.join(MEDIA_ROOT, authorName, 'mix');
    if (!fs.existsSync(mixRoot)) continue;

    const mixDirs = await fs.promises.readdir(mixRoot, { withFileTypes: true });
    for (const mixDir of mixDirs) {
      if (!mixDir.isDirectory()) continue;
      const mixName = mixDir.name;
      const fullMixDir = path.join(mixRoot, mixName);
      const files = await fs.promises.readdir(fullMixDir, { withFileTypes: true });
      for (const f of files) {
        if (!f.isFile()) continue;
        if (!/\.(mp4|mov|webm)$/i.test(f.name)) continue;
        const relPath = normalizeRelPath(path.join(authorName, 'mix', mixName, f.name));
        const meta = parseFilenameMeta(f.name);
        const existing = itemById.get(meta.id);
        if (existing) {
          existing.mixName = mixName;
          const mixKey = `${authorName}::${mixName}`;
          let mix = mixesMap.get(mixKey);
          if (!mix) {
            mix = { name: mixName, authorName, items: [] };
            mixesMap.set(mixKey, mix);
          }
          if (!mix.items.some((i) => i.id === existing.id)) {
            mix.items.push(existing);
          }
          continue;
        }
        const tags = extractTagsFromDesc(meta.desc);
        addItemToIndex({
          id: meta.id,
          authorName,
          authorUrl: '',
          desc: meta.desc,
          tags,
          mediaType: 'video',
          files: [relPath],
          date: meta.date,
          publishTimestamp: meta.date ? Math.floor(new Date(meta.date).getTime() / 1000) : 0,
          mixName,
          searchHaystack: `${authorName} ${mixName} ${meta.desc} ${tags.join(' ')}`.toLowerCase(),
        });
      }
    }
  }
}

async function buildIndex() {
  const start = Date.now();
  try {
    if (!fs.existsSync(MEDIA_ROOT)) {
      throw new Error(`Media directory not found: ${MEDIA_ROOT}`);
    }

    const manifestPath = path.join(MEDIA_ROOT, 'download_manifest.jsonl');
    if (fs.existsSync(manifestPath)) {
      const rl = readline.createInterface({
        input: fs.createReadStream(manifestPath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (!line || line[0] !== '{') continue;
        try {
          const rec = JSON.parse(line);
          const rawFiles = Array.isArray(rec.file_paths) ? rec.file_paths : [];
          if (rawFiles.length === 0) continue;

          const normFiles = rawFiles.map(normalizeRelPath);
          const firstLower = normFiles[0].toLowerCase();
          const isVideo = firstLower.endsWith('.mp4') || firstLower.endsWith('.webm') || firstLower.endsWith('.mov');
          const isImage = firstLower.endsWith('.jpg') || firstLower.endsWith('.jpeg') || firstLower.endsWith('.webp') || firstLower.endsWith('.png');
          if (!isVideo && !isImage) continue;

          const mediaType = isVideo ? 'video' : 'images';
          const rawDesc = String(rec.desc || '').trim();
          const desc = rawDesc === 'no_title' ? '' : rawDesc;
          const tags = Array.isArray(rec.tags) && rec.tags.length > 0
            ? rec.tags.map((t) => String(t).trim()).filter(Boolean)
            : extractTagsFromDesc(desc);

          const id = String(rec.aweme_id || normFiles[0]);
          const authorName = String(rec.author_name || normFiles[0].split('/')[0] || '未知博主');
          const date = String(rec.date || '');
          const publishTimestamp = Number(rec.publish_timestamp || 0);

          // Check if path sits under mix/<mixName>/
          const segs = normFiles[0].split('/');
          const mixName = segs[1] === 'mix' && segs[2] ? segs[2] : undefined;

          addItemToIndex({
            id,
            authorName,
            authorUrl: String(rec.author_url || ''),
            desc,
            tags,
            mediaType,
            files: normFiles,
            date,
            publishTimestamp,
            mixName,
            searchHaystack: `${authorName} ${desc} ${tags.join(' ')} ${date}`.toLowerCase(),
          });
        } catch {
          // Skip malformed JSON line
        }
      }
    }

    // Also include mix directories in case some mix files were not recorded in manifest
    await scanMixDirectories();

    // Sort author lists & mixes newest-first
    for (const list of itemsByAuthor.values()) {
      list.sort((a, b) => b.publishTimestamp - a.publishTimestamp || b.date.localeCompare(a.date));
    }
    for (const mix of mixesMap.values()) {
      mix.items.sort((a, b) => b.publishTimestamp - a.publishTimestamp || b.date.localeCompare(a.date));
    }

    // Compute top hashtags
    topTags = Array.from(itemsByTag.entries())
      .map(([tag, list]) => ({ tag, count: list.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 60);

    indexStatus = {
      ready: true,
      mediaRoot: MEDIA_ROOT,
      totalItems: allItems.length,
      videoCount: videoItems.length,
      imageCount: imageItems.length,
      authorCount: itemsByAuthor.size,
      mixCount: mixesMap.size,
      indexedMs: Date.now() - start,
      error: null,
    };

    console.log(
      `[DouyinLocal] Indexed ${indexStatus.totalItems} works (${indexStatus.videoCount} videos, ${indexStatus.imageCount} image posts, ${indexStatus.authorCount} authors, ${indexStatus.mixCount} mixes) in ${indexStatus.indexedMs}ms`
    );
  } catch (err) {
    indexStatus.error = err.message;
    console.error('[DouyinLocal] Index failed:', err);
  }
}

function serializeItem(item) {
  return {
    id: item.id,
    authorName: item.authorName,
    authorUrl: item.authorUrl,
    authorWorkCount: itemsByAuthor.get(item.authorName)?.length || 1,
    desc: item.desc,
    tags: item.tags,
    mediaType: item.mediaType,
    files: item.files,
    date: item.date,
    publishTimestamp: item.publishTimestamp,
    mixName: item.mixName || null,
    liked: likedSet.has(item.id),
    collected: collectedSet.has(item.id),
    followed: followedSet.has(item.authorName),
  };
}

/**
 * Local Douyin "For You" Recommendation Engine:
 * - Samples a rich candidate pool from total 35k+ works (videos + occasional image posts)
 * - Scores by learned author & tag weights + exploration noise
 * - Enforces author diversity (no repeat author in adjacent 3 slots)
 * - Excludes already-seen IDs in current session
 */
function generateRecommendBatch(limit, excludeSet, mediaFilter = 'all') {
  const pool =
    mediaFilter === 'video' ? videoItems : mediaFilter === 'images' ? imageItems : allItems;
  if (pool.length === 0) return [];

  const candidateCount = Math.min(pool.length, Math.max(limit * 24, 320));
  const candidates = [];
  const pickedLocal = new Set();

  // 1. Recall from preferred authors / tags (up to 45% of candidate pool if user has profile)
  const weightedAuthors = Object.entries(userState.authorWeights)
    .filter(([, w]) => w > 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  if (weightedAuthors.length > 0) {
    const targetPref = Math.floor(candidateCount * 0.45);
    for (let i = 0; i < targetPref; i++) {
      const [author] = weightedAuthors[i % weightedAuthors.length];
      const list = itemsByAuthor.get(author);
      if (!list || list.length === 0) continue;
      const item = list[Math.floor(Math.random() * list.length)];
      if (mediaFilter === 'video' && item.mediaType !== 'video') continue;
      if (mediaFilter === 'images' && item.mediaType !== 'images') continue;
      if (excludeSet.has(item.id) || pickedLocal.has(item.id)) continue;
      pickedLocal.add(item.id);
      candidates.push(item);
    }
  }

  // 2. Random exploration recall from full library
  let attempts = 0;
  const maxAttempts = candidateCount * 4;
  while (candidates.length < candidateCount && attempts < maxAttempts) {
    attempts++;
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (excludeSet.has(item.id) || pickedLocal.has(item.id)) continue;
    pickedLocal.add(item.id);
    candidates.push(item);
  }

  // 3. Score candidates
  const scored = candidates.map((item) => {
    const aW = Number(userState.authorWeights[item.authorName] || 0);
    let tW = 0;
    for (const t of item.tags) {
      tW += Number(userState.tagWeights[t] || 0);
    }
    const followBonus = followedSet.has(item.authorName) ? 3.5 : 0;
    // Slight boost for videos over static images in main For You feed (like real Douyin ~88% video / 12% image)
    const videoBonus = item.mediaType === 'video' ? 1.8 : 0;
    const noise = Math.random() * 6.5;
    return { item, score: aW * 1.4 + tW * 0.8 + followBonus + videoBonus + noise };
  });

  scored.sort((a, b) => b.score - a.score);

  // 4. Diversity rerank: prevent same author appearing within last 3 slots
  const result = [];
  const recentAuthors = [];

  for (const entry of scored) {
    if (result.length >= limit) break;
    if (recentAuthors.includes(entry.item.authorName) && scored.length > limit * 2) {
      continue;
    }
    result.push(entry.item);
    recentAuthors.push(entry.item.authorName);
    if (recentAuthors.length > 3) recentAuthors.shift();
  }

  // Fill remainder if strict diversity left slots open
  if (result.length < limit) {
    const usedIds = new Set(result.map((r) => r.id));
    for (const entry of scored) {
      if (result.length >= limit) break;
      if (!usedIds.has(entry.item.id)) {
        result.push(entry.item);
        usedIds.add(entry.item.id);
      }
    }
  }

  return result;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

function resolveSafeMediaPath(relPath) {
  const cleaned = normalizeRelPath(relPath);
  const full = path.resolve(MEDIA_ROOT, cleaned);
  // Prevent path traversal outside MEDIA_ROOT
  const rootLower = MEDIA_ROOT.toLowerCase();
  const fullLower = full.toLowerCase();
  if (!fullLower.startsWith(rootLower + path.sep) && fullLower !== rootLower) {
    return null;
  }
  return full;
}

function serveMediaFile(req, res, relPath) {
  const fullPath = resolveSafeMediaPath(relPath);
  if (!fullPath) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Media file not found');
      return;
    }

    const total = stat.size;
    const contentType = getMimeType(fullPath);
    const range = req.headers.range;

    if (range) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      const start = match && match[1] ? parseInt(match[1], 10) : 0;
      const end =
        match && match[2]
          ? Math.min(parseInt(match[2], 10), total - 1)
          : Math.min(start + 8 * 1024 * 1024 - 1, total - 1);

      if (start >= total || start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${total}` });
        res.end();
        return;
      }

      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });

      const stream = fs.createReadStream(fullPath, { start, end });
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });
      const stream = fs.createReadStream(fullPath);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    }
  });
}

function applyWeightDelta(mapObj, key, delta) {
  if (!key) return;
  const cur = Number(mapObj[key] || 0);
  const next = Math.max(-10, Math.min(30, Number((cur + delta).toFixed(2))));
  mapObj[key] = next;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. Media streaming endpoint (HTTP 206 Range)
    if (pathname === '/api/media' && req.method === 'GET') {
      const rel = parsedUrl.searchParams.get('path') || '';
      serveMediaFile(req, res, rel);
      return;
    }

    // 2. Stats & top tags
    if (pathname === '/api/stats' && req.method === 'GET') {
      sendJson(res, 200, {
        ...indexStatus,
        likedCount: userState.likedIds.length,
        collectedCount: userState.collectedIds.length,
        followedCount: userState.followedAuthors.length,
        historyCount: userState.historyIds.length,
        topTags: topTags.slice(0, 28),
        mixes: Array.from(mixesMap.values()).map((m) => ({
          name: m.name,
          authorName: m.authorName,
          count: m.items.length,
          coverFile: m.items[0]?.files[0] || '',
          coverType: m.items[0]?.mediaType || 'video',
        })),
      });
      return;
    }

    // 3. Feed endpoint (supports recommend, follow, images, author, tag, mix, liked, collected, history)
    if (pathname === '/api/feed' && req.method === 'GET') {
      const tab = parsedUrl.searchParams.get('tab') || 'recommend';
      const limit = Math.min(40, Math.max(1, Number(parsedUrl.searchParams.get('limit') || 15)));
      const offset = Math.max(0, Number(parsedUrl.searchParams.get('offset') || 0));
      const author = parsedUrl.searchParams.get('author') || '';
      const tag = parsedUrl.searchParams.get('tag') || '';
      const mix = parsedUrl.searchParams.get('mix') || '';
      const startId = parsedUrl.searchParams.get('startId') || '';
      const excludeParam = parsedUrl.searchParams.get('exclude') || '';
      const excludeSet = new Set(excludeParam ? excludeParam.split(',').filter(Boolean) : []);

      let list = [];
      let total = 0;

      if (tab === 'recommend') {
        const batch = generateRecommendBatch(limit, excludeSet, 'all');
        if (startId && itemById.has(startId) && !batch.some((b) => b.id === startId)) {
          batch.unshift(itemById.get(startId));
        }
        sendJson(res, 200, {
          items: batch.map(serializeItem),
          total: allItems.length,
          hasMore: allItems.length > excludeSet.size + batch.length,
        });
        return;
      }

      if (tab === 'images') {
        const batch = generateRecommendBatch(limit, excludeSet, 'images');
        sendJson(res, 200, {
          items: batch.map(serializeItem),
          total: imageItems.length,
          hasMore: imageItems.length > excludeSet.size + batch.length,
        });
        return;
      }

      if (tab === 'follow') {
        const followed = [];
        for (const a of userState.followedAuthors) {
          const aItems = itemsByAuthor.get(a);
          if (aItems) followed.push(...aItems);
        }
        followed.sort((a, b) => b.publishTimestamp - a.publishTimestamp);
        list = followed;
      } else if (tab === 'author' && author) {
        list = itemsByAuthor.get(author) || [];
      } else if (tab === 'tag' && tag) {
        list = itemsByTag.get(tag) || [];
      } else if (tab === 'mix' && mix) {
        for (const m of mixesMap.values()) {
          if (m.name === mix) {
            list = m.items;
            break;
          }
        }
      } else if (tab === 'liked') {
        list = userState.likedIds.map((id) => itemById.get(id)).filter(Boolean);
      } else if (tab === 'collected') {
        list = userState.collectedIds.map((id) => itemById.get(id)).filter(Boolean);
      } else if (tab === 'history') {
        list = userState.historyIds.map((id) => itemById.get(id)).filter(Boolean);
      }

      total = list.length;

      // If startId is requested, slice starting from that exact item so clicking a grid item opens seamlessly at that video!
      let startIndex = offset;
      if (startId) {
        const idx = list.findIndex((i) => i.id === startId);
        if (idx >= 0) startIndex = idx;
      }

      const slice = list.slice(startIndex, startIndex + limit);
      sendJson(res, 200, {
        items: slice.map(serializeItem),
        total,
        startIndex,
        hasMore: startIndex + slice.length < total,
      });
      return;
    }

    // 4. Authors directory endpoint
    if (pathname === '/api/authors' && req.method === 'GET') {
      const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
      const sort = parsedUrl.searchParams.get('sort') || 'count';
      const limit = Math.min(300, Math.max(1, Number(parsedUrl.searchParams.get('limit') || 250)));

      let authors = Array.from(itemsByAuthor.entries()).map(([name, list]) => {
        const videoCnt = list.filter((i) => i.mediaType === 'video').length;
        const imageCnt = list.length - videoCnt;
        const sample = list[0];
        const sampleImg = list.find((i) => i.mediaType === 'images') || sample;
        return {
          name,
          totalCount: list.length,
          videoCount: videoCnt,
          imageCount: imageCnt,
          latestDate: sample?.date || '',
          latestTimestamp: sample?.publishTimestamp || 0,
          followed: followedSet.has(name),
          coverFile: sampleImg?.files[0] || '',
          coverType: sampleImg?.mediaType || 'video',
          sampleItemId: sample?.id || '',
        };
      });

      if (q) {
        authors = authors.filter((a) => a.name.toLowerCase().includes(q));
      }

      if (sort === 'recent') {
        authors.sort((a, b) => b.latestTimestamp - a.latestTimestamp);
      } else if (sort === 'followed') {
        authors.sort((a, b) => Number(b.followed) - Number(a.followed) || b.totalCount - a.totalCount);
      } else {
        authors.sort((a, b) => b.totalCount - a.totalCount);
      }

      sendJson(res, 200, {
        authors: authors.slice(0, limit),
        total: authors.length,
      });
      return;
    }

    // 5. Fast full-text search across 35,000+ works
    if (pathname === '/api/search' && req.method === 'GET') {
      const q = (parsedUrl.searchParams.get('q') || '').trim().toLowerCase();
      const limit = Math.min(80, Math.max(1, Number(parsedUrl.searchParams.get('limit') || 48)));
      const offset = Math.max(0, Number(parsedUrl.searchParams.get('offset') || 0));

      if (!q) {
        sendJson(res, 200, { items: [], total: 0 });
        return;
      }

      const terms = q.split(/\s+/).filter(Boolean);
      const matched = [];
      for (const item of allItems) {
        let ok = true;
        for (const term of terms) {
          if (!item.searchHaystack.includes(term)) {
            ok = false;
            break;
          }
        }
        if (ok) matched.push(item);
      }

      matched.sort((a, b) => b.publishTimestamp - a.publishTimestamp);
      sendJson(res, 200, {
        items: matched.slice(offset, offset + limit).map(serializeItem),
        total: matched.length,
        hasMore: offset + limit < matched.length,
      });
      return;
    }

    // 6. User interactions & real-time recommendation feedback
    if (pathname === '/api/interact' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { action, itemId, authorName } = body;
      const item = itemId ? itemById.get(itemId) : null;

      if (action === 'like' && item) {
        const forceLike = Boolean(body.forceLike);
        if (likedSet.has(item.id) && !forceLike) {
          likedSet.delete(item.id);
          userState.likedIds = userState.likedIds.filter((id) => id !== item.id);
          applyWeightDelta(userState.authorWeights, item.authorName, -2);
        } else if (!likedSet.has(item.id)) {
          likedSet.add(item.id);
          userState.likedIds.unshift(item.id);
          applyWeightDelta(userState.authorWeights, item.authorName, 5);
          item.tags.forEach((t) => applyWeightDelta(userState.tagWeights, t, 3));
        }
        scheduleSaveUserState();
        sendJson(res, 200, { liked: likedSet.has(item.id), likedCount: userState.likedIds.length });
        return;
      }

      if (action === 'collect' && item) {
        if (collectedSet.has(item.id)) {
          collectedSet.delete(item.id);
          userState.collectedIds = userState.collectedIds.filter((id) => id !== item.id);
        } else {
          collectedSet.add(item.id);
          userState.collectedIds.unshift(item.id);
          applyWeightDelta(userState.authorWeights, item.authorName, 6);
          item.tags.forEach((t) => applyWeightDelta(userState.tagWeights, t, 3.5));
        }
        scheduleSaveUserState();
        sendJson(res, 200, {
          collected: collectedSet.has(item.id),
          collectedCount: userState.collectedIds.length,
        });
        return;
      }

      if (action === 'follow' && authorName) {
        if (followedSet.has(authorName)) {
          followedSet.delete(authorName);
          userState.followedAuthors = userState.followedAuthors.filter((a) => a !== authorName);
          applyWeightDelta(userState.authorWeights, authorName, -4);
        } else {
          followedSet.add(authorName);
          userState.followedAuthors.unshift(authorName);
          applyWeightDelta(userState.authorWeights, authorName, 8);
        }
        scheduleSaveUserState();
        sendJson(res, 200, {
          followed: followedSet.has(authorName),
          followedCount: userState.followedAuthors.length,
        });
        return;
      }

      if (action === 'view' && item) {
        userState.historyIds = [item.id, ...userState.historyIds.filter((id) => id !== item.id)].slice(0, 500);
        scheduleSaveUserState();
        sendJson(res, 200, { ok: true });
        return;
      }

      if (action === 'signal' && item) {
        // Real Douyin implicit feedback: finish (+2) vs quick skip (-1.5)
        const kind = body.kind;
        const delta = kind === 'finish' ? 2.2 : kind === 'skip' ? -1.4 : 0;
        if (delta !== 0) {
          applyWeightDelta(userState.authorWeights, item.authorName, delta);
          item.tags.forEach((t) => applyWeightDelta(userState.tagWeights, t, delta * 0.6));
          scheduleSaveUserState();
        }
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 400, { error: 'Unknown action or missing target' });
      return;
    }

    // 7. Reveal file in Windows Explorer
    if (pathname === '/api/open-explorer' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const fullPath = resolveSafeMediaPath(body.path || '');
      if (!fullPath || !fs.existsSync(fullPath)) {
        sendJson(res, 404, { error: 'File not found' });
        return;
      }
      execFile('explorer.exe', [`/select,${fullPath}`], () => {});
      sendJson(res, 200, { ok: true });
      return;
    }

    // 8. Serve built frontend static files (single-process production mode on http://127.0.0.1:3002)
    if (req.method === 'GET' && !pathname.startsWith('/api/')) {
      const distDir = path.resolve(__dirname, '../dist');
      if (fs.existsSync(distDir)) {
        const cleanPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
        let target = path.resolve(distDir, cleanPath);
        if (!target.startsWith(distDir) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
          target = path.join(distDir, 'index.html');
        }
        const ext = path.extname(target).toLowerCase();
        const staticMime = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.ico': 'image/x-icon',
          '.json': 'application/json; charset=utf-8',
        }[ext] || 'application/octet-stream';
        const data = fs.readFileSync(target);
        res.writeHead(200, {
          'Content-Type': staticMime,
          'Content-Length': data.length,
        });
        res.end(data);
        return;
      }
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('[Server Error]', err);
    sendJson(res, 500, { error: err.message });
  }
});

loadUserState();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[DouyinLocal] API & Media Server running at http://127.0.0.1:${PORT}`);
  console.log(`[DouyinLocal] Indexing media from ${MEDIA_ROOT}...`);
  buildIndex();
});
