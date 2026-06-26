# Workflow Update: Firebase Hosting Removal

I have updated the GitHub workflows to stop deploying the website to Firebase Hosting, while keeping the deployment of other Firebase services (Firestore rules, etc.).

## Changes Made

### GitHub Workflows

- **Modified [build-deploy.yml](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/.github/workflows/build-deploy.yml)**: Added a `deploy-firebase` job that deploys only `firestore`, `database`, `remoteconfig`, and `storage`. It uses the existing service account secret `FIREBASE_SERVICE_ACCOUNT_NEXUS_CHAT_A205E`.
- **Deleted `firebase-hosting-merge.yml`**: This workflow was dedicated to deploying to Firebase Hosting on every merge to main.
- **Deleted `firebase-hosting-pull-request.yml`**: This workflow was dedicated to creating Firebase Hosting previews for pull requests.

## Verification Summary

- **Static Analysis**: Ran `analyze_file` on [build-deploy.yml](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/.github/workflows/build-deploy.yml) and found no syntax errors.
- **File Cleanup**: Confirmed that the redundant `.yml` files have been removed from the `.github/workflows/` directory.

### Next Steps for User
- The next time you push to the `main` or `master` branch, the `deploy-firebase` job will run.
- Ensure that the secret `FIREBASE_SERVICE_ACCOUNT_NEXUS_CHAT_A205E` is still correctly configured in your GitHub repository secrets.
