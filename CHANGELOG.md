# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and
uses [semantic-release](https://semantic-release.gitbook.io/) for automated releases.
The format is based on [Keep a Changelog](https://keepachangelog.org/en/1.1.0/).

## [Unreleased]

## [0.1.7](https://github.com/shaftoe/pi-zai-usage/compare/v0.1.6...v0.1.7) (2026-04-09)

### Bug Fixes

* add semantic release automated workflow ([5d5d7b8](https://github.com/shaftoe/pi-zai-usage/commit/5d5d7b8de972b315c957795fc531059f35ad7268))

## [0.1.6] - 2026-04-04

### Changed

- Manual version bump for NPM publishing

## [0.1.3] - 2026-04-04

### Changed

- fix: remove redundant cleanup for turn_end
- refactor: reduce duplication in set status logic
- docs: fix readme

## [0.1.2] - 2026-04-03

### Changed

- update README with install instructions
- cleanup release docs

## [0.1.1] - 2026-04-03

### Added

- Usage tool for checking Z.ai API token usage quota
- Auto footer display when using Z.ai models
- Smart caching (30-second cache to avoid excessive API calls)
- Temporal-based datetime formatting
- Time tracking (reset time and remaining time display)
- Enabled full OIDC publishing (no NPM_TOKEN required)
