/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// onload make sure we adapt what's needed for partial source
window.addEventListener("load", onLoadViewSourceOverlay, false);

function onLoadViewSourceOverlay() {
  if (/viewPartialSource\.xul$/.test(document.location)) {
    // disable menu items that don't work since the selection is munged and
    // the editor doesn't work for MathML
    document.getElementById('cmd_savePage').setAttribute('disabled', 'true');
    document.getElementById('cmd_editPage').setAttribute('disabled', 'true');
  }
}

// editPage() comes in from editorApplicationOverlay.js
function ViewSourceEditPage() {
  editPage(window.content.location.href);
}

// needed by findUtils.js
var gFindInstData;
function getFindInstData()
{
  if (!gFindInstData) {
    gFindInstData = new nsFindInstData();
    gFindInstData.browser = getBrowser();
    // defaults for rootSearchWindow and currentSearchWindow are fine here
  }
  return gFindInstData;
}
