const { readFileSync } = require('fs');
const { execSync } = require('child_process');
const packageInfo = require("../package.json");

if (packageInfo) {
    const version = packageInfo.version;
    const packageName = packageInfo.name;
    console.log('packageName', packageName, 'version', version);
    execSync(`code --install-extension ${packageName}-${version}.vsix`);
}
else {
    throw "no package found";
}