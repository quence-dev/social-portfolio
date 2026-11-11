import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { faScissors } from '@fortawesome/free-solid-svg-icons/faScissors';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import creatorProfiles from './data/creator-profiles.json';
import gallery from './data/gallery.generated.json';
import siteConfig from './config';
import type {
  CreatorProfile, GalleryData, Platform, Post, Video,
} from './types';

const data = gallery as GalleryData;
const profiles = creatorProfiles as CreatorProfile[];
const profileBySourceName = new Map(profiles.map((profile) => [profile.sourceName, profile]));
type Route = { page: 'gallery' | 'creators' | 'about' } | { page: 'creator'; creator: string };
const platformNames: Record<Platform, string> = {
  instagram: 'Instagram',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  other: 'Open post',
};
const focusableSelector = 'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

function compact(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function pluralize(value: number, singular: string) {
  return value === 1 ? singular : `${singular}s`;
}

function dateLabel(value: string | null) {
  if (!value) return 'Date pending';
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
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

function creatorProfile(creator: string) {
  return profileBySourceName.get(creator);
}

function creatorName(creator: string) {
  return creatorProfile(creator)?.name ?? creator;
}

function creatorHandleText(creator: string) {
  const profile = creatorProfile(creator);
  return profile?.displayHandle ?? profile?.handle ?? creator;
}

function creatorHandle(creator: string) {
  return creatorProfile(creator) ? `@${creatorHandleText(creator)}` : creator;
}

function creatorPath(creator: string) {
  return `#/creators/${encodeURIComponent(creator)}`;
}

function currentRoute(): Route {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'about') return { page: 'about' };
  if (parts[0] !== 'creators') return { page: 'gallery' };
  if (!parts[1]) return { page: 'creators' };
  try {
    const creator = decodeURIComponent(parts.slice(1).join('/'));
    return data.videos.some((video) => video.creator === creator) ? { page: 'creator', creator } : { page: 'creators' };
  } catch {
    return { page: 'creators' };
  }
}

function ViewNav({ page }: { page: 'gallery' | 'creators' | 'about' }) {
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  useLayoutEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current;
      const active = nav?.querySelector<HTMLAnchorElement>('[aria-current="page"]');
      if (!nav || !active) return;
      const navRect = nav.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      setIndicator({ left: activeRect.left - navRect.left, width: activeRect.width });
    };
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => {
      window.removeEventListener('resize', updateIndicator);
    };
  }, [page]);

  return (
    <nav ref={navRef} className="view-nav" aria-label="Portfolio sections">
      <span className="view-nav-indicator" aria-hidden="true" style={{ transform: `translateX(${String(indicator.left)}px)`, width: indicator.width }} />
      <a href="#/" className={page === 'gallery' ? 'active' : ''} aria-current={page === 'gallery' ? 'page' : undefined}>Gallery</a>
      <a href="#/creators" className={page === 'creators' ? 'active' : ''} aria-current={page === 'creators' ? 'page' : undefined}>Creators</a>
      <a href="#/about" className={page === 'about' ? 'active' : ''} aria-current={page === 'about' ? 'page' : undefined}>About</a>
    </nav>
  );
}

function Thumbnail({ video, showRoles = true }: { video: Video; showRoles?: boolean }) {
  const [missing, setMissing] = useState(false);
  const source = thumbnailUrl(video.thumbnail ?? `/thumbnails/${video.posts[0].postId}.jpg`);
  return (
    <div className="thumbnail">
      {!missing ? <img src={source} alt="" loading="lazy" decoding="async" onError={() => {
        setMissing(true);
      }} /> : <div className="placeholder"><span>{video.creator.slice(0, 1)}</span></div>}
      {showRoles && (
        <div className="badges">
          {video.roles.map((item) => <Icon key={item} role={item} />)}
        </div>
      )}
    </div>
  );
}

function CreatorThumbnail({ video }: { video: Video }) {
  const [missing, setMissing] = useState(false);
  const image = creatorProfile(video.creator)?.image;
  if (!image || missing) return <Thumbnail video={video} showRoles={false} />;
  return <img className="creator-profile-image" src={thumbnailUrl(image)} alt="" loading="lazy" decoding="async" onError={() => {
    setMissing(true);
  }} />;
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
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [
        ...(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [close]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={`${creatorName(video.creator)} video`} onMouseDown={(event) => {
        event.stopPropagation();
      }}>
        <button ref={closeButtonRef} type="button" className="close" onClick={close} aria-label="Close post">×</button>
        <div className="modal-video"><Embed post={activePost} /></div>
        <div className="modal-info">
          <h2>{creatorName(video.creator)}</h2>
          <p className="modal-date">Posted {dateLabel(activePost.publishDate ?? activePost.shootDate)}</p>
          {(video.views !== null || video.likes !== null) && (
            <div className="stats">
              {video.views !== null && (
                <span>
                  {compact(video.views)}
                  {' '}
                  {pluralize(video.views, 'view')}
                </span>
              )}
              {video.likes !== null && (
                <span>
                  {compact(video.likes)}
                  {' '}
                  {pluralize(video.likes, 'like')}
                </span>
              )}
            </div>
          )}
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
  const [route, setRoute] = useState<Route>(currentRoute);
  const [creator, setCreator] = useState('all');
  const [role, setRole] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<Video | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeModal = useCallback(() => {
    setSelected(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);
  const creators = useMemo(
    () => [...new Set(data.videos.map((video) => video.creator))].sort(),
    [],
  );
  const roles = useMemo(() => [...new Set(data.videos.flatMap((video) => video.roles))].sort(), []);
  const creatorSummaries = useMemo(() => creators.map((item) => {
    const videos = data.videos.filter((video) => video.creator === item);
    return {
      creator: item,
      videos,
      roles: [...new Set(videos.flatMap((video) => video.roles))],
      views: videos.reduce((total, video) => total + (video.views ?? 0), 0),
      likes: videos.reduce((total, video) => total + (video.likes ?? 0), 0),
    };
  }), [creators]);
  useEffect(() => {
    const updateRoute = () => {
      setRoute(currentRoute());
    };
    updateRoute();
    window.addEventListener('hashchange', updateRoute);
    return () => {
      window.removeEventListener('hashchange', updateRoute);
    };
  }, []);
  const videos = useMemo(
    () => data.videos
      .filter((video) => (
        ((route.page === 'creator' ? video.creator === route.creator : creator === 'all' || video.creator === creator))
        && (role === 'all' || video.roles.includes(role))
      ))
      .sort((a, b) => (sort === 'views' ? (b.views ?? 0) - (a.views ?? 0) : (b.publishDate ?? '').localeCompare(a.publishDate ?? ''))),
    [creator, role, route, sort],
  );
  const totalViews = data.videos.reduce((total, video) => total + (video.views ?? 0), 0);
  const totalLikes = data.videos.reduce((total, video) => total + (video.likes ?? 0), 0);

  return (
    <main>
      {route.page === 'creator' ? (
      <header className="creator-hero">
        <a className="back-link" href="#/creators">← All creators</a>
        <div>
          <h1>{creatorName(route.creator)}</h1>
          <p className="creator-handle">{creatorHandle(route.creator)}</p>
        </div>
        <div className="totals">
          <div>
            <strong>{videos.length}</strong>
            <span>{pluralize(videos.length, 'video')}</span>
          </div>
          <div>
            <strong>{compact(
              videos.reduce((total, video) => total + (video.views ?? 0), 0),
            )}</strong>
            <span>{pluralize(videos.reduce((total, video) => total + (video.views ?? 0), 0), 'view')}</span>
          </div>
          <div>
            <strong>{compact(
              videos.reduce((total, video) => total + (video.likes ?? 0), 0),
            )}</strong>
            <span>{pluralize(videos.reduce((total, video) => total + (video.likes ?? 0), 0), 'like')}</span>
          </div>
        </div>
      </header>
      ) : (
      <header className="hero">
        <div>
          <h1>{siteConfig.title}</h1>
        </div>
        <div className="summary">
          <div className="totals">
            <div>
              <strong>{compact(totalViews)}</strong>
              <span>{pluralize(totalViews, 'view')}</span>
            </div>
            <div>
              <strong>{compact(totalLikes)}</strong>
              <span>{pluralize(totalLikes, 'like')}</span>
            </div>
            <div>
              <strong>{data.videos.length}</strong>
              <span>{pluralize(data.videos.length, 'video')}</span>
            </div>
          </div>
          <p className="updated-at">Updated {siteConfig.metricsUpdatedLabel}</p>
        </div>
        {siteConfig.portfolioUrl && (
          <a className="portfolio-link" href={siteConfig.portfolioUrl}>
            Portfolio ↗
          </a>
        )}
      </header>
      )}
      {route.page !== 'creator' && (
        <ViewNav page={route.page} />
      )}
      {route.page === 'about' ? (
        <section className="about" aria-label="About Spencer Vilicic">
          <p>
            I&apos;m Spencer Vilicic, though many people know me as Quence. I&apos;m based in NYC
            {' '}
            and currently work as a writer/director, cinematographer, and editor. My background
            {' '}
            spans
            {' '}
            software engineering and film, and much of the work featured here sits between them:
            {' '}
            skits and short-form videos that use humor to examine the tech industry
            {' '}
            I previously worked in.
          </p>
          <p>
            If you&apos;d like to work together, or just see more of my art, you can find me on
            {' '}
            Instagram at
            {' '}
            <a href="https://www.instagram.com/_quence_art/" target="_blank" rel="noreferrer">@_quence_art</a>.
          </p>
        </section>
      ) : route.page === 'creators' ? (
        <section className="creator-grid" aria-label="Creator directory">
          {creatorSummaries.map((item) => (
            <a className="creator-card" href={creatorPath(item.creator)} key={item.creator}>
              <div className="creator-card-thumbnail">
                <CreatorThumbnail video={item.videos[0]} />
                <h2 className={`creator-card-name${creatorHandleText(item.creator).length > 14 ? ' long' : ''}`}>{creatorHandleText(item.creator)}</h2>
              </div>
              <div className="creator-card-info">
                <p>{item.videos.length} {pluralize(item.videos.length, 'video')} · {compact(item.views)} {pluralize(item.views, 'view')}</p>
                <span>{item.roles.join(', ')}</span>
              </div>
            </a>
          ))}
        </section>
      ) : (
      <>
      <section className="toolbar" aria-label="Gallery filters">
        {route.page !== 'creator' && (
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
              <option key={item} value={item}>{creatorHandle(item)}</option>
            ))}
          </select>
        </label>
        )}
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
          {pluralize(videos.length, 'video')}
        </span>
      </section>
      {videos.length ? (
        <section className="grid" aria-label="Video gallery">
          {videos.map((video) => (
            <button
              type="button"
              className="card"
              key={video.videoId}
              aria-label={`Open video by ${creatorName(video.creator)}, posted ${dateLabel(video.publishDate)}`}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setSelected(video);
              }}
            >
              <Thumbnail video={video} />
            </button>
          ))}
        </section>
      ) : (
        <p className="empty">No videos match those filters.</p>
      )}
      </>
      )}
      {selected && <Modal video={selected} close={closeModal} />}
      <footer className="site-footer">© 2026 by Spencer Vilicic</footer>
    </main>
  );
}
