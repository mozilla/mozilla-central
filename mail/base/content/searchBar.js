/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/StringBundle.js");

var gSearchBundle;

var gStatusBar = document.getElementById('statusbar-icon');

var gGlodaCompleteStrings = new StringBundle("chrome://messenger/locale/glodaComplete.properties");

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
      value: (aTab.mode.name === "glodaFacet") ? aTab.searchString : "",
    };

    if (aTab.mode.name === "glodaFacet") {
      let searchInput = aTab.panel
                            .querySelector(".remote-gloda-search");
      if (searchInput)
        searchInput.value = aTab.searchString;
    }
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

