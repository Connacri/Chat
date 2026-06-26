# Fix 'Unknown Kotlin JVM target: 21' Build Failure

The build failure is caused by a version mismatch between the Kotlin compiler and the JVM target. Specifically, the `@jonz94/capacitor-sim` plugin is defaulting to Kotlin 1.8.20, which does not support JVM target 21, while the project is configured (via Capacitor-generated files) to use Java 21.

## Proposed Changes

### Android Project Configuration

#### [build.gradle](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/android/build.gradle)
- Add `kotlin_version` to `ext` to ensure Capacitor plugins that look for this specific property name can pick up the correct version (1.9.24).

#### [gradle.properties](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/android/gradle.properties)
- Add `kotlin_version=1.9.24` as a project property for better compatibility with plugins.

#### [app/build.gradle](file:///C:/Users/gzers/AndroidStudioProjects/Chat2/android/app/build.gradle)
- Update `jvmToolchain` and `jvmTarget` to 21 to match the `compileOptions` being forced by Capacitor.

## Verification Plan

### Automated Tests
- I will attempt to run `./gradlew help` or a similar basic gradle task in the `android` directory to ensure that the configuration is valid and that the `:jonz94-capacitor-sim` module can be evaluated without the `jvmTarget` error.
- Command: `cd android && ./gradlew :jonz94-capacitor-sim:compileReleaseKotlin` (if possible to run in this environment).

### Manual Verification
- Verify that `android/app/capacitor.build.gradle` and `android/capacitor-cordova-android-plugins/build.gradle` both still point to `VERSION_21` and ensure all other modules are consistent.
