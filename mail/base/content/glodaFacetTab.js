/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/StringBundle.js");

Components.utils.import("resource:///modules/gloda/facet.js");
// needed by search.xml to use us
Components.utils.import("resource:///modules/gloda/msg_search.js");

var glodaFacetTabType = {
  name: "glodaFacet",
  perTabPanel: "vbox",
  strings:
    new StringBundle("chrome://messenger/locale/glodaFacetView.properties"),
  modes: {
    glodaFacet: {
      // this is what get exposed on the tab for icon purposes
      type: "glodaSearch"
    }
  },
  openTab: function glodaFacetTabType_openTab(aTab, aArgs) {
    // we have no browser until our XUL document loads
    aTab.browser = null;

    // First clone the page and set up the basics.
    let clone = document.getElementById("glodaTab")
                        .firstChild
                        .cloneNode(true);

    aTab.panel.appendChild(clone);
    aTab.iframe = aTab.panel.querySelector("iframe");

    // Wire up the search input icon click event
    let searchInput = aTab.panel.querySelector(".remote-gloda-search");
    let searchIcon = aTab.panel.querySelector(".gloda-search-icon");
    searchIcon.addEventListener("click", function(e) {
      searchInput.doSearch();
    });

    if ("query" in aArgs) {
      aTab.query = aArgs.query;
      aTab.collection = aTab.query.getCollection();

      aTab.title = this.strings.get("glodaFacetView.tab.query.label");
      aTab.searchString = null;
    }
    else if ("searcher" in aArgs) {
      aTab.searcher = aArgs.searcher;
      aTab.collection = aTab.searcher.getCollection();
      aTab.query = aTab.searcher.query;
      if ("IMSearcher" in aArgs) {
        aTab.IMSearcher = aArgs.IMSearcher;
        aTab.IMCollection = aArgs.IMSearcher.getCollection();
        aTab.IMQuery = aTab.IMSearcher.query;
      }

      let searchString = aTab.searcher.searchString;
      aTab.title = aTab.searchInputValue = aTab.searchString =
        searchString;
    }
    else if ("collection" in aArgs) {
      aTab.collection = aArgs.collection;

      aTab.title = this.strings.get("glodaFacetView.tab.query.label");
      aTab.searchString = null;
    }

    function xulLoadHandler() {
      aTab.iframe.contentWindow.removeEventListener("load", xulLoadHandler,
                                                    false);
      aTab.iframe.contentWindow.tab = aTab;
      aTab.browser = aTab.iframe.contentDocument.getElementById("browser");
      aTab.browser.setAttribute("src",
        "chrome://messenger/content/glodaFacetView.xhtml");
    }

    aTab.iframe.contentWindow.addEventListener("load", xulLoadHandler, false);
    aTab.iframe.setAttribute("src",
      "chrome://messenger/content/glodaFacetViewWrapper.xul");
  },
  closeTab: function glodaFacetTabType_closeTab(aTab) {
  },
  saveTabState: function glodaFacetTabType_saveTabState(aTab) {
    // nothing to do; we are not multiplexed
  },
  showTab: function glodaFacetTabType_showTab(aTab) {
    // nothing to do; we are not multiplexed
  },
  getBrowser: function(aTab) {
    return aTab.browser;
  }
};

