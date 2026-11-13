export type Platform = 'instagram' | 'youtube' | 'linkedin' | 'twitter' | 'other';

export interface Post {
  postId: string;
  url: string;
  platform: Platform;
  creator: string;
  shootDate: string;
  publishDate: string | null;
  roles: string[];
  sponsors: string[];
  thumbnail: string | null;
  views: number | null;
  likes: number | null;
}

export interface Video {
  videoId: string;
  posts: Post[];
  creator: string;
  roles: string[];
  sponsors: string[];
  thumbnail: string | null;
  publishDate: string | null;
  shootDate: string;
  views: number | null;
  likes: number | null;
}

export interface GalleryData {
  refreshedAt: string | null;
  postCount: number;
  metricCoverage: { views: number; likes: number };
  videos: Video[];
}

export interface CreatorProfile {
  sourceName: string;
  name: string;
  handle: string;
  displayHandle?: string;
  image?: string;
}
