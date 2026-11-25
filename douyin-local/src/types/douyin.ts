export type MediaType = 'video' | 'images';

export interface MediaItem {
  id: string;
  authorName: string;
  authorUrl: string;
  authorWorkCount: number;
  desc: string;
  tags: string[];
  mediaType: MediaType;
  files: string[];
  date: string;
  publishTimestamp: number;
  mixName: string | null;
  liked: boolean;
  collected: boolean;
  followed: boolean;
}

export interface LibraryStats {
  ready: boolean;
  mediaRoot: string;
  totalItems: number;
  videoCount: number;
  imageCount: number;
  authorCount: number;
  mixCount: number;
  indexedMs: number;
  error: string | null;
  likedCount: number;
  collectedCount: number;
  followedCount: number;
  historyCount: number;
  topTags: { tag: string; count: number }[];
  mixes: {
    name: string;
    authorName: string;
    count: number;
    coverFile: string;
    coverType: MediaType;
  }[];
}

export interface AuthorSummary {
  name: string;
  totalCount: number;
  videoCount: number;
  imageCount: number;
  latestDate: string;
  latestTimestamp: number;
  followed: boolean;
  coverFile: string;
  coverType: MediaType;
  sampleItemId: string;
}

export type NavTab =
  | 'recommend'
  | 'follow'
  | 'images'
  | 'authors'
  | 'mix'
  | 'mine'
  | 'tag'
  | 'search';

export type MineSubTab = 'liked' | 'collected' | 'history';

export interface FeedContext {
  tab: 'recommend' | 'follow' | 'images' | 'author' | 'tag' | 'mix' | 'liked' | 'collected' | 'history';
  label: string;
  author?: string;
  tag?: string;
  mix?: string;
  startId?: string;
}
