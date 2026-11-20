// Opt-in workaround for networks where AAAA (IPv6) DNS lookups stall ~15 s. On such a network HTTPS calls
// (Cloudinary) and Postgres connections (Neon) time out before the IPv4 fallback kicks in.
// Set FORCE_IPV4=true in .env to resolve IPv4 only. Off by default: hosts like Render don't need it.
if (process.env.FORCE_IPV4 === 'true') {
  const dns = require('dns');
  const originalLookup = dns.lookup;
  dns.lookup = function lookupIPv4(hostname, options, callback) {
    if (typeof options === 'function') { callback = options; options = {}; }
    if (typeof options === 'number') options = { family: options };
    return originalLookup.call(dns, hostname, { ...options, family: 4 }, callback);
  };
  require('https').globalAgent.options.family = 4;
  require('http').globalAgent.options.family = 4;
}
