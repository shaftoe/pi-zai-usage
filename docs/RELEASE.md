# Release Documentation

This document describes how to release new versions of the `@alexanderfortin/pi-zai-usage` package to NPM.

## Automated Publishing

The project uses GitHub Actions for automated publishing to NPM. When you push a tag matching `v*` (e.g., `v1.0.0`), the workflow will:

1. Run all CI checks (type checking, linting, tests)
2. Build the package
3. Verify the build output
4. Verify the tag version matches `package.json`
5. Publish to NPM with provenance (signed package)
6. Create a GitHub Release

## Setup Instructions

### Step 1: Initial Setup (Required for first publish)

For a brand new package that doesn't exist on npm yet:

1. **Create an NPM automation token:**

   - Go to https://www.npmjs.com/settings/alexanderfortin/tokens
   - Create a new "Automation" token
   - Copy the token value

2. **Add the token to GitHub Secrets:**

   - Go to your repository on GitHub
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Value: (paste your NPM automation token)
   - Click **Add secret**

3. **Verify package.json configuration:**

   The package.json already includes `"publishConfig": { "access": "public" }`, which ensures the package is published as public when published to npm.

4. **Build and publish the package manually (optional, for first-time or manual publish):**

   ```bash
   # Build and publish locally (without provenance)
   bun run release
   ```

   **Note:** The `bun run publish` command is for local/manual publishing and does **not** include provenance signing. Provenance (`--provenance` flag) only works in CI/CD environments like GitHub Actions with OIDC configured.

   To preview what will be published without actually publishing:

   ```bash
   bun run release:dry-run
   ```

   Or build separately:

   ```bash
   bun run build
   ```

5. **Push a version tag to trigger the first release:**

   ```bash
   # Update version (if needed)
   npm version patch -m "chore: release %s"

   # Push the tag
   git push --follow-tags
   ```

   This will trigger the release workflow, which will publish the package to npm for the first time using the `NPM_TOKEN` secret.

### Step 2: Enable Trusted Publishing (Recommended after first publish)

Once the package exists on npm, you can enable OIDC trusted publishing for more secure automated releases:

1. **Configure Trusted Publishing on npm:**

   - Go to https://www.npmjs.com/package/@alexanderfortin/pi-zai-usage/settings
   - Navigate to the **"Trusted Publisher"** section
   - Click the **GitHub Actions** button
   - Configure the following fields:
     - **Organization or user**: `alex` (your GitHub username)
     - **Repository**: `pi-zai-usage`
     - **Workflow filename**: `release.yml` (must include `.yml` extension)
   - Click **Update Package Settings**

2. **Verify the workflow permissions:**

   The workflow file already includes the necessary permissions:
   - `contents: read` - To checkout the repository
   - `id-token: write` - Required for OIDC (package signing/provenance)

3. **After trusted publishing is configured:**

   The npm CLI will automatically detect the OIDC environment and use it for authentication. The `NPM_TOKEN` secret is no longer required (but can be kept as a fallback).

## Publishing a New Release

### Step-by-Step

1. **Update the version in `package.json`:**

   ```bash
   # Using npm
   npm version patch  # or minor, major

   # Or manually edit package.json
   ```

2. **Update CHANGELOG.md (if applicable):**

   Add release notes for the new version.

3. **Commit the changes:**

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "chore: release v1.2.3"
   ```

4. **Tag the release:**

   ```bash
   git tag v1.2.3
   ```

5. **Push the tag:**

   ```bash
   git push origin v1.2.3
   ```

   This will trigger the release workflow automatically.

### Version Bump Shortcut

You can use npm's version commands to automate bumping and tagging:

```bash
# Patch release (bug fixes): 1.0.0 → 1.0.1
npm version patch -m "chore: release %s"

# Minor release (new features): 1.0.0 → 1.1.0
npm version minor -m "chore: release %s"

# Major release (breaking changes): 1.0.0 → 2.0.0
npm version major -m "chore: release %s"
```

Then push:

```bash
git push --follow-tags
```

## Troubleshooting

### Workflow Fails on Version Mismatch

**Error:** `package.json version (X.Y.Z) does not match tag version (X.Y.Z)`

**Solution:** Ensure the version in `package.json` exactly matches the tag name without the `v` prefix.

```bash
# Tag should be vX.Y.Z for version X.Y.Z in package.json
git tag v1.2.3  # package.json should have "version": "1.2.3"
```

### Provenance Errors

**Error:** `EPUBLISHPROVENANCE: Failed to generate provenance statement`

**Solutions:**

1. Ensure `id-token: write` permission is set in the workflow
2. Verify your NPM package is configured for OIDC
3. Ensure you're using npm CLI version 11.5.1 or later

### NPM Authentication Errors

**Error:** `ENEEDAUTH`, `401 Unauthorized`, or `EPUBLISH: E401`

**Solutions:**

1. Verify the `NPM_TOKEN` secret is set in GitHub repository settings
2. Ensure the token is an "Automation" type token (not "Read-only")
3. Check that the token has publish permissions for the `@alexanderfortin/pi-zai-usage` package
4. If this is the first publish for a new package, ensure you've completed Step 1 above

### Package Doesn't Exist on npm

**Error:** `404 Not Found` when publishing

**Solution:** This error typically occurs when:
- The package name in package.json doesn't match
- You're trying to use trusted publishing before the package exists

For the first publish, use the NPM_TOKEN method (Step 1). After the package exists, configure trusted publishing (Step 2).

### Build Verification Fails

**Error:** Build output verification fails

**Solutions:**

1. Ensure `bun run build` generates the `dist/` directory
2. Check that `dist/index.js` and `dist/index.d.ts` are created
3. Run `bun run build` locally to verify it works

## Best Practices

1. **Always run CI before releasing:**

   ```bash
   bun run ci
   ```

2. **Keep CHANGELOG.md updated:**

   Document changes for each release to help users understand what's new.

3. **Use semantic versioning:**

   - **Patch** (X.Y.Z): Bug fixes, minor improvements
   - **Minor** (X.Y.0): New features, backward compatible
   - **Major** (X.0.0): Breaking changes

4. **Test locally first:**

   ```bash
   # Build locally
   bun run build

   # Test the package
   bun test

   # Preview the package contents
   npm pack --dry-run
   ```

5. **Monitor the NPM publication:**

   - Check the package on NPM after release
   - Verify the package size and contents
   - Ensure the version is published correctly

## Package Signing and Provenance

### Provenance in CI/CD

The GitHub Actions workflow uses NPM's provenance feature, which:

- Signs packages cryptographically
- Links the package to the GitHub workflow that built it
- Provides users with confidence in package authenticity
- Is displayed on the NPM package page

The workflow uses `--provenance` flag which only works in CI/CD environments with OIDC configured.

### Local Publishing

When publishing locally from CLI (using `bun run publish`), provenance is **not** supported because:
- There's no OIDC provider available locally
- npm CLI cannot detect a CI/CD environment

This is normal - local publishes don't have provenance, but CI/CD publishes will have it.

### To verify a package's provenance:

```bash
npm audit signatures
```

**Requirements for provenance in CI/CD:**
- npm CLI version 11.5.1 or later
- Node.js version 22.14.0 or higher
- `id-token: write` permission in GitHub Actions
- Trusted publishing configured on npm

## Rollback Procedure

If a release needs to be rolled back:

1. **Deprecate the version (not delete):**

   ```bash
   npm deprecate @alexanderfortin/pi-zai-usage@1.2.3 "Critical bug, use 1.2.4 instead"
   ```

2. **Unpublish (only if necessary - use with caution):**

   ```bash
   npm unpublish @alexanderfortin/pi-zai-usage@1.2.3 --force
   ```

   **Warning:** Unpublishing is disruptive for users. Prefer deprecation.

3. **Release a fix:**

   Create a new version with the fix and release it normally.

## Additional Resources

- [NPM Trusted Publishing Documentation](https://docs.npmjs.com/trusted-publishers)
- [NPM Publishing Documentation](https://docs.npmjs.com/packages-and-modules/publishing-packages)
- [NPM Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
