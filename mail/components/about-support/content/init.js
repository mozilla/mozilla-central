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
}

function userDataHandler(aOp, aKey, aData, aSrc, aDest) {
  if (aOp == UserDataHandler.NODE_CLONED || aOp == UserDataHandler.NODE_IMPORTED)
    aDest.setUserData(aKey, aData, userDataHandler);
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
    // Look for the (only) text node.
    let textNode = elem.firstChild;
    while (textNode && textNode.nodeType != Node.TEXT_NODE)
      textNode = textNode.nextSibling;
    // XXX warn here if textNode not found
    if (textNode)
      textNode.setUserData("copyData", opt_copyData, userDataHandler);
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
