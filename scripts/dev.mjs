#!/usr/bin/env node
/**
 * Start Next.js on the first available port from 3000 upward.
 * (Next.js itself does not auto-increment — it fails on EADDRINUSE.)
 */
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const START_PORT = Number(process.env.PORT_START) || 3000;
const MAX_TRIES = Number(process.env.PORT_TRIES) || 20;

/** Probe the same way Next binds: dual-stack on all interfaces. */
function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen({ port, ipv6Only: false });
  });
}

async function findPort(start, tries) {
  for (let i = 0; i < tries; i++) {
    const port = start + i;
    if (await portFree(port)) return port;
  }
  throw new Error(`No free port found in ${start}–${start + tries - 1}`);
}

const port = await findPort(START_PORT, MAX_TRIES);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const nextBin = path.join(root, "node_modules", ".bin", "next");

console.log(`→ Starting TypeFlow on http://localhost:${port}`);

const child = spawn(
  nextBin,
  ["dev", "-p", String(port)],
  { cwd: root, stdio: "inherit", env: { ...process.env, PORT: String(port) } }
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
