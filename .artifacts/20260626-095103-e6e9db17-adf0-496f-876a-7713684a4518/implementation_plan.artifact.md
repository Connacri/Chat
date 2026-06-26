# Workflow Optimization Plan

Optimize the GitHub workflows to ensure stable release builds without interference and restrict website updates to the repository root and GitHub Pages.

## User Review Required

- **Consolidation**: I will consolidate all "Release" logic into a single robust workflow and simplify `build-deploy.yml` to focus only on PR checks and standard pushes.
- **Trigger Logic**: `release.yml` will now be the primary source of truth for versions and releases.

## Proposed Changes

### GitHub Workflows

#### [build-deploy.yml](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/.github/workflows/build-deploy.yml)
- Remove GitHub Pages deployment (this will be handled by the release/main push logic).
- Keep only build checks to ensure code is valid.

#### [release.yml](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/.github/workflows/release.yml)
- Ensure it only runs on `main` or `master`.
- Add a step to deploy to GitHub Pages after a successful build.
- Ensure version bumping and tagging are robust.

---

### Verification Plan

- Check workflow syntax with `analyze_file`.
- Verify that no Firebase actions remain.
