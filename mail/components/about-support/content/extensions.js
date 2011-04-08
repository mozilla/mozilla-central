/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is aboutSupport.xhtml.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Curtis Bartley <cbartley@mozilla.com>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
