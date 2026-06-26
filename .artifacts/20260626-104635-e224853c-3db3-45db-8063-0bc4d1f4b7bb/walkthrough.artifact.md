# Walkthrough - Real SIM Detection and Registration Fixes

I have implemented real SIM card detection and fixed the UI issues on the registration screen.

## Changes Made

### 1. Real SIM Detection
- **Plugin Integrated**: Replaced simulation with `@jonz94/capacitor-sim@2.0.0` (compatible with Capacitor 5).
- **Native Permissions**: Added `READ_PHONE_STATE` and `READ_PHONE_NUMBERS` to `AndroidManifest.xml`.
- **Async Logic**: Implemented `getRealSimNumbers` in `App.jsx` to fetch actual phone numbers from the device's SIM cards.
- **Zero Fake Policy**: Removed all "fake" number generation. If no SIM is detected, the app prompts for manual entry instead of inventing numbers.

### 2. Registration Screen UI Fixes
- **Button Visibility**: Changed `minHeight: 100vh` to `height: 100vh` and increased bottom padding to `100px` to ensure the "Register" button is never hidden by safe areas or system navigation bars.
- **Scroll by Tap**: Added a "Scroll to bottom" helper link in the `RegisterScreen` that smooth-scrolls the view directly to the submit button.
- **Smooth Scrolling**: Enabled `WebkitOverflowScrolling: touch` for a native-like feel on mobile.

### 3. Build & CI Fix
- **Dependency Resolution**: Resolved the `ERESOLVE` conflict in CI by choosing a version of the SIM plugin that matches the project's Capacitor 5 environment.

## Verification Summary
- **Build Success**: The project builds successfully with `npm run build`.
- **Capacitor Sync**: `npx cap sync android` correctly identifies and links the `@jonz94/capacitor-sim` plugin.
- **Static Analysis**: Verified that all references to the old simulation logic have been removed.
