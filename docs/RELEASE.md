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

### 1. Set up NPM Token

1. **Create an NPM automation token:**

   - Go to https://www.npmjs.com/settings/alexanderfortin/tokens
   - Create a new token and copy the token value

2. **Add the token to GitHub Secrets:**

   - Go to your repository on GitHub
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `NPM_TOKEN`
   - Click **Add secret**
   - Value: (paste your NPM automation token)
   - Click **Add secret**

3. **Verify package.json configuration:**

   The package.json already includes `"publishConfig": { "access": "public" }`, which ensures the package is published as public when published to npm.

### 2. Enable OIDC for Package Signing (Optional but Recommended)

The workflow supports OIDC for package provenance (cryptographic signing). To enable this:

1. **Configure Trusted Publishing on npm:**

   - Go to your npm profile settings page
   - Look for "Publishing" or "Trusted Publishing" in the navigation
   - Click **Add a publisher**
   - Configure the trusted publisher with:
     - Package name: `@alexanderfortin/pi-zai-usage`
     - Organization: `alex/pi-zai-usage` (your GitHub org/repo)
     - Workflow: `release.yml`
     - Environment: (optional)

2. **GitHub Permissions:**

   The workflow requires the following permissions:

   - `contents: read` - To checkout the repository
   - `id-token: write` - Required for OIDC (package signing/provenance)

   These are already configured in the workflow file.

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

6. **Monitor the workflow:**

   - Go to the **Actions** tab on GitHub
   - Watch the **Release** workflow run
   - If successful, the package will be published to NPM

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
3. Check that the `NPM_TOKEN` secret is set correctly

### NPM Authentication Errors

**Error:** `ENEEDAUTH`, `401 Unauthorized`, or `EPUBLISH: E401`

**Solutions:**

1. Verify the `NPM_TOKEN` secret is set in GitHub repository settings
2. Ensure the token is an "Automation" type token (not "Read-only")
3. Check that the token has publish permissions for the `@alexanderfortin/pi-zai-usage` package
4. Ensure `package.json` includes `"publishConfig": { "access": "public" }` (this is already configured)

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

This workflow uses NPM's provenance feature, which:

- Signs packages cryptographically
- Links the package to the GitHub workflow that built it
- Provides users with confidence in package authenticity
- Is displayed on the NPM package page

To verify a package's provenance:

```bash
npm audit signatures
```

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

- [NPM Publishing Documentation](https://docs.npmjs.com/packages-and-modules/publishing-packages)
- [NPM Provenance Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
