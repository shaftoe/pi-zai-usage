/**
 * Z.ai Usage Checker - Pi Extension
 * Type definitions for the extension
 */

import type {
  ExtensionContext as PiExtensionContext,
  ModelRegistry as PiModelRegistry,
  ThemeColor,
} from "@mariozechner/pi-coding-agent"

// --- Re-export pi types for convenience ---

export type ExtensionContext = PiExtensionContext
export type ModelRegistry = PiModelRegistry
export type ThemeColorValue = ThemeColor

// --- API types ---

export interface ZaiUsageResponse {
  data: {
    limits: Array<{
      type: string
      percentage: number
      nextResetTime?: number
    }>
  }
}

export interface ZaiUsageData {
  percentage: number
  resetTime?: string
  timeRemaining?: string
}

// --- Simplified ModelSelectEvent for our use case ---

export interface ModelSelectEvent {
  model: { provider: string; id: string }
  previousModel?: { provider: string; id: string }
  source: string
}
