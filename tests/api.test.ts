/**
 * Unit tests for api.ts
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { getZaiUsage, type ZaiUsageResponse } from "../src/api"

/**
 * Helper to create a mock Response that uses json() (matching the production code path).
 * Our production code reads the body via response.json(), which also properly
 * handles Content-Encoding decompression in real fetch implementations.
 */
function mockOkResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => {
      if (body === "") {
        // Simulate what real fetch does for empty bodies
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
    // Create a fresh mock for each test
    mockModelRegistry = {
      getApiKeyForProvider: async () => "test-api-key",
    }

    // Default mock: returns a valid usage response
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

  it("should throw an error when API key is missing", async () => {
    mockModelRegistry.getApiKeyForProvider = async () => null

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow(
      "Missing Z.ai API credentials. Run /login for Z.ai.",
    )
  })

  it("should throw an error when API key is empty string", async () => {
    mockModelRegistry.getApiKeyForProvider = async () => ""

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow(
      "Missing Z.ai API credentials. Run /login for Z.ai.",
    )
  })

  it("should throw an error when API request fails with 401", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(mockErrorResponse(401)))

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow("API request failed with status 401")
  })

  it("should throw an error when API returns 500", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(mockErrorResponse(500)))

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow("API request failed with status 500")
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

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow("TOKENS_LIMIT not found in API response")
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

  // --- New tests for robustness against Pi v0.75.0 fetch changes ---

  it("should throw a descriptive error when the response body is empty", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse("")))

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow("Z.ai API returned invalid JSON")
  })

  it("should throw a descriptive error when the response body is not valid JSON", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(mockOkResponse("this is not json")))

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow("Z.ai API returned invalid JSON")
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

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow(
      "Z.ai API error: token expired or incorrect",
    )
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

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow("Z.ai API error: rate limit exceeded")
  })
})
