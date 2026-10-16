const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("node:fs");
const path = require("node:path");
module.exports = function withLocalOnlyData(config) {
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    app.$["android:allowBackup"] = "false";
    app.$["android:fullBackupContent"] = "@xml/backup_rules";
    app.$["android:dataExtractionRules"] = "@xml/data_extraction_rules";
    return mod;
  });
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const directory = path.join(
        mod.modRequest.platformProjectRoot,
        "app/src/main/res/xml",
      );
      fs.mkdirSync(directory, { recursive: true });
      const excludes = ["root", "file", "database", "sharedpref", "external"]
        .map((domain) => `    <exclude domain="${domain}" path="." />`)
        .join("\n");
      fs.writeFileSync(
        path.join(directory, "backup_rules.xml"),
        `<?xml version="1.0" encoding="utf-8"?>\n<full-backup-content>\n${excludes}\n</full-backup-content>\n`,
      );
      fs.writeFileSync(
        path.join(directory, "data_extraction_rules.xml"),
        `<?xml version="1.0" encoding="utf-8"?>\n<data-extraction-rules>\n  <cloud-backup>\n${excludes}\n  </cloud-backup>\n  <device-transfer>\n${excludes}\n  </device-transfer>\n</data-extraction-rules>\n`,
      );
      return mod;
    },
  ]);
};
