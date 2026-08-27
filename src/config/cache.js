const NodeCache = require('node-cache');
const env = require('./env');

const cache = new NodeCache({
  stdTTL: env.cacheTtlSeconds,
  checkperiod: Math.max(30, Math.floor(env.cacheTtlSeconds / 2)),
  useClones: false,
});

function get(key) {
  return cache.get(key);
}

function set(key, value, ttl) {
  return cache.set(key, value, ttl ?? env.cacheTtlSeconds);
}

function del(key) {
  return cache.del(key);
}

function delByPrefix(prefix) {
  cache.keys().forEach((key) => {
    if (key.startsWith(prefix)) {
      cache.del(key);
    }
  });
}

async function getOrSet(key, fetcher, ttl) {
  const hit = cache.get(key);
  if (hit !== undefined) {
    return hit;
  }
  const value = await fetcher();
  cache.set(key, value, ttl ?? env.cacheTtlSeconds);
  return value;
}

module.exports = {
  cache,
  get,
  set,
  del,
  delByPrefix,
  getOrSet,
};
