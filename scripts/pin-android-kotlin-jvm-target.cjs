const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, '..', 'android', 'build.gradle');
const kotlinCompileTask = 'org.jetbrains.kotlin.gradle.tasks.KotlinCompile';
const jvmTargetAssignment = "kotlinOptions.jvmTarget = '17'";

if (!fs.existsSync(buildGradlePath)) {
  console.error('android/build.gradle was not found. Run Capacitor sync first.');
  process.exit(1);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

if (content.includes(kotlinCompileTask) && content.includes(jvmTargetAssignment)) {
  console.log('Android Kotlin JVM target is already pinned to 17.');
  process.exit(0);
}

const block = `subprojects {
    tasks.withType(${kotlinCompileTask}).configureEach {
        ${jvmTargetAssignment}
    }
}

`;

const cleanTaskPattern = /\ntask clean\(type: Delete\) \{/;

if (cleanTaskPattern.test(content)) {
  content = content.replace(cleanTaskPattern, `\n${block}task clean(type: Delete) {`);
} else {
  content = `${content.trimEnd()}\n\n${block}`;
}

fs.writeFileSync(buildGradlePath, content, 'utf8');
console.log('Pinned Android Kotlin JVM target to 17.');
