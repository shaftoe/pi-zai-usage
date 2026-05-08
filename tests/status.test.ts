/**
 * Unit tests for status.ts
 */

import { describe, expect, it, mock } from "bun:test"
import type { ExtensionContext } from "@earendil-works/pi-coding-agent"
import type { ZaiUsageData } from "../src/api"
import { isCurrentModelZai, isZaiProvider, ZaiUsageCache } from "../src/status"

// Helper to create a mock context
const createMockContext = (
  overrides: Partial<ExtensionContext> = {},
): ExtensionContext & {
  ui: {
    setStatus: ReturnType<typeof mock>
    theme: { fg: (color: string, text: string) => string }
  }
} => {
  return {
    ui: {
      setStatus: mock(() => {}),
      theme: {
        fg: (color: string, text: string) => `${color}:${text}`,
      },
    },
    modelRegistry: {
      getApiKeyForProvider: async () => "test-api-key",
    },
    ...overrides,
  } as any
}

// Helper to create a mock fetch usage function
const createMockFetchUsage = (data: ZaiUsageData) => mock(() => Promise.resolve(data)) as any

// Helper to create a mock fetch usage function that throws
const createThrowingFetchUsage = (errorMessage: string) =>
  mock(() => Promise.reject(new Error(errorMessage))) as any

// Helper to create a cache with mocked fetch
const createMockCache = (fetchFn: ReturnType<typeof createMockFetchUsage>) => {
  const cache = new ZaiUsageCache()
  // Monkey-patch the updateStatus method to use our mock fetch
  const originalUpdateStatus = cache.updateStatus.bind(cache)
  cache.updateStatus = (ctx) => originalUpdateStatus(ctx, fetchFn)
  return cache
}

describe("ZaiUsageCache", () => {
  describe("fresh API call scenarios", () => {
    it("should set status with usage percentage from fresh API call", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({ percentage: 50 })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", "muted:Z.ai:accent:50%")
    })

    it("should set status with reset time and time remaining when available", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({
        percentage: 75,
        resetTime: "2025-04-04T00:00:00Z",
        timeRemaining: "2h 30m",
      })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith(
        "zai-usage",
        "muted:Z.ai:accent:75% dim:(2h 30m)",
      )
    })

    it("should handle 0% usage", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({ percentage: 0 })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", "muted:Z.ai:accent:0%")
    })

    it("should handle 100% usage", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({ percentage: 100 })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", "muted:Z.ai:accent:100%")
    })

    it("should handle decimal percentage values", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({ percentage: 42.5 })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", "muted:Z.ai:accent:42.5%")
    })

    it("should round percentage to 1 decimal place", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({ percentage: 42.567 })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", "muted:Z.ai:accent:42.6%")
    })

    it("should clear status on fetch error", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createThrowingFetchUsage("API error")
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", undefined)
    })
  })

  describe("caching scenarios", () => {
    it("should use cached data when within cooldown period", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({
        percentage: 50,
        resetTime: "2025-04-04T00:00:00Z",
        timeRemaining: "2h 30m",
      })
      const cache = createMockCache(mockFetch)

      // First call - should fetch
      await cache.updateStatus(mockCtx)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith(
        "zai-usage",
        "muted:Z.ai:accent:50% dim:(2h 30m)",
      )

      // Second call immediately - should use cache (within 30s cooldown)
      await cache.updateStatus(mockCtx)

      // Mock should not be called again (cached data used)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      // Status should still be set with cached data
      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith(
        "zai-usage",
        "muted:Z.ai:accent:50% dim:(2h 30m)",
      )
    })

    it("should set status with only percentage when cached data has no reset info", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({ percentage: 30 })
      const cache = createMockCache(mockFetch)

      // First call
      await cache.updateStatus(mockCtx)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", "muted:Z.ai:accent:30%")

      // Second call - should use cache
      await cache.updateStatus(mockCtx)
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", "muted:Z.ai:accent:30%")
    })
  })

  describe("theme formatting", () => {
    it("should use theme colors for formatting", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({ percentage: 50 })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      const statusCall = mockCtx.ui.setStatus.mock.calls[0]
      expect(statusCall).toBeDefined()
      expect(statusCall).toHaveLength(2)
      expect(statusCall?.[0]).toBe("zai-usage")
      expect(typeof statusCall?.[1]).toBe("string")
      expect(statusCall?.[1]).toContain("muted:")
      expect(statusCall?.[1]).toContain("accent:")
    })

    it("should include dim color when reset time is present", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({
        percentage: 50,
        resetTime: "2025-04-04T00:00:00Z",
        timeRemaining: "1h 0m",
      })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      const statusCall = mockCtx.ui.setStatus.mock.calls[0]
      expect(statusCall).toBeDefined()
      expect(statusCall?.[1]).toContain("dim:")
    })

    it("should not include dim color when reset time is absent", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createMockFetchUsage({ percentage: 50 })
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      const statusCall = mockCtx.ui.setStatus.mock.calls[0]
      expect(statusCall).toBeDefined()
      expect(statusCall?.[1]).not.toContain("dim:")
    })
  })

  describe("error scenarios", () => {
    it("should clear status on fetch error", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createThrowingFetchUsage("Network error")
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", undefined)
    })

    it("should clear status on timeout error", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createThrowingFetchUsage("Request timeout")
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", undefined)
    })

    it("should handle API returning 401 unauthorized", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createThrowingFetchUsage("API request failed with status 401")
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", undefined)
    })

    it("should handle API returning 500 server error", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createThrowingFetchUsage("API request failed with status 500")
      const cache = createMockCache(mockFetch)

      await cache.updateStatus(mockCtx)

      expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", undefined)
    })

    it("should not throw errors, catch them silently", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createThrowingFetchUsage("Some error")
      const cache = createMockCache(mockFetch)

      // Should not throw
      const result = await cache.updateStatus(mockCtx)
      await expect(result).toBeUndefined()
    })

    it("should log error to console on fetch error", async () => {
      const mockCtx = createMockContext()
      const mockFetch = createThrowingFetchUsage("API request failed")
      const cache = createMockCache(mockFetch)
      const mockConsoleError = mock(() => {
        // Capture console.error calls
      })
      const originalConsoleError = console.error

      console.error = mockConsoleError

      try {
        await cache.updateStatus(mockCtx)

        expect(mockConsoleError).toHaveBeenCalled()
        const calls = mockConsoleError.mock.calls as Array<unknown[]>
        expect(calls.length).toBeGreaterThan(0)
        const errorMessage = calls[0]?.[0] as string
        expect(errorMessage).toContain("Error updating Z.ai usage:")
        expect(errorMessage).toContain("API request failed")
      } finally {
        console.error = originalConsoleError
      }
    })
  })
})

describe("ZaiUsageCache.clear", () => {
  it("should clear zai-usage status", () => {
    const mockCtx: ExtensionContext = {
      ui: {
        setStatus: mock(() => {}),
      },
    } as any

    const cache = new ZaiUsageCache()
    cache.clear(mockCtx)

    expect(mockCtx.ui.setStatus).toHaveBeenCalledWith("zai-usage", undefined)
  })
})

describe("isZaiProvider", () => {
  it("should return true for 'zai'", () => {
    expect(isZaiProvider("zai")).toBe(true)
  })

  it("should return true for providers starting with 'zai'", () => {
    expect(isZaiProvider("zai-extra")).toBe(true)
    expect(isZaiProvider("zai-pro")).toBe(true)
    expect(isZaiProvider("zai-enterprise")).toBe(true)
  })

  it("should return false for non-zai providers", () => {
    expect(isZaiProvider("anthropic")).toBe(false)
    expect(isZaiProvider("openai")).toBe(false)
    expect(isZaiProvider("google")).toBe(false)
  })

  it("should return false for undefined provider", () => {
    expect(isZaiProvider(undefined)).toBe(false)
  })

  it("should be case insensitive", () => {
    expect(isZaiProvider("ZAI")).toBe(true)
    expect(isZaiProvider("Zai")).toBe(true)
    expect(isZaiProvider("zAi")).toBe(true)
    expect(isZaiProvider("ZAI-EXTRA")).toBe(true)
    expect(isZaiProvider("Zai-Pro")).toBe(true)
  })

  it("should return false for providers that contain 'zai' but don't start with it", () => {
    expect(isZaiProvider("my-zai-provider")).toBe(false)
    expect(isZaiProvider("not-zai")).toBe(false)
  })
})

describe("isCurrentModelZai", () => {
  it("should return true when current model provider is zai", () => {
    const mockCtx: ExtensionContext = {
      model: {
        provider: "zai",
        id: "some-model",
      },
    } as any

    expect(isCurrentModelZai(mockCtx)).toBe(true)
  })

  it("should return true when current model provider starts with zai", () => {
    const mockCtx: ExtensionContext = {
      model: {
        provider: "zai-extra",
        id: "zai-model-1",
      },
    } as any

    expect(isCurrentModelZai(mockCtx)).toBe(true)
  })

  it("should return false when current model provider is not zai", () => {
    const mockCtx: ExtensionContext = {
      model: {
        provider: "openai",
        id: "gpt-4",
      },
    } as any

    expect(isCurrentModelZai(mockCtx)).toBe(false)
  })

  it("should return false when model is undefined", () => {
    const mockCtx: ExtensionContext = {
      model: undefined,
    } as any

    expect(isCurrentModelZai(mockCtx)).toBe(false)
  })

  it("should return false when model is null", () => {
    const mockCtx: ExtensionContext = {
      model: null,
    } as any

    expect(isCurrentModelZai(mockCtx)).toBe(false)
  })

  it("should be case insensitive for provider name", () => {
    const mockCtx: ExtensionContext = {
      model: {
        provider: "ZAI",
        id: "some-model",
      },
    } as any

    expect(isCurrentModelZai(mockCtx)).toBe(true)
  })

  it("should handle model object with only provider property", () => {
    const mockCtx: ExtensionContext = {
      model: {
        provider: "zai",
      },
    } as any

    expect(isCurrentModelZai(mockCtx)).toBe(true)
  })
})
