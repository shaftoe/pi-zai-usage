/**
 * Unit tests for api.ts — Z.ai-specific API logic
 *
 * Tests the Z.ai getZaiUsage function which composes shared library
 * primitives (buildAuthHeaders, safeFetch, safeParseJson, UsageError)
 * with Z.ai-specific response parsing.
 *
 * The Z.ai quota API returns a `limits` array whose window kind is
 * encoded by type + unit (not array order):
 *   TOKENS_LIMIT unit 3 = 5-hour rolling quota
 *   TOKENS_LIMIT unit 6 = weekly (7-day) quota
 *   TIME_LIMIT   unit 5 = monthly web-tool budget
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { getZaiUsage, UsageError, type ZaiUsageResponse } from "../src/api"

/**
 * Helper to create a mock Response that uses json() (matching the production code path).
 */
function mockOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => {
      if (body === "") {
        return Promise.reject(new SyntaxError("Unexpected end of JSON input"))
      }
      if (typeof body === "string") {
        return Promise.reject(new SyntaxError(`${body} is not valid JSON`))
      }
      return Promise.resolve(body)
    },
  } as Response
}

function mockErrorResponse(status: number): Response {
  return {
    ok: false,
    status,
  } as Response
}

/** A canonical full response with all three windows, mirroring the live API. */
function fullResponse(overrides?: {
  fiveHourPct?: number
  weeklyPct?: number
  level?: string
}): ZaiUsageResponse {
  return {
    data: {
      level: overrides?.level ?? "lite",
      limits: [
        { type: "TIME_LIMIT", unit: 5, number: 1, percentage: 0, nextResetTime: 1787756942995 },
        {
          type: "TOKENS_LIMIT",
          unit: 3,
          percentage: overrides?.fiveHourPct ?? 50,
          nextResetTime: 1786307528544,
        },
        {
          type: "TOKENS_LIMIT",
          unit: 6,
          percentage: overrides?.weeklyPct ?? 4,
          nextResetTime: 1786892942997,
        },
      ],
    },
  }
}

describe("getZaiUsage", () => {
  let mockModelRegistry: any
  let mockFetch: any

  beforeEach(() => {
    mockModelRegistry = {
      getApiKeyForProvider: async () => "test-api-key",
    }

    mockFetch = mock(() => Promise.resolve(mockOkResponse(fullResponse())))
    global.fetch = mockFetch
  })

  afterEach(() => {
    mockFetch.mockRestore()
  })

  it("should make the request without Authorization header when no API key (proxy mode)", async () => {
    mockModelRegistry.getApiKeyForProvider = async () => null
    let fetchHeaders: any

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      fetchHeaders = options.headers
      return Promise.resolve(mockOkResponse(fullResponse({ fiveHourPct: 50 })))
    })

    const result = await getZaiUsage(mockModelRegistry)
    expect(result.fiveHour?.percentage).toBe(50)
    const headers = fetchHeaders as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(headers["Accept-Encoding"]).toBe("identity")
  })

  it("should make the request without Authorization header for empty string key (proxy mode)", async () => {
    mockModelRegistry.getApiKeyForProvider = async () => ""
    let fetchHeaders: any

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      fetchHeaders = options.headers
      return Promise.resolve(mockOkResponse(fullResponse({ fiveHourPct: 30 })))
    })

    const result = await getZaiUsage(mockModelRegistry)
    expect(result.fiveHour?.percentage).toBe(30)
    const headers = fetchHeaders as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it("should make the request without Authorization header when key is the proxy sentinel", async () => {
    mockModelRegistry.getApiKeyForProvider = async () => "proxy-managed"
    let fetchHeaders: any

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      fetchHeaders = options.headers
      return Promise.resolve(mockOkResponse(fullResponse({ fiveHourPct: 70 })))
    })

    const result = await getZaiUsage(mockModelRegistry)
    expect(result.fiveHour?.percentage).toBe(70)
    const headers = fetchHeaders as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(headers["Accept-Encoding"]).toBe("identity")
  })

  it("should throw an error when API request fails with 401", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(mockErrorResponse(401)))

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toBe("API request failed with status 401")
      expect((e as UsageError).code).toBe("http401")
    }
  })

  it("should throw an error when API returns 500", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(mockErrorResponse(500)))

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toBe("API request failed with status 500")
      expect((e as UsageError).code).toBe("http500")
    }
  })

  it("should throw an error when no limits array is present in response", async () => {
    const mockResponse = { data: {} }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toBe("No quota limits found in API response")
      expect((e as UsageError).code).toBe("nolimit")
    }
  })

  it("should throw an error when limits array is empty", async () => {
    const mockResponse = { data: { limits: [] } }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toBe("No quota limits found in API response")
      expect((e as UsageError).code).toBe("nolimit")
    }
  })

  it("should throw an error when neither TOKENS_LIMIT window is present", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [{ type: "TIME_LIMIT", unit: 5, percentage: 50 }],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toBe("TOKENS_LIMIT not found in API response")
      expect((e as UsageError).code).toBe("nolimit")
    }
  })

  it("should extract both 5h and weekly windows and plan level", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        mockOkResponse(fullResponse({ fiveHourPct: 23, weeklyPct: 4, level: "pro" })),
      ),
    )

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.level).toBe("pro")
    expect(result.fiveHour?.percentage).toBe(23)
    expect(result.fiveHour?.resetTime).toBeDefined()
    expect(result.fiveHour?.timeRemaining).toBeDefined()
    expect(result.weekly?.percentage).toBe(4)
    expect(result.weekly?.resetTime).toBeDefined()
    expect(result.weekly?.timeRemaining).toBeDefined()
    expect(result.monthlyTools?.percentage).toBe(0)
    expect(result.monthlyTools?.resetTime).toBeDefined()
  })

  it("should select windows by type+unit regardless of array order", async () => {
    // Weekly first, then 5h — order must not matter.
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          { type: "TOKENS_LIMIT", unit: 6, percentage: 88, nextResetTime: 1786892942997 },
          { type: "TOKENS_LIMIT", unit: 3, percentage: 11, nextResetTime: 1786307528544 },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.fiveHour?.percentage).toBe(11)
    expect(result.weekly?.percentage).toBe(88)
  })

  it("should return data without reset times when nextResetTime is missing", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          { type: "TOKENS_LIMIT", unit: 3, percentage: 75 },
          { type: "TOKENS_LIMIT", unit: 6, percentage: 40 },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.fiveHour).toEqual({ percentage: 75 })
    expect(result.weekly).toEqual({ percentage: 40 })
    expect(result.fiveHour?.resetTime).toBeUndefined()
    expect(result.fiveHour?.timeRemaining).toBeUndefined()
  })

  it("should omit the plan level when it is absent from the response", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [{ type: "TOKENS_LIMIT", unit: 3, percentage: 75 }],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)
    expect(result.level).toBeUndefined()
  })

  it("should still succeed when only the weekly window is present", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        level: "max",
        limits: [{ type: "TOKENS_LIMIT", unit: 6, percentage: 60, nextResetTime: 1786892942997 }],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.fiveHour).toBeUndefined()
    expect(result.weekly?.percentage).toBe(60)
    expect(result.level).toBe("max")
  })

  it("should handle 0% usage on both windows", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(mockOkResponse(fullResponse({ fiveHourPct: 0, weeklyPct: 0 }))),
    )

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.fiveHour?.percentage).toBe(0)
    expect(result.weekly?.percentage).toBe(0)
  })

  it("should handle 100% usage (cap exhausted)", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(mockOkResponse(fullResponse({ fiveHourPct: 100, weeklyPct: 100 }))),
    )

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.fiveHour?.percentage).toBe(100)
    expect(result.weekly?.percentage).toBe(100)
  })

  it("should make request to correct API endpoint", async () => {
    let fetchUrl: string | undefined
    let fetchHeaders: any

    mockFetch.mockImplementationOnce((url: string, options: RequestInit) => {
      fetchUrl = url
      fetchHeaders = options.headers
      return Promise.resolve(mockOkResponse(fullResponse()))
    })

    await getZaiUsage(mockModelRegistry)

    expect(fetchUrl).toBe("https://api.z.ai/api/monitor/usage/quota/limit")
    expect(fetchHeaders).toBeDefined()
    const headers = fetchHeaders as Record<string, string>
    expect(headers.Authorization).toBe("Bearer test-api-key")
    expect(headers["Accept-Encoding"]).toBe("identity")
  })

  it("should use the provided API key from model registry", async () => {
    const customApiKey = "custom-api-key-12345"
    mockModelRegistry.getApiKeyForProvider = async () => customApiKey

    let fetchHeaders: any

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      fetchHeaders = options.headers
      return Promise.resolve(mockOkResponse(fullResponse()))
    })

    await getZaiUsage(mockModelRegistry)

    const headers = fetchHeaders as Record<string, string>
    expect(headers.Authorization).toBe(`Bearer ${customApiKey}`)
    expect(headers["Accept-Encoding"]).toBe("identity")
  })

  it("should handle decimal percentage values", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          { type: "TOKENS_LIMIT", unit: 3, percentage: 42.5 },
          { type: "TOKENS_LIMIT", unit: 6, percentage: 7.25 },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.fiveHour?.percentage).toBe(42.5)
    expect(result.weekly?.percentage).toBe(7.25)
  })

  it("should tolerate extra/unknown limit types without breaking", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          { type: "UNKNOWN_LIMIT", unit: 99, percentage: 10 },
          { type: "TOKENS_LIMIT", unit: 3, percentage: 85, nextResetTime: 1786307528544 },
          { type: "TOKENS_LIMIT", unit: 6, percentage: 30, nextResetTime: 1786892942997 },
          { type: "ANOTHER_LIMIT", unit: 1, percentage: 20 },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.fiveHour?.percentage).toBe(85)
    expect(result.weekly?.percentage).toBe(30)
  })

  it("should throw a descriptive error when the response body is empty", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse("")))

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toContain("API returned invalid JSON")
      expect((e as UsageError).code).toBe("badjson")
    }
  })

  it("should throw a descriptive error when the response body is not valid JSON", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse("this is not json")))

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toContain("API returned invalid JSON")
      expect((e as UsageError).code).toBe("badjson")
    }
  })

  it("should throw when Z.ai API returns 200 with an auth error body", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        mockOkResponse({
          code: 401,
          msg: "token expired or incorrect",
          success: false,
        }),
      ),
    )

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toBe("Z.ai API error: token expired or incorrect")
      expect((e as UsageError).code).toBe("api401")
    }
  })

  it("should default to 'unknown' when API error body has no code field", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        mockOkResponse({
          msg: "something went wrong",
          success: false,
        }),
      ),
    )

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toBe("Z.ai API error: something went wrong")
      expect((e as UsageError).code).toBe("apiunknown")
    }
  })

  it("should wrap network-level fetch errors as UsageError", async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new TypeError("fetch failed")))

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toContain("Network error: fetch failed")
      expect((e as UsageError).code).toBe("fetch")
    }
  })

  it("should throw when Z.ai API returns 200 with a generic error body", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        mockOkResponse({
          code: 429,
          msg: "rate limit exceeded",
          success: false,
        }),
      ),
    )

    try {
      await getZaiUsage(mockModelRegistry)
      expect.unreachable("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(UsageError)
      expect((e as UsageError).message).toBe("Z.ai API error: rate limit exceeded")
      expect((e as UsageError).code).toBe("api429")
    }
  })
})
