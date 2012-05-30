/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A list of extensions. This is assigned to by
 * populateExtensionsSection. There's a potential race condition here, but it's
 * not really going to happen in practice.
 */
var gExtensions;

/**
 * A list of fields for each extension.
 */
var gExtensionDetails = ["name", "version", "isActive", "id"];

function populateExtensionsSection() {
  AddonManager.getAddonsByTypes(["extension"], function (extensions) {
    extensions.sort(function(a,b) {
      if (a.isActive != b.isActive)
        return b.isActive ? 1 : -1;
      let lc = a.name.localeCompare(b.name);
      if (lc != 0)
        return lc;
      if (a.version != b.version)
        return a.version > b.version ? 1 : -1;
      return 0;
    });

    gExtensions = extensions;
    let trExtensions = [];
    for (let i = 0; i < extensions.length; i++) {
      let extension = extensions[i];
      let extensionTDs = [createElement("td", extension[prop])
                          for ([, prop] in Iterator(gExtensionDetails))];
      let tr = createParentElement("tr", extensionTDs);
      trExtensions.push(tr);
    }
    appendChildren(document.getElementById("extensions-tbody"), trExtensions);
  });
}

/**
 * Returns a plaintext representation of extension data.
 */
function getExtensionsText(aHidePrivateData, aIndent) {
  let extensionData = [aIndent +
                       [extension[prop]
                        for ([, prop] in Iterator(gExtensionDetails))].join(", ")
                       for ([, extension] in Iterator(gExtensions))];
  return extensionData.join("\n");
}
