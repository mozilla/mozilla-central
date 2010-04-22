/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Andrew Sutherland <asutherland@asutherland.org>
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

Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource:///modules/errUtils.js");

Components.utils.import("resource:///modules/searchSpec.js");

Components.utils.import("resource:///modules/quickFilterManager.js");


////////////////////////////////////////////////////////////////////////////////
//// Proper Code

/**
 * There is only one message filter bar widget; the muxer deals with tab
 *  changes and directing modifications to and reflecting the state of the
 *  actual filterer objects.
 */
let QuickFilterBarMuxer = {
  _init: function QFBM__init() {
    // -- folder display hookup
    FolderDisplayListenerManager.registerListener(this);

    // -- tab monitor hookup
    this.tabmail = document.getElementById("tabmail");
    this.tabmail.registerTabMonitor(this);
    // We may be registering after the first tab was opened, in which case
    //  we should generate a synthetic notification to ourselves.
    if (this.tabmail.currentTabInfo)
      this.onTabOpened(this.tabmail.currentTabInfo, true, null);

    // -- window hookups
    let dis = this;
    window.addEventListener("resize", function() {
                              dis.onWindowResize();
                            }, false);

    this._bindUI();
  },

  //////////////////////////////////////////////////////////////////////////////
  // FolderDisplayListener

  /**
   * Decide whether to display the filter bar toggle button whenever a folder
   *  display is made active.  makeActive is what triggers the display of
   *  account central so this is the perfect spot to do so.
   */
  onMakeActive: function QFBM_onMakeActive(aFolderDisplay) {
    let tab = aFolderDisplay._tabInfo;
    let appropriate = ("quickFilter" in tab._ext) &&
                        aFolderDisplay.displayedFolder &&
                        !aFolderDisplay.displayedFolder.isServer;
    document.getElementById("qfb-show-filter-bar").style.visibility =
      (appropriate ? "visible" : "hidden");
  },

  /**
   * Clear out our state when notified the user has changed folders and re-apply
   *  search constraints if we are in sticky mode.  It is important that we
   *  re-apply search constraints here in onLoadingFolder as this is the only
   *  notification we receive where we have a chance to avoid creating a view
   *  just to nuke it and re-create it with our new search constraints shortly
   *  afterwards.
   */
  onLoadingFolder: function QFBM_onFolderChanged(aFolderDisplay,
                                                 aIsOutbound) {
    let tab = aFolderDisplay._tabInfo;
    let filterer = ("quickFilter" in tab._ext) ? tab._ext.quickFilter : null;
    if (!filterer)
      return;

    // check if there actually was a change (notification might not be for us)
    if (tab.folderDisplay.displayedFolder != filterer.displayedFolder) {
      // perform state propagation to a new filter state
      tab._ext.quickFilter = filterer = new QuickFilterState(filterer);
      this.updateSearch();
      this.reflectFiltererState(filterer, tab.folderDisplay);
    }
  },

  /**
   * Once the view is fully populated:
   * - Invoke postFilterProcess on all filter definitions that expose such a
   *   method.  If they return a value, cram it in their state and (assuming
   *   this is the current tab), call their reflectInDOM method so they can
   *   update their state.
   * - Update UI to reflect some/no matches.
   */
  onActiveAllMessagesLoaded:
      function QFBM_onFolderDisplayAllMessagesLoaded(aFolderDisplay) {
    let filterer = this.maybeActiveFilterer;
    if (!filterer)
      return;

    let filtering = aFolderDisplay.view.search.userTerms != null;

    // - postFilterProcess everyone who cares
    // This may need to be converted into an asynchronous process at some point.
    for each (let [, filterDef] in Iterator(QuickFilterManager.filterDefs)) {
      if ("postFilterProcess" in filterDef) {
        let preState = (filterDef.name in filterer.filterValues) ?
          filterer.filterValues[filterDef.name] : null;
        let [newState, update, treatAsUserAction] =
          filterDef.postFilterProcess(preState, aFolderDisplay.view, filtering);
        filterer.setFilterValue(filterDef.name, newState, !treatAsUserAction);
        if (update) {
          if (aFolderDisplay._tabInfo == this.tabmail.currentTabInfo &&
              ("reflectInDOM" in filterDef)) {
            let domNode = document.getElementById(filterDef.domId);
            // We are passing update as a super-secret data propagation channel
            //  exclusively for one-off cases like the text filter gloda upsell.
            filterDef.reflectInDOM(domNode, newState, document, this, update);
          }
        }
      }
    }

    // - Update match status.
    this.reflectFiltererResults(filterer, aFolderDisplay);
  },

  /**
   * If we're searching, update the filter results.  (If we stop searching,
   *  we're going to end up in the onFolderDisplayAllMessagesLoaded
   *  notification.  Mayhaps we should lose that vector and just use this one.)
   */
  onSearching: function QFBM_onSearching(
      aFolderDisplay, aIsSearching) {
    // we only care if we just started searching and we are active
    if (!aIsSearching || !aFolderDisplay.active)
      return;

    // - Update match status.
    this.reflectFiltererResults(this.activeFilterer, aFolderDisplay);
  },


  //////////////////////////////////////////////////////////////////////////////
  // UI State Manipulation

  /**
   * Add appropriate event handlers to the DOM elements.  We do this rather
   *  than requiring lots of boilerplate "oncommand" junk on the nodes.
   *
   * We hook up the following:
   * - "command" event listener.
   * - reflect filter state
   */
  _bindUI: function QFBM__bindUI() {
    for each (let [, filterDef] in Iterator(QuickFilterManager.filterDefs)) {
      let domNode = document.getElementById(filterDef.domId);
      // the loop let binding does not latch, at least in 1.9.2
      let latchedFilterDef = filterDef;

      let handler;
      if (!("onCommand" in filterDef)) {
        handler = function(aEvent) {
          try {
            let postValue = domNode.checked ? true : null;
            QuickFilterBarMuxer.activeFilterer.setFilterValue(
              latchedFilterDef.name, postValue);
            QuickFilterBarMuxer.deferredUpdateSearch();
          }
          catch (ex) {
            logException(ex);
          }
        };
      }
      else {
        handler = function(aEvent) {
          let filterValues = QuickFilterBarMuxer.activeFilterer.filterValues;
          let preValue = (latchedFilterDef.name in filterValues) ?
                           filterValues[latchedFilterDef.name] : null;
          let [postValue, update] =
            latchedFilterDef.onCommand(preValue, domNode, aEvent, document);
          QuickFilterBarMuxer.activeFilterer.setFilterValue(
            latchedFilterDef.name, postValue, !update);
          if (update)
            QuickFilterBarMuxer.deferredUpdateSearch();
        };
      }
      domNode.addEventListener("command", handler, false);

      if ("domBindExtra" in filterDef)
        filterDef.domBindExtra(document, this, domNode);
    }
  },

  /**
   * Update the UI to reflect the state of the filterer constraints.
   *
   * @param aFilterer The active filterer.
   * @param aFolderDisplay The active FolderDisplayWidget.
   * @param [aFilterName] If only a single filter needs to be updated, name it.
   */
  reflectFiltererState: function QFBM_reflectFiltererState(aFilterer,
                                                           aFolderDisplay,
                                                           aFilterName) {
    // If we aren't visible then there is no need to update the widgets.
    if (aFilterer.visible) {
      let filterValues = aFilterer.filterValues;
      for each (let [, filterDef] in
                Iterator(QuickFilterManager.filterDefs)) {
        // If we only need to update one state, check and skip as appropriate.
        if (aFilterName && filterDef.name != aFilterName)
          continue;

        let domNode = document.getElementById(filterDef.domId);
        let value = (filterDef.name in filterValues) ?
          filterValues[filterDef.name] : null;
        if (!("reflectInDOM" in filterDef))
          domNode.checked = Boolean(value);
        else
          filterDef.reflectInDOM(domNode, value, document, this);
      }
    }

    this.reflectFiltererResults(aFilterer, aFolderDisplay);

    document.getElementById("quick-filter-bar").collapsed =
      !aFilterer.visible;
    document.getElementById("qfb-show-filter-bar").checked = aFilterer.visible;
  },

  /**
   * Update the UI to reflect the state of the folderDisplay in terms of
   *  filtering.  This is expected to be called by |reflectFiltererState| and
   *  when something happens event-wise in terms of search.
   *
   * We can have one of four states:
   * - No filter is active; no attributes exposed for CSS to do anything.
   * - A filter is active and we are still searching; filterActive=searching.
   * - A filter is active, completed searching, and we have results;
   *   filterActive=matches.
   * - A filter is active, completed searching, and we have no results;
   *   filterActive=nomatches.
   */
  reflectFiltererResults: function QFBM_reflectFiltererResults(aFilterer,
                                                               aFolderDisplay) {
    let view = aFolderDisplay.view;
    let threadPane = document.getElementById("threadTree");
    let qfb = document.getElementById("quick-filter-bar");

    // bail early if the view is in the process of being created
    if (!view.dbView)
      return;

    // no filter active
    if (!view.search || !view.search.userTerms) {
      threadPane.removeAttribute("filterActive");
      qfb.removeAttribute("filterActive");
    }
    // filter active, still searching
    else if (view.searching) {
      // Do not set this immediately; wait a bit and then only set this if we
      //  still are in this same state (and we are still the active tab...)
      setTimeout(function() {
        if (!view.searching ||
            (QuickFilterBarMuxer.maybeActiveFilterer != aFilterer))
          return;
        threadPane.setAttribute("filterActive", "searching");
        qfb.setAttribute("filterActive", "searching");
      }, 500);
    }
    // filter completed, results
    else if (view.dbView.numMsgsInView) {
      // some matches
      threadPane.setAttribute("filterActive", "matches");
      qfb.setAttribute("filterActive", "matches");
    }
    // filter completed, no results
    else {
      // no matches! :(
      threadPane.setAttribute("filterActive", "nomatches");
      qfb.setAttribute("filterActive", "nomatches");
    }
  },

  //////////////////////////////////////////////////////////////////////////////
  // Resizing regimen

  /**
   * Are the button labels currently collapsed?
   */
  _buttonLabelsCollapsed: false,

  /**
   * The minimum width the bar must be before we can un-collapse the button
   *  labels.
   */
  _minExpandedBarWidth: null,

  /**
   * Our general strategy is this:
   * - All collapsible buttons are set to not flex and live in the
   *   "quick-filter-bar-collapsible-buttons" hbox.  This provides us with a
   *   nice minimum size.
   * - All flexy widgets have some minimum size configured.
   * - When the bar starts to overflow we save off the (minimum) size of the bar
   *   so that once it gets large enough again we can restore the buttons.
   *
   * This method handles the overflow case where we transition to collapsed
   * buttons.  Our onWindowResize logic handles detecting when it is time to
   * un-collapse.
   */
  onOverflow: function QFBM_onOverflow() {
    // if we are already collapsed, there is nothing more to do.
    if (this._buttonLabelsCollapsed)
      return;

    let quickFilterBarBox =
      document.getElementById("quick-filter-bar-main-bar");
    let collapsibleButtonBox =
      document.getElementById("quick-filter-bar-collapsible-buttons");
    // the scroll width is the actual size it wants to be...
    this._minExpandedBarWidth = quickFilterBarBox.scrollWidth;
    this._buttonLabelsCollapsed = true;

    collapsibleButtonBox.setAttribute("shrink", "true");
  },

  /**
   * Counterpart to |onOverflow| un-collapses the buttons once the quick filter
   *  bar gets wide enough to support the desired minimum widget of the bar when
   *  the buttons are not collapsed.
   */
  onWindowResize: function QFB_onWindowResize() {
    // nothing to do here if the buttons are not collapsed
    if (!this._buttonLabelsCollapsed)
      return;

    let quickFilterBarBox =
      document.getElementById("quick-filter-bar-main-bar");
    // the client width is how big it actually is (thanks to overflow:hidden)
    if (quickFilterBarBox.clientWidth < this._minExpandedBarWidth)
      return;

    this._buttonLabelsCollapsed = false;
    this._minExpandedBarWidth = null;

    let collapsibleButtonBox =
      document.getElementById("quick-filter-bar-collapsible-buttons");
    collapsibleButtonBox.removeAttribute("shrink");
  },

  //////////////////////////////////////////////////////////////////////////////
  // Tab Monitor Interaction

  monitorName: "quickFilter",

  onTabTitleChanged: function QFBM_onTabTitleChanged(aTab) {
    // nop
  },

  /**
   * Whenever an appropriate new tab is opened, initialize its quick filter
   *  state.
   */
  onTabOpened: function QFBM_onTabOpened(aTab, aFirstTab, aOldTab) {
    if (aTab.mode.name == "folder" ||
        aTab.mode.name == "glodaList") {
      let modelTab =
        this.tabmail.getTabInfoForCurrentOrFirstModeInstance(aTab.mode);
      let oldFilterer = (modelTab && ("quickFilter" in modelTab._ext)) ?
                          modelTab._ext.quickFilter : undefined;
      aTab._ext.quickFilter = new QuickFilterState(oldFilterer);
      this.updateSearch(aTab);
    }
  },

  onTabRestored: function QFBM_onTabRestored(aTab, aState, aFirstTab) {
    let filterer = aTab._ext.quickFilter = new QuickFilterState(null, aState);
    this.updateSearch(aTab);
    if (aTab == this.tabmail.currentTabInfo)
      this.reflectFiltererState(filterer, aTab.folderDisplay);
  },

  onTabPersist: function QFBM_onTabPersist(aTab) {
    let filterer = ("quickFilter" in aTab._ext) ? aTab._ext.quickFilter : null;
    if (filterer)
      return filterer.persistToObj();
    return null;
  },

  /**
   * On tab switch we need to:
   * - Restore state for already existing state
   * - Create state if it's a new (to us) tab
   */
  onTabSwitched: function QFBM_onTabSwitched(aTab, aOldTab) {
    // (Note: we used to explicitly handle the possibility that the user had
    // typed something but an ontimeout had not yet fired in the textbox.
    // We are bailing on that because it adds complexity without much functional
    // gain.  Our UI will be consistent when we switch back to the tab, which
    // is good enough.)

    let filterer = this.maybeActiveFilterer;
    if (filterer)
      this.reflectFiltererState(filterer, aTab.folderDisplay);
    else // this only happens for tabs we are not legal on
      document.getElementById("qfb-show-filter-bar").style.visibility = "hidden";
  },

  supportsCommand: function QFBM_supportsCommand(aCommand, aTab) {
    // we are not active on tab types we do not support (message tabs)
    if (!("quickFilter" in aTab._ext))
      return null;

    if (aCommand == "cmd_stop" || aCommand == "cmd_find" ||
        aCommand == "cmd_toggleQuickFilterBar")
      return true;
    else
      return null;
  },
  isCommandEnabled: function QFBM_isCommandEnabled(aCommand, aTab) {
    // we are not active on tab types we do not support (message tabs)
    if (!("quickFilter" in aTab._ext))
      return null;

    if (aCommand == "cmd_stop" || aCommand == "cmd_find" ||
        aCommand == "cmd_toggleQuickFilterBar")
      return true;
    else
      return null;
  },
  doCommand: function QFBM_doCommand(aCommand, aTab) {
    // we are not active on tab types we do not support (message tabs)
    if (!("quickFilter" in aTab._ext))
      return null;

    if (aCommand == "cmd_stop") {
      QuickFilterBarMuxer.cmdEscapeFilterStack();
      return true;
    }
    else if (aCommand == "cmd_find") {
      let textWidget = document.getElementById(
                         QuickFilterManager.textBoxDomId);
      // if it's not already focused, then focus/select it
      if (document.commandDispatcher.focusedElement != textWidget.inputField) {
        QuickFilterBarMuxer._showFilterBar(true);
        textWidget.select();
        return true;
      }
    }
    else if (aCommand == "cmd_toggleQuickFilterBar") {
      this._showFilterBar(!this.activeFilterer.visible);
      return true;
    }
    return null;
  },

  get maybeActiveFilterer() {
    if ("quickFilter" in this.tabmail.currentTabInfo._ext)
      return this.tabmail.currentTabInfo._ext.quickFilter;
    return null;
  },

  get activeFilterer() {
    if ("quickFilter" in this.tabmail.currentTabInfo._ext)
      return this.tabmail.currentTabInfo._ext.quickFilter;
    throw errorWithDebug("There is no active filterer but we want one.");
  },

  //////////////////////////////////////////////////////////////////////////////
  // Event Handling Support

  /**
   * Retrieve the current filter state value (presumably an object) for mutation
   *  purposes.  This causes the filter to be the last touched filter for escape
   *  undo-ish purposes.
   */
  getFilterValueForMutation: function QFBM_getFilterValueForMutation(aName) {
    return this.activeFilterer.getFilterValue(aName);
  },

  /**
   * Set the filter state for the given named filter to the given value.  This
   *  causes the filter to be the last touched filter for escape undo-ish
   *  purposes.
   *
   * @param aName Filter name.
   * @param aValue The new filter state.
   */
  setFilterValue: function QFBM_setFilterValue(aName, aValue) {
    this.activeFilterer.setFilterValue(aName, aValue);
  },

  /**
   * For UI responsiveness purposes, defer the actual initiation of the search
   *  until after the button click handling has completed and had the ability
   *  to paint such.
   */
  deferredUpdateSearch: function QFBM_deferredUpdateSearch() {
    setTimeout(this._deferredInvocUpdateSearch, 10);
  },

  /**
   * The actual helper function to call updateSearch for deferredUpdateSearch
   *  that makes 'this' relevant.
   */
  _deferredInvocUpdateSearch: function QFBM__deferredInvocUpdateSearch() {
    QuickFilterBarMuxer.updateSearch();
  },

  /**
   * Update the user terms part of the search definition to reflect the active
   *  filterer's current state.
   */
  updateSearch: function QFBM_updateSearch(aTab) {
    let tab = aTab || this.tabmail.currentTabInfo;
    // bail if things don't really exist yet
    if (!tab.folderDisplay.view.search)
      return;

    let filterer = tab._ext.quickFilter;
    filterer.displayedFolder = tab.folderDisplay.displayedFolder;

    let [terms, listeners] =
      filterer.createSearchTerms(tab.folderDisplay.view.search.session);

    for each (let [, [listener, filterDef]] in Iterator(listeners)) {
      // it registers itself with the search session.
      new QuickFilterSearchListener(
        tab.folderDisplay, filterer, filterDef,
        listener, QuickFilterBarMuxer);
    }
    tab.folderDisplay.view.search.userTerms = terms;
    // Uncomment to know what the search state is when we (try and) update it.
    //dump(tab.folderDisplay.view.search.prettyString());
  },

  _showFilterBar: function QFBM__showFilterBar(aShow) {
    this.activeFilterer.visible = aShow;
    if (!aShow) {
      this.activeFilterer.clear();
      this.updateSearch();
    }
    this.reflectFiltererState(this.activeFilterer,
                              this.tabmail.currentTabInfo.folderDisplay);
  },

  /**
   * Invoked when the user chooses the popup from the gloda search box.
   */
  cmdGlodaSearchDownSell: function QFBM_cmdGlodaSearchDownSell(aEvent) {
    aEvent.stopPropagation();
    this._showFilterBar(true);
    let textWidget = document.getElementById(
                       QuickFilterManager.textBoxDomId);
    textWidget.select();
  },

  /**
   * User explicitly closed the filter bar.
   */
  cmdClose: function QFBM_cmdClose(aEvent) {
    this._showFilterBar(false);
  },

  /**
   * User hit the escape key; do our undo-ish thing keeping in mind that this
   *  may be invoked in situations where the filter bar is not legal / enabled.
   */
  cmdEscapeFilterStack: function QFBM_cmdEscapeFilterStack() {
    let filterer = this.maybeActiveFilterer;
    if (!filterer || !filterer.visible)
      return;

    // update the search if we were relaxing something
    if (filterer.userHitEscape()) {
      this.updateSearch();
      this.reflectFiltererState(filterer,
                                this.tabmail.currentTabInfo.folderDisplay);
    }
    // close the filter since there was nothing left to relax
    else {
      this.cmdClose();
    }
  },

  _testHelperResetFilterState: function QFBM_resetFilterState() {
    let filterer = this.maybeActiveFilterer;
    if (!filterer)
      return;
    let tab = this.tabmail.currentTabInfo;
    tab._ext.quickFilter = filterer = new QuickFilterState();
    this.updateSearch();
    this.reflectFiltererState(filterer, tab.folderDisplay);
  },
};
addEventListener("load", function() QuickFilterBarMuxer._init(), false);
