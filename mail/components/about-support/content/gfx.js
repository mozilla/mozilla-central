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

function populateGraphicsSection() {
  function createHeader(name)
  {
    let elem = createElement("th", name);
    elem.className = "column";
    return elem;
  }

  let bundle = Services.strings.createBundle("chrome://global/locale/aboutSupport.properties");
  let graphics_tbody = document.getElementById("graphics-tbody");

  var gfxInfo = null;
  try {
    // nsIGfxInfo is currently only implemented on Windows
    gfxInfo = Cc["@mozilla.org/gfx/info;1"].getService(Ci.nsIGfxInfo);
  } catch(e) {}

  if (gfxInfo) {
    let trGraphics = [];
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("adapterDescription")),
      createElement("td", gfxInfo.adapterDescription),
    ]));
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("adapterVendorID")),
      // pad with zeros. (printf would be nicer)
      createElement("td", String('0000'+gfxInfo.adapterVendorID.toString(16)).slice(-4)),
    ]));
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("adapterDeviceID")),
      // pad with zeros. (printf would be nicer)
      createElement("td", String('0000'+gfxInfo.adapterDeviceID.toString(16)).slice(-4)),
    ]));
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("adapterRAM")),
      createElement("td", gfxInfo.adapterRAM),
    ]));
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("adapterDrivers")),
      createElement("td", gfxInfo.adapterDriver),
    ]));
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("driverVersion")),
      createElement("td", gfxInfo.adapterDriverVersion),
    ]));
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("driverDate")),
      createElement("td", gfxInfo.adapterDriverDate),
    ]));

    var d2dEnabled = false;
    try {
      d2dEnabled = gfxInfo.D2DEnabled;
    } catch(e) {}
    var d2dMessage = d2dEnabled;
    if (!d2dEnabled) {
      var d2dStatus = -1; // different from any status value defined in the IDL
      try {
        d2dStatus = gfxInfo.getFeatureStatus(gfxInfo.FEATURE_DIRECT2D);
      } catch(e) {
        window.dump(e + '\n');
      }
      if (d2dStatus == gfxInfo.FEATURE_BLOCKED_DEVICE ||
          d2dStatus == gfxInfo.FEATURE_DISCOURAGED)
      {
        d2dMessage = bundle.GetStringFromName("blockedGraphicsCard");
      }
      else if (d2dStatus == gfxInfo.FEATURE_BLOCKED_DRIVER_VERSION)
      {
        var d2dSuggestedDriverVersion = null;
        try {
          d2dSuggestedDriverVersion = gfxInfo.getFeatureSuggestedDriverVersion(gfxInfo.FEATURE_DIRECT2D);
        } catch(e) {
          window.dump(e + '\n');
        }
        if (d2dSuggestedDriverVersion) {
          d2dMessage = bundle.GetStringFromName("tryNewerDriverVersion").replace("%1", d2dSuggestedDriverVersion);
        }
      }
    }
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("direct2DEnabled")),
      createElement("td", d2dMessage),
    ]));

    var dwEnabled = false;
    var dwriteEnabledStr = dwEnabled.toString();
    var dwriteVersion;
    try {
      dwEnabled = gfxInfo.DWriteEnabled;
      dwriteVersion = gfxInfo.DWriteVersion;
      dwriteEnabledStr = dwEnabled.toString() + " (" + dwriteVersion + ")";
    } catch(e) {}
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("directWriteEnabled")),
      createElement("td", dwriteEnabledStr),
    ]));

    var webglrenderer;
    try {
      webglrenderer = gfxInfo.getWebGLParameter("full-renderer");
    } catch (e) {
      webglrenderer = "(WebGL unavailable)";
    }
    trGraphics.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName("webglRenderer")),
      createElement("td", webglrenderer)
    ]));

    appendChildren(graphics_tbody, trGraphics);

    // display any failures that have occurred
    let graphics_failures_tbody = document.getElementById("graphics-failures-tbody");
    let trGraphicsFailures = gfxInfo.getFailures().map(function (value)
        createParentElement("tr", [
            createElement("td", value)
        ])
    );
    appendChildren(graphics_failures_tbody, trGraphicsFailures);

  } // end if (gfxInfo)

  let windows = Services.ww.getWindowEnumerator();
  let acceleratedWindows = 0;
  let totalWindows = 0;
  let mgrType;
  while (windows.hasMoreElements()) {
    totalWindows++;

    let awindow = windows.getNext().QueryInterface(Ci.nsIInterfaceRequestor);
    let windowutils = awindow.getInterface(Ci.nsIDOMWindowUtils);
    if (windowutils.layerManagerType != "Basic") {
      acceleratedWindows++;
      mgrType = windowutils.layerManagerType;
    }
  }

  let msg = acceleratedWindows + "/" + totalWindows;
  if (acceleratedWindows)
    msg += " " + mgrType;

  appendChildren(graphics_tbody, [
    createParentElement("tr", [
      createHeader(bundle.GetStringFromName("acceleratedWindows")),
      createElement("td", msg),
    ])
  ]);
}
