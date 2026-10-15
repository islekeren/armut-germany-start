// Development-only mailbox. Bind to loopback and reject foreign Host/Origin.
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
import { createServer } from "node:http";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

if (!["development", "test"].includes(process.env.NODE_ENV)) {
  throw new Error("Email preview requires NODE_ENV=development or test");
}
const directory = resolve(process.env.EMAIL_LOCAL_DIR || ".local-mail");
const port = 8025;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
  const host = req.headers.host;
  if (req.method !== "GET" || ![`localhost:${port}`, `127.0.0.1:${port}`].includes(host) ||
      (req.headers.origin && ![`http://localhost:${port}`, `http://127.0.0.1:${port}`].includes(req.headers.origin))) {
    res.writeHead(403).end(); return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  try {
    const path = new URL(req.url, `http://${host}`).pathname;
    if (path === "/") {
      const files = (await readdir(directory).catch(() => [])).filter(name => /^[0-9a-f-]{36}\.json$/.test(name));
      const letters = await Promise.all(files.map(async name => ({ name, mail: JSON.parse(await readFile(resolve(directory, name), "utf8")) })));
      res.end(`<html lang="en"><title>Local email inbox</title><body><h1>Local email inbox</h1><p>Development only. Delete mail after testing.</p><ul>${letters.map(({ name, mail }) => `<li><a href="/${name}">${escape(mail.subject)} — ${escape(mail.to)}</a></li>`).join("")}</ul></body></html>`);
    } else if (/^\/[0-9a-f-]{36}\.json$/.test(path)) {
      const mail = JSON.parse(await readFile(resolve(directory, path.slice(1)), "utf8"));
      const url = mail.text.match(/https?:\/\/[^\s]+/)?.[0];
      res.end(`<html lang="en"><title>Local email</title><body><a href="/">Inbox</a><h1>${escape(mail.subject)}</h1><p>${escape(mail.to)}</p><pre style="white-space:pre-wrap">${escape(mail.text)}</pre>${url ? `<a rel="noreferrer" href="${escape(url)}">Open reset link</a>` : ""}</body></html>`);
    } else { res.writeHead(404).end(); }
  } catch { res.writeHead(404).end("Message unavailable"); }
});
server.listen(port, "127.0.0.1", () => console.log(`Local email inbox: http://127.0.0.1:${port}`));
