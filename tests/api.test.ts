/**
 * Unit tests for api.ts
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { getZaiUsage } from "../src/api"
import type { ZaiUsageResponse } from "../src/types"

describe("getZaiUsage", () => {
  let mockModelRegistry: any
  let mockFetch: any

  beforeEach(() => {
    // Create a fresh mock for each test
    mockModelRegistry = {
      getApiKeyForProvider: async () => "test-api-key",
    }

    // Mock global fetch
    mockFetch = mock(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            limits: [
              {
                type: "TOKENS_LIMIT",
                percentage: 50,
              },
            ],
          },
        }),
      } as Response),
    )

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
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 401,
      } as Response),
    )

    expect(getZaiUsage(mockModelRegistry)).rejects.toThrow("API request failed with status 401")
  })

  it("should throw an error when API returns 500", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
      } as Response),
    )

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

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response),
    )

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

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response),
    )

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

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response),
    )

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

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response),
    )

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

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response),
    )

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
      return Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response)
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
      return Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response)
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

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response),
    )

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

    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: async () => mockResponse,
      } as Response),
    )

    const result = await getZaiUsage(mockModelRegistry)

    expect(result.percentage).toBe(85)
    expect(result.resetTime).toBeDefined()
  })
})
