import { validateGoogleToken } from '../utils/google-auth.js';

// Simple in-memory cache to track invalidated keys with timestamps
const invalidatedCache = new Map();
const INVALIDATION_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { cacheKeys } = req.body;
    
    if (!cacheKeys || !Array.isArray(cacheKeys)) {
      return res.status(400).json({ 
        error: 'Invalid request - cacheKeys array required' 
      });
    }

    console.log(`🗑️ Cache invalidation request from ${user.email}:`, cacheKeys);

    // Mark cache keys as invalidated with current timestamp
    const timestamp = Date.now();
    const userCachePrefix = `user_${user.sub || user.email}`;
    
    cacheKeys.forEach(key => {
      const fullKey = `${userCachePrefix}_${key}`;
      invalidatedCache.set(fullKey, timestamp);
      console.log(`📝 Marked ${fullKey} as invalidated at ${new Date(timestamp).toISOString()}`);
    });

    // Clean up old invalidation records
    cleanupInvalidationCache();
    
    return res.status(200).json({
      success: true,
      message: `Invalidated ${cacheKeys.length} cache key(s)`,
      data: {
        invalidatedKeys: cacheKeys,
        timestamp: new Date(timestamp).toISOString(),
        userPrefix: userCachePrefix
      }
    });

  } catch (error) {
    console.error('Cache invalidation error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Helper function to check if a cache key should be considered invalidated
export function isCacheInvalidated(userIdentifier, cacheKey) {
  const fullKey = `user_${userIdentifier}_${cacheKey}`;
  const invalidationTime = invalidatedCache.get(fullKey);
  
  if (!invalidationTime) {
    return false; // Not invalidated
  }
  
  // Check if invalidation is still within TTL
  const age = Date.now() - invalidationTime;
  if (age > INVALIDATION_TTL) {
    // Invalidation expired, remove it
    invalidatedCache.delete(fullKey);
    return false;
  }
  
  console.log(`💾 Cache key ${fullKey} was invalidated ${age}ms ago - treating as stale`);
  return true;
}

// Helper function to mark a cache key as fresh (remove invalidation)
export function markCacheFresh(userIdentifier, cacheKey) {
  const fullKey = `user_${userIdentifier}_${cacheKey}`;
  if (invalidatedCache.has(fullKey)) {
    invalidatedCache.delete(fullKey);
    console.log(`✅ Marked ${fullKey} as fresh - removed invalidation`);
  }
}

// Clean up expired invalidation records
function cleanupInvalidationCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, timestamp] of invalidatedCache.entries()) {
    if (now - timestamp > INVALIDATION_TTL) {
      invalidatedCache.delete(key);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired cache invalidation records`);
  }
}