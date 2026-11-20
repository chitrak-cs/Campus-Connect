// Opt-in workaround for networks where AAAA (IPv6) DNS lookups stall ~15 s, which makes
// HTTPS calls (e.g. Cloudinary uploads) time out. Set FORCE_IPV4=true in .env to resolve IPv4 only.
// Off by default: hosts like Render don't need it.
if (process.env.FORCE_IPV4 === 'true') {
  require('https').globalAgent.options.family = 4;
  require('http').globalAgent.options.family = 4;
}
