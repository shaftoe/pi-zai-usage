/**
 * Unit tests for api.ts — Z.ai-specific API logic
 *
 * Tests the Z.ai getZaiUsage function which composes shared library
 * primitives (buildAuthHeaders, safeFetch, safeParseJson, UsageError)
 * with Z.ai-specific response parsing.
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

describe("getZaiUsage", () => {
  let mockModelRegistry: any
  let mockFetch: any

  beforeEach(() => {
    mockModelRegistry = {
      getApiKeyForProvider: async () => "test-api-key",
    }

    const defaultResponse: ZaiUsageResponse = {
      data: {
        limits: [
          {
            type: "TOKENS_LIMIT",
            percentage: 50,
          },
        ],
      },
    }

    mockFetch = mock(() => Promise.resolve(mockOkResponse(defaultResponse)))
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
      return Promise.resolve(
        mockOkResponse({ data: { limits: [{ type: "TOKENS_LIMIT", percentage: 50 }] } }),
      )
    })

    const result = await getZaiUsage(mockModelRegistry)
    expect(result.percentage).toBe(50)
    const headers = fetchHeaders as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(headers["Accept-Encoding"]).toBe("identity")
  })

  it("should make the request without Authorization header for empty string key (proxy mode)", async () => {
    mockModelRegistry.getApiKeyForProvider = async () => ""
    let fetchHeaders: any

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      fetchHeaders = options.headers
      return Promise.resolve(
        mockOkResponse({ data: { limits: [{ type: "TOKENS_LIMIT", percentage: 30 }] } }),
      )
    })

    const result = await getZaiUsage(mockModelRegistry)
    expect(result.percentage).toBe(30)
    const headers = fetchHeaders as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it("should make the request without Authorization header when key is the proxy sentinel", async () => {
    mockModelRegistry.getApiKeyForProvider = async () => "proxy-managed"
    let fetchHeaders: any

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      fetchHeaders = options.headers
      return Promise.resolve(
        mockOkResponse({ data: { limits: [{ type: "TOKENS_LIMIT", percentage: 70 }] } }),
      )
    })

    const result = await getZaiUsage(mockModelRegistry)
    expect(result.percentage).toBe(70)
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

  it("should throw an error when TOKENS_LIMIT is not found in response", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          { type: "OTHER_LIMIT", percentage: 50 },
          { type: "ANOTHER_LIMIT", percentage: 75 },
        ],
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

  it("should return usage data without reset time when nextResetTime is missing", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          {
            type: "TOKENS_LIMIT",
            percentage: 75,
          },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result).toEqual({
      percentage: 75,
    })
    expect(result.resetTime).toBeUndefined()
    expect(result.timeRemaining).toBeUndefined()
  })

  it("should return usage data with reset time when nextResetTime is provided", async () => {
    const resetTime = Date.now() + 3600000 // 1 hour from now
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          {
            type: "TOKENS_LIMIT",
            percentage: 75,
            nextResetTime: resetTime,
          },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.percentage).toBe(75)
    expect(result.resetTime).toBeDefined()
    expect(result.timeRemaining).toBeDefined()
    expect(typeof result.resetTime).toBe("string")
    expect(typeof result.timeRemaining).toBe("string")
  })

  it("should handle 0% usage", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          {
            type: "TOKENS_LIMIT",
            percentage: 0,
          },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.percentage).toBe(0)
  })

  it("should handle 100% usage", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          {
            type: "TOKENS_LIMIT",
            percentage: 100,
          },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.percentage).toBe(100)
  })

  it("should make request to correct API endpoint", async () => {
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          {
            type: "TOKENS_LIMIT",
            percentage: 50,
          },
        ],
      },
    }

    let fetchUrl: string | undefined
    let fetchHeaders: any

    mockFetch.mockImplementationOnce((url: string, options: RequestInit) => {
      fetchUrl = url
      fetchHeaders = options.headers
      return Promise.resolve(mockOkResponse(mockResponse))
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

    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          {
            type: "TOKENS_LIMIT",
            percentage: 25,
          },
        ],
      },
    }

    let fetchHeaders: any

    mockFetch.mockImplementationOnce((_url: string, options: RequestInit) => {
      fetchHeaders = options.headers
      return Promise.resolve(mockOkResponse(mockResponse))
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
          {
            type: "TOKENS_LIMIT",
            percentage: 42.5,
          },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.percentage).toBe(42.5)
  })

  it("should handle multiple limits in response and find TOKENS_LIMIT", async () => {
    const resetTime = Date.now() + 7200000 // 2 hours from now
    const mockResponse: ZaiUsageResponse = {
      data: {
        limits: [
          { type: "OTHER_LIMIT", percentage: 10 },
          { type: "TOKENS_LIMIT", percentage: 85, nextResetTime: resetTime },
          { type: "ANOTHER_LIMIT", percentage: 30 },
        ],
      },
    }

    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse(mockResponse)))

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.percentage).toBe(85)
    expect(result.resetTime).toBeDefined()
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
