// CloudFront Function for SPA routing
// Rewrites requests for SPA routes to /index.html
// This allows API 404s to pass through while still supporting client-side routing

function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // Don't rewrite if path starts with known backend/asset prefixes
  var backendPrefixes = ['/api/', '/ws/', '/media/', '/admin/', '/static/', '/assets/'];
  for (var i = 0; i < backendPrefixes.length; i++) {
    if (uri.startsWith(backendPrefixes[i])) {
      return request;
    }
  }

  // Don't rewrite if it looks like a file (has extension)
  // Common static file extensions
  var hasExtension = uri.match(/\.[a-zA-Z0-9]{2,5}$/);
  if (hasExtension) {
    return request;
  }

  // Don't rewrite root path
  if (uri === '/') {
    return request;
  }

  // For all other paths (SPA routes), rewrite to index.html
  request.uri = '/index.html';
  return request;
}
