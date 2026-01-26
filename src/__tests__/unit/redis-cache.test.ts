// Unused import removed from "../../cache/redis-cache.service"
import { MemoryCacheService } from "../../cache/memory-cache.service"

describe("Cache Services", () => {
  describe("MemoryCacheService", () => {
    let cache: MemoryCacheService

    beforeEach(() => {
      cache = new MemoryCacheService({ namespace: "test" })
    })

    afterEach(async () => {
      await cache.close()
    })

    test("should set and get value", async () => {
      await cache.set("key1", "value1")
      const value = await cache.get<string>("key1")
      expect(value).toBe("value1")
    })

    test("should return null for non-existent key", async () => {
      const value = await cache.get("nonexistent")
      expect(value).toBeNull()
    })

    test("should delete key", async () => {
      await cache.set("key1", "value1")
      await cache.del("key1")
      const value = await cache.get("key1")
      expect(value).toBeNull()
    })

    test("should delete multiple keys", async () => {
      await cache.set("key1", "value1")
      await cache.set("key2", "value2")
      await cache.set("key3", "value3")

      await cache.delMany(["key1", "key2"])

      expect(await cache.get("key1")).toBeNull()
      expect(await cache.get("key2")).toBeNull()
      expect(await cache.get("key3")).toBe("value3")
    })

    test("should check if key exists", async () => {
      await cache.set("key1", "value1")

      expect(await cache.has("key1")).toBe(true)
      expect(await cache.has("nonexistent")).toBe(false)
    })

    test.skip("should get keys by pattern (not supported in MemoryCache)", async () => {
      await cache.set("user:1", { id: 1 })
      await cache.set("user:2", { id: 2 })
      await cache.set("product:1", { id: 1 })

      const userKeys = await cache.keys("user:*")
      expect(userKeys).toHaveLength(2)
      expect(userKeys).toContain("user:1")
      expect(userKeys).toContain("user:2")
    })

    test("should clear all cache", async () => {
      await cache.set("key1", "value1")
      await cache.set("key2", "value2")

      await cache.clear()

      expect(await cache.get("key1")).toBeNull()
      expect(await cache.get("key2")).toBeNull()
    })

    test.skip("should clear cache by pattern (not supported in MemoryCache)", async () => {
      await cache.set("user:1", { id: 1 })
      await cache.set("user:2", { id: 2 })
      await cache.set("product:1", { id: 1 })

      await cache.clear("user:*")

      expect(await cache.get("user:1")).toBeNull()
      expect(await cache.get("user:2")).toBeNull()
      expect(await cache.get("product:1")).not.toBeNull()
    })

    test("should get cache statistics", async () => {
      await cache.set("key1", "value1")
      await cache.get("key1") // hit
      await cache.get("nonexistent") // miss

      const stats = await cache.getStats()

      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBe(50)
      expect(stats.keys).toBeGreaterThan(0)
    })

    test("should handle complex objects", async () => {
      const user = {
        id: 1,
        name: "John",
        email: "john@example.com",
        metadata: {
          createdAt: new Date().toISOString(),
          tags: ["admin", "user"],
        },
      }

      await cache.set("user:1", user)
      const retrieved = await cache.get<typeof user>("user:1")

      expect(retrieved).toEqual(user)
    })

    test("should handle TTL", async () => {
      // Set with 1 second TTL
      await cache.set("temp", "value", 1)

      // Should exist immediately
      expect(await cache.get("temp")).toBe("value")

      // Wait 1.5 seconds
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Should be expired
      expect(await cache.get("temp")).toBeNull()
    })
  })

  // Note: Redis tests require a running Redis instance
  // They are commented out by default
  /*
  describe('RedisCacheService', () => {
    let cache: RedisCacheService;

    beforeAll(async () => {
      cache = new RedisCacheService({ 
        namespace: 'test',
        host: '127.0.0.1',
        port: 6379,
      });
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterAll(async () => {
      await cache.clear(); // Clean up test data
      await cache.close();
    });

    test('should ping Redis', async () => {
      const result = await cache.ping();
      expect(result).toBe(true);
    });

    test('should set and get value from Redis', async () => {
      await cache.set('redis:key1', 'value1');
      const value = await cache.get<string>('redis:key1');
      expect(value).toBe('value1');
    });

    test('should handle TTL in Redis', async () => {
      await cache.set('temp', 'value', 2);
      
      const ttl = await cache.getTTL('temp');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(2);
    });

    test('should increment atomically', async () => {
      await cache.set('counter', 0);
      
      await cache.increment('counter', 1);
      await cache.increment('counter', 5);
      
      const value = await cache.get<number>('counter');
      expect(value).toBe(6);
    });
  });
  */
})
