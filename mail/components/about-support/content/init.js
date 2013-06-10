/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/AddonManager.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/mailServices.js");

Components.utils.import("resource:///modules/aboutSupport.js");

/* Node classes. All of these are mutually exclusive. */

// Any nodes marked with this class will be considered part of the UI only,
// and therefore will not be copied.
const CLASS_DATA_UIONLY = "data-uionly";

// Any nodes marked with this class will be considered private and will be
// hidden if the user requests only public data to be shown or copied.
const CLASS_DATA_PRIVATE = "data-private";

// Any nodes marked with this class will only be displayed when the user chooses
// to not display private data.
const CLASS_DATA_PUBLIC = "data-public";

window.onload = function () {
  // Get the support URL.
  let supportUrl = Services.urlFormatter.formatURLPref("app.support.baseURL");

  // Update the application basics section.
  document.getElementById("application-box").textContent = Application.name;
  document.getElementById("version-box").textContent = Application.version;
  document.getElementById("useragent-box").textContent = navigator.userAgent;
  document.getElementById("supportLink").href = supportUrl;
  let currProfD = Services.dirsvc.get("ProfD", Ci.nsIFile);
  appendChildren(document.getElementById("profile-dir-box"),
    [createElement("a", currProfD.path,
      {"href": Services.io.newFileURI(currProfD).spec,
       "onclick": "openProfileDirectory(); event.preventDefault();"
      })]);

  let fsType;
  try {
    fsType = AboutSupport.getFileSystemType(currProfD);
  }
  catch (x) {
    Components.utils.reportError(x);
  }

  if (fsType) {
    let bundle = Services.strings.createBundle(
      "chrome://messenger/locale/aboutSupportMail.properties");
    let fsText = bundle.GetStringFromName("fsType." + fsType);
    document.getElementById("profile-fs-type-box").textContent = fsText;
  }

  document.getElementById("buildid-box").textContent = Services.appinfo.appBuildID;

  // Update the other sections.
  populateAccountsSection();
  populatePreferencesSection();
  populateExtensionsSection();
  populateGraphicsSection();
  populateJavaScriptSection();
  populateAccessibilitySection();
  populateLibVersionsSection();  
}

function onShowPrivateDataChange(aCheckbox) {
  document.getElementById("about-support-private").disabled = aCheckbox.checked;
}

function createParentElement(tagName, childElems) {
  let elem = document.createElement(tagName);
  appendChildren(elem, childElems);
  return elem;
}

function createElement(tagName, textContent, opt_attributes, opt_copyData) {
  if (opt_attributes == null)
    opt_attributes = [];
  let elem = document.createElement(tagName);
  elem.textContent = textContent;
  for each (let [key, value] in Iterator(opt_attributes))
    elem.setAttribute(key, "" + value);

  if (opt_copyData != null) {
    elem.dataset.copyData = opt_copyData;
  }

  return elem;
}

function appendChildren(parentElem, childNodes) {
  for (let i = 0; i < childNodes.length; i++)
    parentElem.appendChild(childNodes[i]);
}

function openProfileDirectory() {
  // Get the profile directory.
  let currProfD = Services.dirsvc.get("ProfD", Ci.nsIFile);
  let profileDir = currProfD.path;

  // Show the profile directory.
  let nsLocalFile = Components.Constructor("@mozilla.org/file/local;1",
                                           "nsILocalFile", "initWithPath");
  new nsLocalFile(profileDir).reveal();
}
