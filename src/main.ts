// A stylesheet that will not load must not take the page down with it: Vite rejects
// the dynamic import when its CSS fails to preload, which would leave a blank #app.
addEventListener('vite:preloadError', event => {
  if (String((event as Event & { payload?: unknown }).payload).includes('CSS')) event.preventDefault();
});
const params = new URLSearchParams(location.search);
if (params.has('lab')) {
  await import('./stress.ts');
} else {
  await import('./game.ts');
}
