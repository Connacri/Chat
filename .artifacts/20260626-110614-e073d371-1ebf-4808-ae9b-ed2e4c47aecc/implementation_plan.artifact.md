# Fix Kotlin JVM Target 21 Error

The Android build is failing because the Kotlin Gradle Plugin version (defaulting to 1.8.20) does not support the JVM target 21, which is being used in the environment. This plan updates the Kotlin version and ensures Java 21 compatibility across the project.

## Proposed Changes

### Android Configuration

#### [variables.gradle](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/android/variables.gradle)
- Add `kotlinVersion = '2.2.20'` to match the expected version for Capacitor 8+.

#### [build.gradle](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/android/build.gradle)
- Add Kotlin Gradle Plugin to the buildscript dependencies to ensure it's available with the correct version.

#### [app/build.gradle](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/android/app/build.gradle)
- Set `sourceCompatibility` and `targetCompatibility` to `JavaVersion.VERSION_21`.
- Set `kotlinOptions.jvmTarget = '21'`.

## Verification Plan

### Automated Tests
- Run the Android build command:
  ```powershell
  cd android
  ./gradlew assembleRelease --no-daemon
  ```
- Verify that the `:jonz94-capacitor-sim:compileReleaseKotlin` task completes successfully.

### Manual Verification
- Check the build logs to ensure no "Unknown Kotlin JVM target: 21" errors appear.
