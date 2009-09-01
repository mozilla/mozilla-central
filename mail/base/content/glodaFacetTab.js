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
      aTab.title = aTab.glodaSearchInputValue = aTab.searchString =
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

/**
 * The glodaSearch tab mode has a UI widget outside of the mailTabType's
 *  display panel, the #glodaSearchInput textbox.  This means we need to use a
 *  tab monitor so that we can appropriately update the contents of the textbox.
 * Every time a tab is changed, we save the state of the text box and restore
 *  its previous value for the tab we are switching to, as well as whether this
 *  value is a change to the currently-used value (if it is a glodaSearch) tab.
 *  The behaviour rationale for this is that the glodaSearchInput is like the
 *  URL bar.  When you are on a glodaSearch tab, we need to show you your
 *  current value, including any "uncommitted" (you haven't hit enter yet)
 *  changes.  It's not entirely clear that imitating this behaviour on
 *  non-glodaSearch tabs makes a lot of sense, but it is consistent, so we do
 *  so.  The counter-example to this choice is the search box in firefox, but
 *  it never updates when you switch tabs, so it is arguably less of a fit.
 */
var glodaFacetTabMonitor = {
  onTabTitleChanged: function() {},
  onTabSwitched: function glodaFacetTabMonitor_onTabSwitch(aTab, aOldTab) {
    let inputNode = document.getElementById("glodaSearchInput");
    if (!inputNode)
      return;

    // save the current search field value
    if (aOldTab)
      aOldTab.glodaSearchInputValue = inputNode.value;
    // load (or clear if there is none) the persisted search field value
    inputNode.value = aTab.glodaSearchInputValue || "";

    // If the mode is glodaSearch and the search is unchanged, then we want to
    //  set the icon state of the input box to be the 'clear' icon.
    if (aTab.mode.name == "glodaFacet") {
      if (aTab.searchString == aTab.glodaSearchInputValue)
        inputNode._searchIcons.selectedIndex = 1;
    }
  }
};
