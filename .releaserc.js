/**
 * Semantic Release configuration.
 *
 * Uses @semantic-release/exec to run lint/format fixes after CHANGELOG.md
 * and package.json are updated, ensuring committed files always pass validation.
 */

export default {
  branches: ["master"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle: "# Changelog",
        header:
          "All notable changes to this project will be documented in this file.\n\n" +
          "This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and\n" +
          "uses [semantic-release](https://semantic-release.gitbook.io/) for automated releases.\n" +
          "The format is based on [Keep a Changelog](https://keepachangelog.org/en/1.1.0/).\n\n",
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: true,
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "bun run lint:fix",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: ["dist/*"],
        successComment: false,
      },
    ],
  ],
  tagFormat: "v${version}",
};
