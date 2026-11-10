import { useEffect, useMemo, useState } from 'react';
import { faScissors } from '@fortawesome/free-solid-svg-icons/faScissors';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import gallery from './data/gallery.generated.json';
import siteConfig from './config';
import type {
  GalleryData, Platform, Post, Video,
} from './types';

const data = gallery as GalleryData;
const platformNames: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  other: 'Open post',
};

function compact(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function dateLabel(value: string | null) {
  if (!value) return 'Date pending';
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
}

function updatedLabel(value: string | null) {
  if (!value) return 'Updated —';
  return `Updated ${new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value))}`;
}

function platformName(platform: Platform) {
  return platformNames[platform];
}

function instagramEmbed(url: string) {
  const match = /instagram\.com\/(?:reel|reels|p)\/([^/?#]+)/.exec(url);
  return match ? `https://www.instagram.com/reel/${match[1]}/embed/` : null;
}

function youtubeEmbed(url: string) {
  const match = /(?:youtu\.be\/|shorts\/|[?&]v=)([^?&#/]+)/.exec(url);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function Icon({ role }: { role: string }) {
  const icon = role === 'editor' ? faScissors : faVideo;
  const [width, height, , , path] = icon.icon;
  return (
    <span className="role-icon" title={role} aria-label={role}>
      <svg viewBox={[0, 0, width, height].join(' ')} aria-hidden="true"><path d={typeof path === 'string' ? path : path.join(' ')} /></svg>
    </span>
  );
}

function thumbnailUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

function Thumbnail({ video }: { video: Video }) {
  const [missing, setMissing] = useState(false);
  const source = thumbnailUrl(video.thumbnail ?? `/thumbnails/${video.posts[0].postId}.jpg`);
  return (
    <div className="thumbnail">
      {!missing ? <img src={source} alt="" onError={() => {
        setMissing(true);
      }} /> : <div className="placeholder"><span>{video.creator.slice(0, 1)}</span></div>}
      <div className="badges">
        {video.roles.map((item) => <Icon key={item} role={item} />)}
      </div>
    </div>
  );
}

function Embed({ post }: { post: Post }) {
  let source = null;
  if (post.platform === 'instagram') source = instagramEmbed(post.url);
  if (post.platform === 'youtube') source = youtubeEmbed(post.url);
  if (!source) {
    return (
      <a className="embed-fallback" href={post.url} target="_blank" rel="noreferrer">
        View this post on
        {' '}
        {platformName(post.platform)}
        {' '}
        ↗
      </a>
    );
  }
  return (
    <div className="embed-shell">
      <iframe key={post.postId} className="embed" src={source} title={`${platformName(post.platform)} post`} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" allowFullScreen />
    </div>
  );
}

function Modal({ video, close }: { video: Video; close: () => void }) {
  const [activePost, setActivePost] = useState(video.posts[0]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={`${video.creator} video`} onMouseDown={(event) => {
        event.stopPropagation();
      }}>
        <button type="button" className="close" onClick={close} aria-label="Close post">×</button>
        <div className="modal-video"><Embed post={activePost} /></div>
        <div className="modal-info">
          <h2>{dateLabel(video.publishDate)}</h2>
          <div className="stats">
            <span>
              {compact(video.views)}
              {' '}
              views
            </span>
            <span>
              {compact(video.likes)}
              {' '}
              likes
            </span>
          </div>
          {video.posts.length > 1 && (
          <div className="tabs" role="tablist" aria-label="Post versions">
            {video.posts.map((post) => (
              <button type="button" key={post.postId} role="tab" aria-selected={activePost.postId === post.postId} className={activePost.postId === post.postId ? 'active' : ''} onClick={() => {
                setActivePost(post);
              }}>
                {platformName(post.platform)}
                {post.publishDate ? ` · ${dateLabel(post.publishDate)}` : ''}
              </button>
            ))}
          </div>
          )}
          <dl className="details">
            <div>
              <dt>Role</dt>
              <dd>{video.roles.join(', ')}</dd>
            </div>
            {video.sponsors.length > 0 && (
            <div>
              <dt>Brands</dt>
              <dd>{video.sponsors.join(', ')}</dd>
            </div>
            )}
            <div>
              <dt>Published</dt>
              <dd>{dateLabel(activePost.publishDate ?? activePost.shootDate)}</dd>
            </div>
          </dl>
          <a className="source-link" href={activePost.url} target="_blank" rel="noreferrer">
            Open on
            {' '}
            {platformName(activePost.platform)}
            {' '}
            ↗
          </a>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [creator, setCreator] = useState('all');
  const [role, setRole] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<Video | null>(null);
  const creators = useMemo(
    () => [...new Set(data.videos.map((video) => video.creator))].sort(),
    [],
  );
  const roles = useMemo(() => [...new Set(data.videos.flatMap((video) => video.roles))].sort(), []);
  const videos = useMemo(
    () => data.videos
      .filter((video) => (
        (creator === 'all' || video.creator === creator)
        && (role === 'all' || video.roles.includes(role))
      ))
      .sort((a, b) => (sort === 'views' ? (b.views ?? 0) - (a.views ?? 0) : (b.publishDate ?? '').localeCompare(a.publishDate ?? ''))),
    [creator, role, sort],
  );
  const totalViews = data.videos.reduce((total, video) => total + (video.views ?? 0), 0);
  const totalLikes = data.videos.reduce((total, video) => total + (video.likes ?? 0), 0);

  return (
    <main>
      <header className="hero">
        <div>
          <h1>{siteConfig.title}</h1>
        </div>
        <div className="summary">
          <div className="totals">
            <div>
              <strong>{compact(totalViews)}</strong>
              <span>views</span>
            </div>
            <div>
              <strong>{compact(totalLikes)}</strong>
              <span>likes</span>
            </div>
          </div>
          <p className="updated-at">{updatedLabel(data.refreshedAt)}</p>
        </div>
        {siteConfig.portfolioUrl && (
          <a className="portfolio-link" href={siteConfig.portfolioUrl}>
            Portfolio ↗
          </a>
        )}
      </header>
      <section className="toolbar" aria-label="Gallery filters">
        <label htmlFor="creator-filter">
          Creator
          <select
            id="creator-filter"
            value={creator}
            onChange={(event) => {
              setCreator(event.target.value);
            }}
          >
            <option value="all">All creators</option>
            {creators.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label htmlFor="role-filter">
          Role
          <select
            id="role-filter"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
            }}
          >
            <option value="all">All roles</option>
            {roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label htmlFor="sort-filter">
          Sort
          <select
            id="sort-filter"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
            }}
          >
            <option value="newest">Newest</option>
            <option value="views">Most views</option>
          </select>
        </label>
        <span className="result-count">
          {videos.length}
          {' '}
          videos
        </span>
      </section>
      <section className="coverage">
        {data.refreshedAt
          ? `Metrics refreshed ${new Date(data.refreshedAt).toLocaleDateString()} · `
          : 'Metrics not refreshed yet · '}
        {data.metricCoverage.views}
        /
        {data.postCount}
        {' '}
        posts with view data
      </section>
      {videos.length ? (
        <section className="grid" aria-label="Video gallery">
          {videos.map((video) => (
            <button
              type="button"
              className="card"
              key={video.videoId}
              onClick={() => {
                setSelected(video);
              }}
            >
              <Thumbnail video={video} />
              <div className="card-copy">
                <span>{video.creator}</span>
                <span>{dateLabel(video.publishDate)}</span>
              </div>
            </button>
          ))}
        </section>
      ) : (
        <p className="empty">No videos match those filters.</p>
      )}
      {selected && <Modal video={selected} close={() => {
        setSelected(null);
      }} />}
    </main>
  );
}
