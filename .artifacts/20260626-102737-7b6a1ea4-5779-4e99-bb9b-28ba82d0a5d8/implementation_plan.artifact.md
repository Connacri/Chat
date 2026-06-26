# Implementation Plan - Global Safe Area and SIM Features

This plan outlines the changes needed to ensure all UI elements respect the Safe Area (especially on modern mobile devices) and to finalize the SIM-based automatic registration.

## User Review Required

- **Global Safe Area Implementation**: I will define CSS variables for safe area insets and apply them to the root container and specific components like headers, footers, and forms.
- **Form Panning**: Ensure forms are not obscured by the keyboard or screen cutouts by adding consistent padding.

## Proposed Changes

### Styling Refactor

#### [index.css](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/src/index.css)

- Add `:root` variables for `safe-area-top`, `safe-area-bottom`, `safe-area-left`, and `safe-area-right` using `env(safe-area-inset-*)`.
- Update `.app-container` to include horizontal safe area padding.
- Update `header` to use `var(--safe-area-top)`.
- Update navigation and chat input bars to use `var(--safe-area-bottom)`.

---

### UI Components Refactor

#### [App.jsx](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/src/App.jsx)

- **`Screen` Component**: Update to ensure internal padding respects safe areas and that content is scrollable if it exceeds the view.
- **`AppShell` Component**: Standardize the header and navigation padding using the new CSS variables.
- **`SIMSelectionScreen`**: Update layout to be within the safe area.
- **`ChatScreen`**: Ensure the message list and input bar correctly handle top/bottom safe areas.
- **`ProfileScreen` & `DiscoverScreen`**: Fix hero images and filter panels to respect safe areas.

## Verification Plan

### Manual Verification
1.  **Browser Emulation**: Use Chrome/Edge DevTools to emulate mobile devices with "Notch" or "Safe Area" (e.g., iPhone 12/13/14).
2.  **Visual Check**:
    - Verify that the title bar (Nexus P2P) is not cut off by the camera notch.
    - Verify that the bottom navigation bar and chat input are not covered by the home indicator or rounded corners.
    - Check all forms (Register, Login, Edit Profile, Create Group) to ensure they have consistent padding and are fully visible.
3.  **Scroll Check**: Ensure that content can be scrolled into view even when the keyboard is open (if possible to test in emulator).
