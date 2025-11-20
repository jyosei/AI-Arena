// 统一的媒体 URL 解析工具，可用于帖子与评论图片、用户头像等
export function resolveMediaUrl(raw) {
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const path = raw.startsWith('/') ? raw : `/${raw}`;

  const normaliseOrigin = (value) => {
    if (!value) return '';
    try {
      const url = new URL(String(value));
      // If origin matches current host but no port was provided, reuse the active port.
      if (!url.port && typeof window !== 'undefined' && window.location.hostname === url.hostname && window.location.port) {
        url.port = window.location.port;
      }
      url.hash = '';
      url.pathname = '';
      url.search = '';
      return url.toString().replace(/\/$/, '');
    } catch (_) {
      return '';
    }
  };

  const envOrigin = normaliseOrigin(import.meta?.env?.VITE_BACKEND_ORIGIN);
  if (envOrigin) {
    try {
      return new URL(path, `${envOrigin}/`).toString();
    } catch (_) {
      return `${envOrigin}${path}`;
    }
  }

  const windowOrigin = normaliseOrigin(typeof window !== 'undefined' ? window.__BACKEND_ORIGIN : '');
  if (windowOrigin) {
    try {
      return new URL(path, `${windowOrigin}/`).toString();
    } catch (_) {
      return `${windowOrigin}${path}`;
    }
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      return new URL(path, window.location.origin).toString();
    } catch (_) {
      // fall through to relative path
    }
  }

  return path;
}

export const FALLBACK_IMG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><rect width="200" height="120" fill="%23f0f0f0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="%23666">图片加载失败</text></svg>';

export function attachImageErrorFallback(e) {
  if (e?.target?.src !== FALLBACK_IMG) {
    e.target.src = FALLBACK_IMG;
  }
}

// 前端对外可见的公共 Origin，用于构造可分享的页面链接
// 优先级：VITE_PUBLIC_ORIGIN -> window.__PUBLIC_ORIGIN -> window.location.origin
export function getPublicOrigin() {
  try {
    const env = import.meta?.env?.VITE_PUBLIC_ORIGIN;
    if (env && typeof env === 'string') {
      return env.replace(/\/$/, '');
    }
  } catch (_) {}
  if (typeof window !== 'undefined' && window.__PUBLIC_ORIGIN) {
    try {
      const v = String(window.__PUBLIC_ORIGIN);
      return v.replace(/\/$/, '');
    } catch (_) {}
  }
  return window.location.origin;
}
