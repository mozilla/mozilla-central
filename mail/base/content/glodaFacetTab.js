Components.utils.import("resource://app/modules/StringBundle.js");

Components.utils.import("resource://app/modules/gloda/facet.js");
// needed by search.xml to use us
Components.utils.import("resource://app/modules/gloda/msg_search.js");

var glodaFacetTabType = {
  name: "glodaFacet",
  perTabPanel: "iframe",
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
      aTab.panel.contentWindow.removeEventListener("load", xulLoadHandler,
                                                   false);
      aTab.panel.contentWindow.tab = aTab;
      aTab.browser = aTab.panel.contentDocument.getElementById("browser");
      aTab.browser.setAttribute("src",
        "chrome://messenger/content/glodaFacetView.xhtml");
    }

    aTab.panel.contentWindow.addEventListener("load", xulLoadHandler, false);
    aTab.panel.setAttribute("src",
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

