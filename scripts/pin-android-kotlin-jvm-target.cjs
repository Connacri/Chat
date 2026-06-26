const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(__dirname, '..', 'android', 'build.gradle');
const marker = 'task.hasProperty(\'kotlinOptions\')';
const jvmTargetAssignment = "task.kotlinOptions.jvmTarget = '17'";

if (!fs.existsSync(buildGradlePath)) {
  console.error('android/build.gradle was not found. Run Capacitor sync first.');
  process.exit(1);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

const legacyBlocks = [
  /\ndef KotlinCompile = org\.jetbrains\.kotlin\.gradle\.tasks\.KotlinCompile\s+subprojects\s*\{\s*tasks\.withType\(KotlinCompile\)\.configureEach\s*\{\s*kotlinOptions\.jvmTarget = '17'\s*\}\s*\}\s*/g,
  /\nsubprojects\s*\{\s*tasks\.withType\(org\.jetbrains\.kotlin\.gradle\.tasks\.KotlinCompile\)\.configureEach\s*\{\s*kotlinOptions\.jvmTarget = '17'\s*\}\s*\}\s*/g,
];

for (const legacyBlock of legacyBlocks) {
  content = content.replace(legacyBlock, '\n');
}

if (content.includes(marker) && content.includes(jvmTargetAssignment)) {
  fs.writeFileSync(buildGradlePath, content, 'utf8');
  console.log('Android Kotlin JVM target is already pinned to 17.');
  process.exit(0);
}

const block = `subprojects {
    tasks.configureEach { task ->
        if (${marker}) {
            ${jvmTargetAssignment}
        }
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
