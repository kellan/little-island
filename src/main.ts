const params = new URLSearchParams(location.search);
if (params.has('lab')) {
  await import('./stress');
} else {
  await import('./game');
}
