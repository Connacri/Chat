# Stop Uploading Website to Firebase Hosting

The goal is to modify the GitHub Workflows to stop deploying the website (the `dist` folder) to Firebase Hosting, while maintaining the deployment of other Firebase services like Firestore rules, Realtime Database rules, and Remote Config.

## User Review Required

- **Clarification**: Does "seulement firebase" mean you want to deploy only the rules and configurations (Firestore, Database, etc.) and not the website?
- **Workflow Consolidation**: I propose consolidating the Firebase deployment into the main `build-deploy.yml` and removing the auto-generated `firebase-hosting-*.yml` files. Is this acceptable?

## Proposed Changes

### GitHub Workflows

#### [DELETE] [firebase-hosting-merge.yml](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/.github/workflows/firebase-hosting-merge.yml)
- This workflow is redundant as it only handles Hosting deployment.

#### [DELETE] [firebase-hosting-pull-request.yml](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/.github/workflows/firebase-hosting-pull-request.yml)
- This workflow is used for Hosting previews, which are no longer needed.

#### [build-deploy.yml](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/.github/workflows/build-deploy.yml)
- Add a new job `deploy-firebase` that deploys Firebase rules and configurations using `firebase-tools`.
- Use `--except hosting` to ensure the website is not uploaded.

```yaml
  # ─── Job 4 : Deploy Firebase (Rules, Config, etc.) ──────────────────────
  deploy-firebase:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && (github.ref == 'refs/heads/main' || github.ref == 'refs/heads/master')
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --except hosting
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
          # OR use Service Account if preferred
          # FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT_NEXUS_CHAT_A205E }}
```

---

### Firebase Configuration

#### [firebase.json](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/firebase.json)
- Keep the `hosting` configuration for local development/testing, but it will be ignored by the GitHub Action due to the `--except hosting` flag.

## Verification Plan

### Automated Tests
- I will run `analyze_file` on the modified `build-deploy.yml` to check for syntax errors.

### Manual Verification
- The user should verify that the next push to `main` triggers the `deploy-firebase` job but does NOT update the Firebase Hosting site.
- Check that Firestore rules are correctly updated on the Firebase Console after a push.
