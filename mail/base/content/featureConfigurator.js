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
 * The Original Code is the Thunderbird Feature Configurator.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Ascher <dascher@mozillamessaging.com>
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
const Cu = Components.utils;

Cu.import("resource:///modules/errUtils.js");
Cu.import("resource:///modules/iteratorUtils.jsm");

var gSubpageData = {};

var FeatureConfigurator = {
  subpages: ["introduction", "autosync", "toolbar", "compactheader",
             "folderpanecolumns"],

  previousButton: function fc_previousButton(e) {
    e.preventDefault();
    this.index -= 1;
  },

  nextButton: function fc_nextButton(e) {
    e.preventDefault();
    this.index += 1;
  },

  closeButton: function fc_closeButton(e) {
    e.preventDefault();
    window.close();
  },

  get index() {
    return this._index;
  },

  /**
   * Set the index of the subpage we want to show.
   *
   * @param aIndex the index of the subpage we want to show.
   */
  set index(aIndex) {
    this._index = aIndex;
    let url = "chrome://messenger/content/featureConfigurators/" +
              this.subpages[this._index] +
              ".xhtml";
    document.getElementById("contentFrame").setAttribute("src", url);
    let prevButton = document.getElementById("prevButton");
    prevButton.disabled = (this._index == 0);
    // The CSS also wants the disabled attribute set to true.
    if (this._index == 0)
      prevButton.setAttribute("disabled", "true");
    else
      prevButton.removeAttribute("disabled");
    let nextButton = document.getElementById("nextButton");
    nextButton.disabled = (this._index == this.subpages.length - 1);
    if (this._index == this.subpages.length - 1)
      nextButton.setAttribute("disabled", "true");
    else
      nextButton.removeAttribute("disabled");
  },

  /**
   * Initialize some data for our subpages and ourselves.
   *
   * @param aParentWin our parent's window.
   * @param aUpgrade true if we're upgrading from a previous version.
   */
  init: function fc_init(aParentWin, aUpgrade) {
    // XXX: This won't work if the 3pane is closed when we try to use
    // these.  It's too complicated to fix for beta 2, but we need to
    // revisit it for RC 1.
    gSubpageData.dom = aParentWin.document;
    let toolbar = aParentWin.document.getElementById("mail-bar3");
    gSubpageData.useSmartFolders =
      aParentWin.gFolderTreeView.mode == "smart";
    gSubpageData.isNewToolbar =
      toolbar.currentSet == toolbar.getAttribute("defaultset");
    gSubpageData.fakebar = aParentWin.document.getElementById("mail-bar2");
    gSubpageData.newbar = aParentWin.document.getElementById("mail-bar3");

    gSubpageData.syncSettings = {};
    this.index = 0;
    try {
      let servers = Cc["@mozilla.org/messenger/account-manager;1"]
                      .getService(Ci.nsIMsgAccountManager).allServers;

      // Look for imap servers.
      let anyImap = false;
      for each (let server in fixIterator(servers, Ci.nsIMsgIncomingServer)) {
        if (server.type != "imap")
          continue;
        anyImap = true;
        break;
      }
      // If there aren't any imap servers, don't show the autosync page.
      if (!anyImap)
        this.subpages = this.subpages.filter(function(item) item != "autosync");
    } catch (e) {
      logException(e);
    }

    // We used the compactHeader if we're upgrading, and the index was 0.
    gSubpageData.usedCompactHeader = aUpgrade &&
      aParentWin.document.getElementById("msgHeaderViewDeck").usedCompactHeader;
  }
}


/**
 * Set up some data for us, and for our subpages.
 */
function onLoad() {
  try {
    FeatureConfigurator.init(window.arguments[0], window.arguments[1]);
  } catch (e) {
    logException(e);
  }
}
