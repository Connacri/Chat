# Implementation Plan - Automatic Registration and SIM Selection

This plan outlines the changes needed to automate the onboarding process for Nexus Chat by detecting the user's phone number(s) from their SIM card(s) and performing automatic registration.

## User Review Required

- **SIM Detection Accuracy**: The current "SIM detection" is a deterministic simulation based on a hardware ID. Real SIM detection on Android requires native Capacitor plugins and specific permissions. I will enhance the simulation to support multiple "SIMs" and provide a choice if multiple are found.
- **Masking Logic**: I will implement masking showing only the last 3 digits of the phone number (e.g., `*******123`).
- **Profile Completion**: Registration will be automatic with minimal info. Users can complete their profile (name, bio, etc.) later from the Settings/Profile screen.

## Proposed Changes

### Core Logic & Utilities

#### [App.jsx](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/src/App.jsx)

- **New View**: `SIM_SELECT` added to `VIEWS`.
- **Enhanced SIM Detection**: Update `getDetectedPhoneNumber` to return an array of simulated phone numbers if needed, or refine the deterministic generation.
- **Auto-Registration Function**: Implement `autoRegister(phone)` which creates an identity and a basic user profile (masked phone as name).
- **Boot Flow Update**: In the initial `useEffect`, if no user is found, trigger SIM detection.
    - If 1 SIM is found: Auto-register and go to `HOME`.
    - If >1 SIM is found: Show `SIM_SELECT` screen.
- **Masking Utility**: Add `maskPhone(phone)` to hide all but the last 3 digits.
- **Login Screen Update**: Add a clear "Entrer" button to the login form.

---

### UI Components

#### [SIMSelectionScreen (NEW)]

- A new screen to allow users to choose between detected SIMs.
- Shown only if multiple SIMs are detected on boot.

#### [Profile/Chat components]

- Update display logic to show the masked phone number if the user hasn't set a custom name.

## Verification Plan

### Automated Tests
- I will verify the logic by running the application and checking the boot flow.
- Since I don't have a real Android device with multiple SIMs, I will simulate multiple SIMs by modifying the `nodeId` or `getDetectedPhoneNumber` function during testing.

### Manual Verification
1.  **Fresh Install Simulation**: Clear IndexedDB/Local Storage and reload.
2.  **Single SIM Flow**: Verify that the app automatically registers and opens the `HOME` screen with a masked phone number as name.
3.  **Multiple SIM Flow**: Manually trigger the multiple SIM condition and verify the selection screen appears.
4.  **Login Screen**: Verify the new "Entrer" button is present and functional.
5.  **Masking**: Check that other users (simulated or real) see the masked phone number if no name is set.
