const params = new URLSearchParams(location.search);
if (params.has('lab')) {
  await import('./stress.ts');
} else {
  await import('./game.ts');
}
