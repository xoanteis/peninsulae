// Early error capture for the verification harness. Lives in its own file
// (not inline in index.html) so the CSP can stay `script-src 'self'` plus a
// single hash for the importmap, which cannot be externalized.
window.__game = { errors: [] };
window.addEventListener('error', e => window.__game.errors.push(String(e.error?.stack || e.message)));
window.addEventListener('unhandledrejection', e => window.__game.errors.push('rejection: ' + String(e.reason?.stack || e.reason)));
