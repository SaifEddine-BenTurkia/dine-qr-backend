#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook (PLAN section 20). Blocks any tool call whose
 * file path, search path or shell command mentions the local sandbox key
 * file or the server's env file. Exit code 2 blocks the call and shows the
 * message to Claude. Content being written is not inspected, only targets.
 */
let raw = '';
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let input = {};
  try {
    input = JSON.parse(raw).tool_input ?? {};
  } catch {
    process.exit(0);
  }
  const targets = [
    input.file_path,
    input.path,
    input.notebook_path,
    input.command,
    input.glob,
  ].filter((value) => typeof value === 'string');

  const blocked = [
    /\.env\.sandbox/,
    /\/opt\/tableqr\/\.env/,
    /tableqr\/\.env\.production/,
    /(^|[\s;&|])(printenv|env)(\s*$|\s*[;&|])/,
  ];
  for (const target of targets) {
    if (blocked.some((pattern) => pattern.test(target))) {
      console.error(
        'Blocked by TableQR secrets guard: sandbox and server env files are never read or edited directly. Use npm run env:check, env:init, smoke or deploy:env.',
      );
      process.exit(2);
    }
  }
  process.exit(0);
});
