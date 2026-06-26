# Walkthrough - Automatic Registration and SIM Selection

I have implemented a more seamless onboarding experience for Nexus Chat, focusing on automatic registration via SIM detection and enhanced privacy through phone number masking.

## Changes

### Core Logic

- **Automatic Registration**: The app now attempts to automatically register the user on first launch by detecting their SIM card. This bypasses the manual registration form for a smoother experience.
- **SIM Selection**: If multiple SIM cards are detected, the user is presented with a selection screen to choose which number to use for their decentralized identity.
- **Phone Masking**: Added a utility to mask phone numbers, showing only the last 3 digits (e.g., `*******123`). This is used as the default pseudonym for users who haven't set a name.

### UI Enhancements

- **SIM Selection Screen**: A new screen for choosing between multiple detected SIMs.
- **Login Screen**: Added a dedicated "Entrer" button for a more intuitive login flow.
- **Privacy-First UI**: Updated all screens (Chat, Profile, Friends, Discover, Admin) to consistently use masked phone numbers instead of real names where applicable, ensuring user privacy by default.
- **Global Safe Area Support**: Refactored the entire UI to respect Safe Area insets (`env(safe-area-inset-*)`). This ensures that content is not cut off by notches, camera holes, or home indicators on modern mobile devices. All forms and screens now have consistent padding and are fully scrollable within the safe area.

## Verification Summary

### Manual Verification Results

1.  **Onboarding Flow**: Verified that a new user is either automatically registered (1 SIM) or prompted to choose (multiple SIMs).
2.  **Masking**: Confirmed that phone numbers are correctly masked across the entire application UI.
3.  **Login**: Verified the presence and functionality of the new "Entrer" button on the login screen.
4.  **Profile Completion**: Users can still update their profile later to set a real name if they choose, which will then replace the masked phone pseudo.
5.  **Safe Area Compliance**: Tested in browser mobile emulation to confirm that headers, footers, and forms respect top and bottom safe area insets. All content remains accessible and visible.

These changes align the app's behavior with the user's request for a "SIM-first" and "privacy-by-default" approach.
