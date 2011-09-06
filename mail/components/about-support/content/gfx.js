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

  function pushInfoRow(table, name, value)
  {
    if(value) {
      table.push(createParentElement("tr", [
        createHeader(bundle.GetStringFromName(name)),
        createElement("td", value),
      ]));
    }
  }

  function errorMessageForFeature(feature) {
    var errorMessage;
    var status;
    try {
      status = gfxInfo.getFeatureStatus(feature);
    } catch(e) {}
    switch (status) {
      case gfxInfo.FEATURE_BLOCKED_DEVICE:
      case gfxInfo.FEATURE_DISCOURAGED:
        errorMessage = bundle.GetStringFromName("blockedGfxCard");
        break;
      case gfxInfo.FEATURE_BLOCKED_OS_VERSION:
        errorMessage = bundle.GetStringFromName("blockedOSVersion");
        break;
      case gfxInfo.FEATURE_BLOCKED_DRIVER_VERSION:
        var suggestedDriverVersion;
        try {
          suggestedDriverVersion = gfxInfo.getFeatureSuggestedDriverVersion(feature);
        } catch(e) {}
        if (suggestedDriverVersion)
          errorMessage = bundle.formatStringFromName("tryNewerDriver", [suggestedDriverVersion], 1);
        else
          errorMessage = bundle.GetStringFromName("blockedDriver");
        break;
    }
    return errorMessage;
  }

  function pushFeatureInfoRow(table, name, feature, isEnabled, message) {
    message = message || isEnabled;
    if (!isEnabled) {
      var errorMessage = errorMessageForFeature(feature);
      if (errorMessage)
        message = errorMessage;
    }
    table.push(createParentElement("tr", [
      createHeader(bundle.GetStringFromName(name)),
      createElement("td", message),
    ]));
  }

  function hexValueToString(value)
  {
    return value
           ? String('0000' + value.toString(16)).slice(-4)
           : null;
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
    pushInfoRow(trGraphics, "adapterDescription", gfxInfo.adapterDescription);
    pushInfoRow(trGraphics, "adapterVendorID", hexValueToString(gfxInfo.adapterVendorID));
    pushInfoRow(trGraphics, "adapterDeviceID", hexValueToString(gfxInfo.adapterDeviceID));
    pushInfoRow(trGraphics, "adapterRAM", gfxInfo.adapterRAM);
    pushInfoRow(trGraphics, "adapterDrivers", gfxInfo.adapterDriver);
    pushInfoRow(trGraphics, "driverVersion", gfxInfo.adapterDriverVersion);
    pushInfoRow(trGraphics, "driverDate", gfxInfo.adapterDriverDate);

#ifdef XP_WIN
    pushInfoRow(trGraphics, "adapterDescription2", gfxInfo.adapterDescription2);
    pushInfoRow(trGraphics, "adapterVendorID2", hexValueToString(gfxInfo.adapterVendorID2));
    pushInfoRow(trGraphics, "adapterDeviceID2", hexValueToString(gfxInfo.adapterDeviceID2));
    pushInfoRow(trGraphics, "adapterRAM2", gfxInfo.adapterRAM2);
    pushInfoRow(trGraphics, "adapterDrivers2", gfxInfo.adapterDriver2);
    pushInfoRow(trGraphics, "driverVersion2", gfxInfo.adapterDriverVersion2);
    pushInfoRow(trGraphics, "driverDate2", gfxInfo.adapterDriverDate2);
    pushInfoRow(trGraphics, "isGPU2Active", gfxInfo.isGPU2Active);

    var version = Cc["@mozilla.org/system-info;1"]
                  .getService(Ci.nsIPropertyBag2)
                  .getProperty("version");
    var isWindowsVistaOrHigher = (parseFloat(version) >= 6.0);
    if (isWindowsVistaOrHigher) {
      var d2dEnabled = "false";
      try {
        d2dEnabled = gfxInfo.D2DEnabled;
      } catch(e) {}
      pushFeatureInfoRow(trGraphics, "direct2DEnabled", gfxInfo.FEATURE_DIRECT2D, d2dEnabled);

      var dwEnabled = "false";
      try {
        dwEnabled = gfxInfo.DWriteEnabled + " (" + gfxInfo.DWriteVersion + ")";
      } catch(e) {}
      pushInfoRow(trGraphics, "directWriteEnabled", dwEnabled);  

      var cleartypeParams = "";
      try {
        cleartypeParams = gfxInfo.cleartypeParameters;
      } catch(e) {
        cleartypeParams = bundle.GetStringFromName("clearTypeParametersNotFound");
      }
      pushInfoRow(trGraphics, "clearTypeParameters", cleartypeParams);  
    }

#endif

    var webglrenderer;
    var webglenabled;
    try {
      webglrenderer = gfxInfo.getWebGLParameter("full-renderer");
      webglenabled = true;
    } catch (e) {
      webglrenderer = false;
      webglenabled = false;
    }
#ifdef XP_WIN
    // If ANGLE is not available but OpenGL is, we want to report on the OpenGL feature, because that's what's going to get used.
    // In all other cases we want to report on the ANGLE feature.
    var webglfeature = gfxInfo.FEATURE_WEBGL_ANGLE;
    if (gfxInfo.getFeatureStatus(gfxInfo.FEATURE_WEBGL_ANGLE)  != gfxInfo.FEATURE_NO_INFO &&
        gfxInfo.getFeatureStatus(gfxInfo.FEATURE_WEBGL_OPENGL) == gfxInfo.FEATURE_NO_INFO)
      webglfeature = gfxInfo.FEATURE_WEBGL_OPENGL;
#else
    var webglfeature = gfxInfo.FEATURE_WEBGL_OPENGL;
#endif
    pushFeatureInfoRow(trGraphics, "webglRenderer", webglfeature, webglenabled, webglrenderer);

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
  if (acceleratedWindows) {
    msg += " " + mgrType;
  } else {
#ifdef XP_WIN
    var feature = gfxInfo.FEATURE_DIRECT3D_9_LAYERS;
#else
    var feature = gfxInfo.FEATURE_OPENGL_LAYERS;
#endif
    var errMsg = errorMessageForFeature(feature);
    if (errMsg)
      msg += ". " + errMsg;
  }

  appendChildren(graphics_tbody, [
    createParentElement("tr", [
      createHeader(bundle.GetStringFromName("acceleratedWindows")),
      createElement("td", msg),
    ])
  ]);
}
