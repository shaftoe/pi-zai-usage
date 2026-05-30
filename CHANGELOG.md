# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.2] - 2026-05-30

### Changed

- use @alexanderfortin/pi-usage-lib shared library (#38)

### Fixed

- fix ts type issue

## [0.2.1] - 2026-05-29

### Changed

- **deps**: update dependencies (#34)
- **deps**: update dependencies (#35)

### Fixed

- add UTC default timezone to support sbx sandboxes

## [0.2.0] - 2026-05-26

### Added

- show error codes in footer instead of raw console errors

### Changed

- **deps**: update dependencies (#32)
- **deps**: update dependencies (#33)

## [0.1.14] - 2026-05-18

### Fixed

- remove pinned dependency version

## [0.1.13] - 2026-05-18

### Fixed

- handle empty/malformed API responses from Pi v0.75.0 fetch changes

## [0.1.12] - 2026-05-08

### Fixed

- **deps**: update namespace to @earendil-works

## [0.1.11] - 2026-05-04

### Fixed

- **deps**: bump dependencies

## [0.1.10] - 2026-04-26

### Fixed

- **deps**: update dependencies to latest versions (#10)

## [0.1.9] - 2026-04-14

### Changed

- **deps**: bump @mariozechner/pi-coding-agent (#1)
- **deps**: update Pi and other deps

### Fixed

- bump release

## [0.1.8] - 2026-04-09

### Fixed

- correct CHANGELOG format and semantic release configuration

## [0.1.7] - 2026-04-09

### Fixed

- add semantic release automated workflow

## [0.1.6] - 2026-04-04

### Changed

- Manual version bump for NPM publishing

## [0.1.3] - 2026-04-04

### Changed

- remove redundant cleanup for turn_end
- reduce duplication in set status logic
- fix readme

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

### Changed

- Enabled full OIDC publishing (no NPM_TOKEN required)

[unreleased]: https://github.com/shaftoe/pi-zai-usage/compare/v0.2.2...HEAD
[0.2.2]: https://github.com/shaftoe/pi-zai-usage/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/shaftoe/pi-zai-usage/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.14...v0.2.0
[0.1.14]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.3...v0.1.6
[0.1.3]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/shaftoe/pi-zai-usage/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/shaftoe/pi-zai-usage/releases/tag/v0.1.1
