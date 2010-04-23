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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Seth Spitzer <sspitzer@netscape.com>
 *   Scott MacGregor <mscott@mozilla.org>
 *   David Bienvenu <bienvenu@nventure.com>
 *   Andrew Sutherland <asutherland@asutherland.org>
 *   David Ascher <dascher@mozillamessaging.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

Components.utils.import("resource:///modules/StringBundle.js");

var gSearchBundle;

var gStatusBar = document.getElementById('statusbar-icon');

var gGlodaCompleteStrings = new StringBundle("chrome://messenger/locale/glodaComplete.properties");

/* see the constructor of searchbar in search.xml's constructor for details */
var gSearchInputObserversRegistered = false;

/**
 * The glodasearch widget is a UI widget (the #searchInput textbox) which is
 * outside of the mailTabType's display panel, but acts as though it were within
 * it..  This means we need to use a tab monitor so that we can appropriately
 * update the contents of the textbox.
 *
 * Every time a tab is changed, we save the state of the text box and restore
 *  its previous value for the tab we are switching to, as well as whether this
 *  value is a change to the currently-used value (if it is a faceted search) tab.
 *  The behaviour rationale for this is that the searchInput is like the
 *  URL bar.  When you are on a glodaSearch tab, we need to show you your
 *  current value, including any "uncommitted" (you haven't hit enter yet)
 *  changes.
 *
 *  In addition, we want to disable the quick-search modes when a tab is
 *  being displayed that lacks quick search abilities (but we'll leave the
 *  faceted search as it's always available).
 */

var GlodaSearchBoxTabMonitor = {
  monitorName: "glodaSearchBox",

  onTabTitleChanged: function() {
  },

  onTabOpened: function GSBTM_onTabOpened(aTab, aFirstTab, aOldTab) {
    aTab._ext.glodaSearchBox = {
      value: "",
    };
  },

  onTabSwitched: function (aTab, aOldTab) {
    let searchInput = document.getElementById("searchInput");
    if (!searchInput) // customized out of the way
      return;

    // save the current search field value
    if (aOldTab) {
      aOldTab._ext.glodaSearchBox.value = searchInput.value;
    }
    // Load (or clear if there is none) the persisted search field value
    // (We check first to avoid weird blank field / empty text transitions on
    // tab change.)
    let desiredValue = aTab._ext.glodaSearchBox.value || "";
    if (searchInput.value != desiredValue)
      searchInput.value = desiredValue;
  }
};

