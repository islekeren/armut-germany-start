/**
 * Input sanitization helpers for security
 */

// HTML escape special characters
export function escapeHtml(str: string): string {
  if (!str) return str;

  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return str.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

// Remove potential SQL injection patterns
export function sanitizeSql(str: string): string {
  if (!str) return str;

  // Remove common SQL injection patterns
  return str
    .replace(/['";\\]/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "");
}

// Sanitize for safe output (basic XSS prevention)
export function sanitizeOutput(str: string): string {
  if (!str) return str;

  return escapeHtml(str);
}

// Strip all HTML tags
export function stripHtml(str: string): string {
  if (!str) return str;

  return str.replace(/<[^>]*>/g, "");
}

// Sanitize filename
export function sanitizeFilename(filename: string): string {
  if (!filename) return filename;

  // Remove path separators and special characters
  return filename
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\.{2,}/g, ".")
    .substring(0, 255);
}

// Validate and sanitize URL
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

// Sanitize phone number (keep only digits and +)
export function sanitizePhone(phone: string): string {
  if (!phone) return phone;

  return phone.replace(/[^\d+]/g, "");
}

// Sanitize email (lowercase and trim)
export function sanitizeEmail(email: string): string {
  if (!email) return email;

  return email.toLowerCase().trim();
}

// Generic text sanitizer for user inputs
export function sanitizeText(
  text: string,
  options: {
    maxLength?: number;
    stripHtml?: boolean;
    escapeHtml?: boolean;
  } = {}
): string {
  if (!text) return text;

  let result = text.trim();

  if (options.stripHtml) {
    result = stripHtml(result);
  }

  if (options.escapeHtml) {
    result = escapeHtml(result);
  }

  if (options.maxLength && result.length > options.maxLength) {
    result = result.substring(0, options.maxLength);
  }

  return result;
}
