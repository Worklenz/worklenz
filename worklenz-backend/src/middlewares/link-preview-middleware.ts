import { NextFunction, Request, Response } from "express";
import { isValidUuid } from "../shared/validation-helpers";
import { escapeHtmlEntities, isProduction, log_error } from "../shared/utils";

/**
 * Crawler / chat-app bots that fetch Open Graph tags for link unfurls.
 * Regular browsers fall through to the SPA.
 *
 * Previews are intentionally content-free: task names, descriptions, statuses,
 * priorities, and comment text must not be disclosed to unauthenticated
 * crawlers (or anyone who can spoof a crawler UA / hold a UUID).
 */
const CRAWLER_UA_PATTERN =
  /bot|crawl|slurp|spider|facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Discordbot|Slackbot|Slack-ImgProxy|SkypeUriPreview|WhatsApp|TelegramBot|Embedly|Quora Link Preview|Showyoubot|outbrain|pinterest|redditbot|Applebot|Iframely|vkShare|W3C_Validator|preview/i;

interface LinkPreviewData {
  title: string;
  description: string;
  url: string;
  siteName: string;
}

const isCrawlerRequest = (req: Request): boolean => {
  const ua = req.get("user-agent") || "";
  if (!ua) return false;
  return CRAWLER_UA_PATTERN.test(ua);
};

/**
 * Dev-only: force OG HTML in a normal browser via ?og_preview=1.
 * Disabled in production so ordinary logged-out requests cannot bypass the UA gate.
 */
const wantsForcedPreview = (req: Request): boolean => {
  if (isProduction()) return false;
  if (process.env.ENABLE_OG_PREVIEW_FORCE !== "1") return false;
  const value = req.query.og_preview;
  return value === "1" || value === "true";
};

const getRequestOrigin = (req: Request): string => {
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host = (req.get("x-forwarded-host") || req.get("host") || "app.worklenz.com").split(",")[0].trim();
  return `${proto}://${host}`;
};

const getSiteName = (origin: string): string => {
  try {
    return new URL(origin).hostname.replace(/^www\./, "");
  } catch {
    return "worklenz.com";
  }
};

/** Text-only unfurl (no og:image) — like Google Meet / WhatsApp link cards */
const buildOgHtml = (preview: LinkPreviewData): string => {
  const title = escapeHtmlEntities(preview.title);
  const description = escapeHtmlEntities(preview.description);
  const url = escapeHtmlEntities(preview.url);
  const siteName = escapeHtmlEntities(preview.siteName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="noindex, nofollow" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Worklenz" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${url}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <link rel="canonical" href="${url}" />
  <style>
    body { font-family: Inter, system-ui, sans-serif; background:#0b141a; color:#e9edef; margin:0; padding:32px; }
    .card { max-width:420px; border-left:3px solid #00a884; background:#1f2c34; border-radius:0 8px 8px 0; padding:12px 14px; }
    .title { font-size:15px; font-weight:600; margin:0 0 4px; color:#e9edef; }
    .url { font-size:13px; color:#8696a0; margin:0 0 6px; word-break:break-all; }
    .desc { font-size:13px; color:#aebac1; margin:0 0 8px; line-height:1.4; white-space:pre-line; }
    .site { font-size:12px; color:#8696a0; margin:0; }
    a { color:#53bdeb; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <p class="title">${title}</p>
    <p class="url">${url}</p>
    <p class="desc">${description}</p>
    <p class="site">${siteName}</p>
  </div>
</body>
</html>`;
};

const buildGenericTaskPreview = (taskId: string, origin: string): LinkPreviewData => ({
  title: "Task in Worklenz",
  description: "Open this link in Worklenz to view the task.",
  url: `${origin}/worklenz/t/${taskId}`,
  siteName: getSiteName(origin),
});

const buildGenericCommentPreview = (commentId: string, origin: string): LinkPreviewData => ({
  title: "A comment in Worklenz",
  description: "Open this link in Worklenz to view the comment.",
  url: `${origin}/worklenz/c/${commentId}`,
  siteName: getSiteName(origin),
});

const parseTaskLinkFromRequest = (
  req: Request
): { taskId: string | null; commentId: string | null; commentOnlyId: string | null } => {
  const commentId =
    typeof req.query.comment === "string" && req.query.comment.trim()
      ? req.query.comment.trim()
      : null;

  // Comment short link: /worklenz/c/:commentId
  const commentShortMatch = req.path.match(/^\/worklenz\/c\/([^/]+)\/?$/i);
  if (commentShortMatch?.[1]) {
    return { taskId: null, commentId: null, commentOnlyId: commentShortMatch[1] };
  }

  // Short link: /worklenz/t/:taskId
  const shortMatch = req.path.match(/^\/worklenz\/t\/([^/]+)\/?$/i);
  if (shortMatch?.[1]) {
    return { taskId: shortMatch[1], commentId, commentOnlyId: null };
  }

  // Project deep link: /worklenz/projects/:projectId?task=&comment=
  const projectMatch = req.path.match(/^\/worklenz\/projects\/([^/]+)\/?$/i);
  if (projectMatch?.[1] && typeof req.query.task === "string" && req.query.task.trim()) {
    return { taskId: req.query.task.trim(), commentId, commentOnlyId: null };
  }

  return { taskId: null, commentId: null, commentOnlyId: null };
};

/**
 * Serves Open Graph HTML for crawlers that unfurl task/comment links in Slack,
 * Discord, Teams, etc. Non-crawler requests continue to the SPA.
 *
 * Does not load task/comment rows from the database — only the link type
 * (task vs comment) is reflected, which is already visible in the URL path.
 */
export const linkPreviewMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.method !== "GET") {
      next();
      return;
    }

    if (!isCrawlerRequest(req) && !wantsForcedPreview(req)) {
      next();
      return;
    }

    const { taskId, commentId, commentOnlyId } = parseTaskLinkFromRequest(req);
    if (!taskId && !commentOnlyId) {
      next();
      return;
    }

    const origin = getRequestOrigin(req);

    let preview: LinkPreviewData | null = null;

    if (commentOnlyId) {
      if (!isValidUuid(commentOnlyId)) {
        next();
        return;
      }
      preview = buildGenericCommentPreview(commentOnlyId, origin);
    } else if (taskId) {
      if (!isValidUuid(taskId)) {
        next();
        return;
      }
      // Comment query on a task URL still unfurls as a comment card when the id is valid
      if (commentId && isValidUuid(commentId)) {
        preview = buildGenericCommentPreview(commentId, origin);
      } else {
        preview = buildGenericTaskPreview(taskId, origin);
      }
    }

    if (!preview) {
      next();
      return;
    }

    res
      .status(200)
      .type("html")
      .set("Cache-Control", "no-store")
      .send(buildOgHtml(preview));
  } catch (error) {
    log_error(error);
    next();
  }
};

export default linkPreviewMiddleware;
