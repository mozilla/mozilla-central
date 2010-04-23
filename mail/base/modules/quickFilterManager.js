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
 * The Original Code is Thunderbird Email Client.
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

const EXPORTED_SYMBOLS = ["QuickFilterState", "QuickFilterManager",
                          "MessageTextFilter", "QuickFilterSearchListener"];
const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://gre/modules/PluralForm.jsm");

Cu.import("resource:///modules/searchSpec.js");
Cu.import("resource:///modules/iteratorUtils.jsm");
Cu.import("resource:///modules/errUtils.js");

const Application = Cc["@mozilla.org/steel/application;1"]
                      .getService(Ci.steelIApplication);

const FocusManager = Cc["@mozilla.org/focus-manager;1"]
                       .getService(Ci.nsIFocusManager);

const nsMsgSearchAttrib = Components.interfaces.nsMsgSearchAttrib;
const nsMsgMessageFlags = Components.interfaces.nsMsgMessageFlags;
const nsMsgSearchOp = Components.interfaces.nsMsgSearchOp;

// XXX we need to know whether the gloda indexer is enabled for upsell reasons,
// but this should really just be exposed on the main Gloda public interface.
Cu.import("resource://app/modules/gloda/indexer.js");
// we need to be able to create gloda message searcher instances for upsells:
Cu.import("resource://app/modules/gloda/msg_search.js");


/**
 * Shallow object copy.
 */
function shallowObjCopy(obj) {
  let newObj = {};
  for each (let [key, value] in Iterator(obj)) {
    newObj[key] = value;
  }
  return newObj;
}

/**
 * Should the filter be visible when there's no previous state to propagate it
 *  from?  The idea is that when session persistence is working this should only
 *  ever affect the first time Thunderbird is started up.  Although opening
 *  additional 3-panes will likely trigger this unless we go out of our way to
 *  implement propagation across those boundaries (and we're not).
 */
const FILTER_VISIBILITY_DEFAULT = true;

/**
 * Represents the state of a quick filter bar.  This mainly decorates the
 *  manipulation of the filter states with support of tracking the filter most
 *  recently manipulated so we can maintain a very limited undo stack of sorts.
 */
function QuickFilterState(aTemplateState, aJsonedState) {
  if (aJsonedState) {
    this.filterValues = aJsonedState.filterValues;
    this.visible = aJsonedState.visible;
  }
  else if (aTemplateState) {
    this.filterValues = QuickFilterManager.propagateValues(
                          aTemplateState.filterValues);
    this.visible = aTemplateState.visible;
  }
  else {
    this.filterValues = QuickFilterManager.getDefaultValues();
    this.visible = FILTER_VISIBILITY_DEFAULT;
  }
  this._lastFilterAttr = null;
}
QuickFilterState.prototype = {
  /**
   * Maps filter names to their current states.  We rely on QuickFilterManager
   *  to do most of the interesting manipulation of this value.
   */
  filterValues: null,
  /**
   * Is the filter bar visible?  Always inherited from the template regardless
   *  of stickyness.
   */
  visible: null,

  /**
   * Get a filter state and update lastFilterAttr appropriately.  This is
   *  intended for use when the filter state is a rich object whose state
   *  cannot be updated just by clobbering as provided by |setFilterValue|.
   *
   * @param aName The name of the filter we are retrieving.
   * @param [aNoChange=false] Is this actually a change for the purposes of
   *     lastFilterAttr purposes?
   */
  getFilterValue: function MFS_getFilterValue(aName, aNoChange) {
    if (!aNoChange)
      this._lastFilterAttr = aName;
    return this.filterValues[aName];
  },

  /**
   * Set a filter state and update lastFilterAttr appropriately.
   *
   * @param aName The name of the filter we are setting.
   * @param aValue The value to set; null/undefined implies deletion.
   * @param [aNoChange=false] Is this actually a change for the purposes of
   *     lastFilterAttr purposes?
   */
  setFilterValue: function MFS_setFilterValue(aName, aValue, aNoChange) {
    if (aValue == null) {
      delete this.filterValues[aName];
      return;
    }

    this.filterValues[aName] = aValue;
    if (!aNoChange)
      this._lastFilterAttr = aName;
  },

  /**
   * Track the last filter that was affirmatively applied.  If you hit escape
   *  and this value is non-null, we clear the referenced filter constraint.
   *  If you hit escape and the value is null, we clear all filters.
   */
  _lastFilterAttr: null,

  /**
   * The user hit escape; based on _lastFilterAttr and whether there are any
   *  applied filters, change our constraints.  First press clears the last
   *  added constraint (if any), second press (or if no last constraint) clears
   *  the state entirely.
   *
   * @return true if we relaxed the state, false if there was nothing to relax.
   */
  userHitEscape: function MFS_userHitEscape() {
    if (this._lastFilterAttr) {
      QuickFilterManager.clearFilterValue(this._lastFilterAttr,
                                            this.filterValues);
      this._lastFilterAttr = null;
      return true;
    }

    return QuickFilterManager.clearAllFilterValues(this.filterValues);
  },

  /**
   * Clear the state without going through any undo-ish steps like
   *  |userHitEscape| tries to do.
   */
  clear: function MFS_clear() {
    QuickFilterManager.clearAllFilterValues(this.filterValues);
  },

  /**
   * Create the search terms appropriate to the current filter states.
   */
  createSearchTerms: function MFS_createSearchTerms(aTermCreator) {
    return QuickFilterManager.createSearchTerms(this.filterValues,
                                                aTermCreator);
  },

  persistToObj: function MFS_persistToObj() {
    return {
      filterValues: this.filterValues,
      visible: this.visible,
    };
  },
};

/**
 * An nsIMsgSearchNotify listener wrapper to facilitate faceting of messages
 *  being returned by a search.  We have to use a listener because the
 *  nsMsgDBView includes presentation logic and unless we force all of its
 *  results to be fully expanded (and dummy headers ignored), we can't get
 *  at all the messages reliably.
 *
 * We need to provide a wrapper so that:
 * - We can provide better error handling support.
 * - We can provide better GC support.
 * - We can ensure the right life-cycle stuff happens (unregister ourselves as
 *   a listener, namely.)
 *
 * It is nice that we have a wrapper so that:
 * - We can provide context to the thing we are calling that it does not need
 *  to maintain.
 *
 * The listener should implement the following methods:
 *
 * - function onSearchStart(aCurState) returning aScratch.
 *   This function should initialize the scratch object that will be passed to
 *    onSearchMessage and onSearchDone.  This is an attempt to provide a
 *    friendly API that provides debugging support by dumping the state of
 *    said object when things go wrong.
 *
 * - function onSearchMessage(aScratch, aMsgHdr, aFolder)
 *   Processes messages reported as search hits.  Its only context is the
 *    object you returned from onSearchStart.  Take the hint and try and keep
 *    this method efficient!  We will catch all exceptions for you and report
 *    errors.  We will also handle forcing GCs as appropriate.
 *
 * - function onSearchDone(aCurState, aScratch, aSuccess) returning
 *    [new state for your filter, should call reflectInDOM, should treat the
 *     state as if it is a result of user action].
 *   This ends up looking exactly the same as the postFilterProcess handler
 *
 * @param aFolderDisplay The folder display we are working in service of.
 * @param aFilterer The QuickFilterState instance.
 * @param aListener The thing on which we invoke methods.
 */
function QuickFilterSearchListener(aFolderDisplay, aFilterer, aFilterDef,
                                   aListener, aMuxer) {
  this.folderDisplay = aFolderDisplay;
  this.filterer = aFilterer;
  this.filterDef = aFilterDef;
  this.listener = aListener;
  this.muxer = aMuxer;
  this.folderDisplay = aFolderDisplay;

  this.session = aFolderDisplay.view.search.session;

  this.scratch = null;
  this.count = 0;
  this.started = false;

  this.session.registerListener(this,
                                Ci.nsIMsgSearchSession.allNotifications);
}
QuickFilterSearchListener.prototype = {
  onNewSearch: function QuickFilterSearchListener_onNewSearch() {
    this.started = true;
    let curState = (this.filterDef.name in this.filterer.filterValues) ?
                     this.filterer.filterValues[this.filterDef.name] : null;
    this.scratch = this.listener.onSearchStart(curState);
  },

  onSearchHit: function QuickFilterSearchListener_onSearchHit(aMsgHdr,
                                                              aFolder) {
    // GC sanity demands that we trigger a GC if we have seen a large number
    //  of headers.  Because we are driven by the search mechanism which likes
    //  to time-slice when it has a lot of messages on its plate, it is
    //  conceivable something else may trigger a GC for us.  Unfortunately,
    //  we can't guarantee it, as XPConnect does not inform memory pressure,
    //  so it's us to stop-gap it.
    this.count++;
    if (!(this.count % 4096))
      Cu.forceGC();

    try {
      this.listener.onSearchMessage(this.scratch, aMsgHdr, aFolder);
    }
    catch (ex) {
      logException(ex);
      logObject(this.scratch, "scratch object");
    }
  },

  onSearchDone: function QuickFilterSearchListener_onSearchDone(aStatus) {
    // it's possible we will see the tail end of an existing search. ignore.
    if (!this.started)
      return;

    this.session.unregisterListener(this);

    let curState = (this.filterDef.name in this.filterer.filterValues) ?
                     this.filterer.filterValues[this.filterDef.name] : null;
    let [newState, update, treatAsUserAction] =
      this.listener.onSearchDone(curState, this.scratch, aStatus);

    this.filterer.setFilterValue(this.filterDef.name, newState,
                                 !treatAsUserAction);
    if (update && this.folderDisplay.active) {
     this.muxer.reflectFiltererState(this.filterer, this.folderDisplay,
                                     this.filterDef.name);
    }
  },
};

/**
 * Extensible mechanism for defining filters for the quick filter bar.  This
 * is the spiritual successor to the mailViewManager and quickSearchManager.
 *
 * The manager includes and requires UI-relevant metadata for use by its
 * counterparts in quickFilterBar.js.  New filters are expected to contribute
 * DOM nodes to the overlay and tell us about them using their id during
 * registration.
 *
 * We support two types of filtery things.
 * - Filters via defineFilter.
 * - Text filters via defineTextFilter.  These always take the filter text as
 *   a parameter.
 *
 * If you are an adventurous extension developer and want to add a magic
 * text filter that does the whole "from:bob to:jim subject:shoes" what you
 * will want to do is register a normal filter and collapse the normal text
 * filter text-box.  You add your own text box, etc.
 */
let QuickFilterManager = {
  /**
   * List of filter definitions, potentially prioritized.
   */
  filterDefs: [],
  /**
   * Keys are filter definition names, values are the filter defs.
   */
  filterDefsByName: {},
  /**
   * The DOM id of the text widget that should get focused when the user hits
   *  control-f or the equivalent.  This is here so it can get clobbered.
   */
  textBoxDomId: null,

  /**
   * Define a new filter.
   *
   * Filter states must always be JSON serializable.  A state of undefined means
   * that we are not persisting any state for your filter.
   *
   * @param {String} aFilterDef.name The name of your filter.  This is the name
   *     of the attribute we cram your state into the state dictionary as, so
   *     the key thing is that it doesn't conflict with other id's.
   * @param {String} aFilterDef.domId The id of the DOM node that you have
   *     overlayed into the quick filter bar.
   * @param {function(aTermCreator, aTerms, aState)} aFilterDef.appendTerms
   *     The function to invoke to contribute your terms to the list of
   *     search terms in aTerms.  Your function will not be invoked if you do
   *     not have any currently persisted state (as is the case if null or
   *     undefined was set).  If you have nothing to add, then don't do
   *     anything.  If you do add terms, the first term you add needs to have
   *     the booleanAnd flag set to true.  You may optionally return a listener
   *     that complies with the documentation on QuickFilterSearchListener if
   *     you want to process all of the messages returned by the filter; doing
   *     so is not cheap, so don't do that lightly.  (Tag faceting uses this.)
   * @param {function()} [aFilterDef.getDefaults] Function that returns the
   *     default state for the filter.  If the function is not defined or the
   *     returned value is === undefined, no state is set.
   * @param {function(aTemplState, aSticky)} [aFilterDef.propagateState] A
   *     function that takes the state from another QuickFilterState instance
   *     for this definition and propagates it to a new state which it returns.
   *     You would use this to keep the 'sticky' bits of state that you want to
   *     persist between folder changes and when new tabs are opened.  The
   *     aSticky argument tells you if the user wants all the filters still
   *     applied or not.  When false, the idea is you might keep things like
   *     which text fields to filter on, but not the text to filter.  When true,
   *     you would keep the text to filter on too.  Return undefined if you do
   *     not want any state stored in the new filter state.  If you do not
   *     define this function and aSticky would be true, we will propagate your
   *     state verbatim; accordingly functions using rich object state must
   *     implement this method.
   * @param {function(aState)} [aFilterDef.clearState] Function to reset the
   *     the filter's value for the given state, returning a tuple of the new
   *     state and a boolean flag indicating whether there was actually state to
   *     clear.  This is used when the user decides to reset the state of the
   *     filter bar or (just one specific filter).  If omitted, we just delete
   *     the filter state entirely, so you only need to define this if you have
   *     some sticky meta-state you want to maintain.  Return undefined for the
   *     state value if you do not need any state kept around.
   * @param {function(aDocument, aMuxer, aNode)} [aFilterDef.domBindExtra]
   *     Function invoked at initial UI binding of the quick filter bar after
   *     we add a command listener to whatever is identified by domId.  If you
   *     have additional widgets to hook up, this is where you do it.  aDocument
   *     and aMuxer are provided to assist in this endeavor.  Use aMuxer's
   *     getFilterValueForMutation/setFilterValue/updateSearch methods from any
   *     event handlers you register.
   * @param {function(aState, aNode, aEvent, aDocument)} [aFilterDef.onCommand]
   *     If omitted, the default handler assumes your widget has a "checked"
   *     state that should set your state value to true when checked and delete
   *     the state when unchecked.  Implement this function if that is not what
   *     you need.  The function should return a tuple of [new state, should
   *     update the search] as its result.
   * @param {function(aDomNode, aFilterValue, aDoc, aMuxer)}
   *     [aFilterDef.reflectInDOM]
   *     If omitted, we assume the widget referenced by domId has a checked
   *     attribute and assign the filter value coerced to a boolean to the
   *     checked attribute.  Otherwise we call your function and it's up to you
   *     to reflect your state.  aDomNode is the node referred to by domId.
   *     This function will be called when the tab changes, folder changes, or
   *     if we called postFilterProcess and you returned a value !== undefined.
   * @param {function(aState, aViewWrapper, aFiltering)}
   *     [aFilterDef.postFilterProcess]
   *     Invoked after all of the message headers for the view have been
   *     displayed, allowing your code to perform some kind of faceting or other
   *     clever logic.  Return a tuple of [new state, should call reflectInDOM,
   *     should treat as if the user modified the state].  We call this _even
   *     when there is no filter_ applied.  We tell you what's happening via
   *     aFiltering; true means we have applied some terms, false means not.
   *     It's vitally important that you do not just facet things willy nilly
   *     unless there is expected user payoff and they opted in.  Our tagging UI
   *     only facets when the user clicked the tag facet.  If you write an
   *     extension that provides really sweet visualizations or something like
   *     that and the user installs you knowing what's what, that is also cool,
   *     we just can't do it in core for now.
   */
  defineFilter: function MFM_defineFilter(aFilterDef) {
    this.filterDefs.push(aFilterDef);
    this.filterDefsByName[aFilterDef.name] = aFilterDef;
  },

  /**
   * Remove a filter from existence by name.  This is for extensions to disable
   *  existing filters and not a dynamic jetpack-like lifecycle.  It falls to
   *  the code calling killFilter to deal with the DOM nodes themselves for now.
   *
   * @param aName The name of the filter to kill.
   */
  killFilter: function MFM_killFilter(aName) {
    let filterDef = this.filterDefsByName[aName];
    this.filterDefs.splice(this.filterDefs.indexOf(aName), 1);
    delete this.filterDefsByName[aName];
  },

  /**
   * Propagate values from an existing state into a new state based on
   *  propagation rules.  For use by QuickFilterState.
   *
   * @param aTemplValues A set of existing filterValues.
   * @return The new filterValues state.
   */
  propagateValues: function MFM_propagateValues(aTemplValues) {
    let values = {};
    let sticky = ("sticky" in aTemplValues) ? aTemplValues.sticky : false;

    for each (let [, filterDef] in Iterator(this.filterDefs)) {
      if ("propagateState" in filterDef) {
        let curValue = (filterDef.name in aTemplValues) ?
                         aTemplValues[filterDef.name] : undefined;
        let newValue = filterDef.propagateState(curValue, sticky);
        if (newValue !== undefined)
          values[filterDef.name] = newValue;
      }
      // always propagate the value if sticky and there was no handler
      else if (sticky) {
        if (filterDef.name in aTemplValues)
          values[filterDef.name] = aTemplValues[filterDef.name];
      }
    }

    return values;
  },
  /**
   * Get the set of default filterValues for the current set of defined filters.
   *
   * @return Thew new filterValues state.
   */
  getDefaultValues: function MFM_getDefaultValues() {
    let values = {};
    for each (let [, filterDef] in Iterator(this.filterDefs)) {
      if ("getDefaults" in filterDef) {
        let newValue = filterDef.getDefaults();
        if (newValue !== undefined)
          values[filterDef.name] = newValue;
      }
    }
    return values;
  },

  /**
   * Reset the state of a single filter given the provided values.
   *
   * @return true if we actually cleared some state, false if there was nothing
   *     to clear.
   */
  clearFilterValue: function MFM_clearFilterValue(aFilterName, aValues) {
    let filterDef = this.filterDefsByName[aFilterName];
    if (!("clearState" in filterDef)) {
      if (aFilterName in aValues) {
        delete aValues[aFilterName];
        return true;
      }
      return false;
    }

    let curValue = (aFilterName in aValues) ?
                     aValues[aFilterName] : undefined;
    // Yes, we want to call it to clear its state even if it has no state.
    let [newValue, didClear] = filterDef.clearState(curValue);
    if (newValue !== undefined)
      aValues[aFilterName] = newValue;
    else
      delete aValues[aFilterName];
    return didClear;
  },

  /**
   * Reset the state of all filters given the provided values.
   *
   * @return true if we actually cleared something, false if there was nothing
   *     to clear.
   */
  clearAllFilterValues: function MFM_clearFilterValues(aFilterValues) {
    let didClearSomething = false;
    for each (let [, filterDef] in Iterator(this.filterDefs)) {
      if (this.clearFilterValue(filterDef.name, aFilterValues))
        didClearSomething = true;
    }
    return didClearSomething;
  },

  /**
   * Populate and return a list of search terms given the provided state.
   *
   * We only invoke appendTerms on filters that have state in aFilterValues,
   * as per the contract.
   */
  createSearchTerms: function MFM_createSearchTerms(aFilterValues,
                                                    aTermCreator) {
    let searchTerms = [], listeners = [];
    for each (let [filterName, filterValue] in Iterator(aFilterValues)) {
      let filterDef = this.filterDefsByName[filterName];
      try {
        let listener =
          filterDef.appendTerms(aTermCreator, searchTerms, filterValue);
        if (listener)
          listeners.push([listener, filterDef]);
      }
      catch(ex) {
        logException(ex);
      }
    }
    return searchTerms.length ? [searchTerms, listeners] : [null, listeners];
  }
};

/**
 * Meta-filter, just handles whether or not things are sticky.
 */
QuickFilterManager.defineFilter({
  name: "sticky",
  domId: "qfb-sticky",
  appendTerms: function(aTermCreator, aTerms, aFilterValue) {
  },
  /**
   * This should not cause an update, otherwise default logic.
   */
  onCommand: function(aState, aNode, aEvent, aDocument) {
    let checked = aNode.checked ? true : null;
    return [checked, false];
  },
});

/**
 * true: must be unread, false: must be read.
 */
QuickFilterManager.defineFilter({
  name: "unread",
  domId: "qfb-unread",
  appendTerms: function(aTermCreator, aTerms, aFilterValue) {
    let term, value;
    term = aTermCreator.createTerm();
    term.attrib = nsMsgSearchAttrib.MsgStatus;
    value = term.value;
    value.attrib = term.attrib;
    value.status = nsMsgMessageFlags.Read;
    term.value = value;
    term.op = aFilterValue ? nsMsgSearchOp.Isnt : nsMsgSearchOp.Is;
    term.booleanAnd = true;
    aTerms.push(term);
  }
});

/**
 * true: must be starred, false: must not be starred.
 */
QuickFilterManager.defineFilter({
  name: "starred",
  domId: "qfb-starred",
  appendTerms: function(aTermCreator, aTerms, aFilterValue) {
    let term, value;
    term = aTermCreator.createTerm();
    term.attrib = nsMsgSearchAttrib.MsgStatus;
    value = term.value;
    value.attrib = term.attrib;
    value.status = nsMsgMessageFlags.Marked;
    term.value = value;
    term.op = aFilterValue ? nsMsgSearchOp.Is : nsMsgSearchOp.Isnt;
    term.booleanAnd = true;
    aTerms.push(term);
  }
});

/**
 * true: sender must be in a local address book, false: sender must not be.
 */
QuickFilterManager.defineFilter({
  name: "addrBook",
  domId: "qfb-inaddrbook",
  appendTerms: function(aTermCreator, aTerms, aFilterValue) {
    let term, value;
    let enumerator = Components.classes["@mozilla.org/abmanager;1"]
                               .getService(Components.interfaces.nsIAbManager)
                               .directories;
    let firstBook = true;
    term = null;
    while (enumerator.hasMoreElements()) {
      let addrbook = enumerator.getNext();
      if (addrbook instanceof Components.interfaces.nsIAbDirectory &&
          !addrbook.isRemote) {
        term = aTermCreator.createTerm();
        term.attrib = Components.interfaces.nsMsgSearchAttrib.Sender;
        value = term.value;
        value.attrib = term.attrib;
        value.str = addrbook.URI;
        term.value = value;
        term.op = aFilterValue ? nsMsgSearchOp.IsInAB : nsMsgSearchOp.IsntInAB;
        // It's an AND if we're the first book (so the boolean affects the
        //  group as a whole.)
        // It's the negation of whether we're filtering otherwise; demorgans.
        term.booleanAnd = firstBook || !aFilterValue;
        term.beginsGrouping = firstBook;
        aTerms.push(term);
        firstBook = false;
      }
    }
    if (term)
      term.endsGrouping = true;
  }
});

/**
 * It's a tag filter that sorta facets! Stealing gloda's thunder! Woo!
 *
 * Filter on message tags?  Meanings:
 * - true: Yes, must have at least one tag on it.
 * - false: No, no tags on it!
 * - dictionary where keys are tag keys and values are tri-state with null
 *    meaning don't constraint, true meaning yes should be present, false
 *    meaning no, don't be present
 */
let TagFacetingFilter = {
  name: "tags",
  domId: "qfb-tags",

  /**
   * @return true if the constaint is only on has tags/does not have tags,
   *     false if there are specific tag constraints in play.
   */
  isSimple: function(aFilterValue) {
    // it's the simple case if the value is just a boolean
    if (typeof(aFilterValue) != "object")
      return true;
    // but also if the object contains no true values
    let simpleCase = true;
    for each (let [key, value] in Iterator(aFilterValue)) {
      if (value !== null) {
        simpleCase = false;
        break;
      }
    }
    return simpleCase;
  },

  /**
   * Because we support both inclusion and exclusion we can produce up to two
   *  groups.  One group for inclusion, one group for exclusion.  To get listed
   *  you only need to include one of the tags marked for inclusion, but you
   *  must not have any of the tags marked for exclusion.
   */
  appendTerms: function TFF_appendTerms(aTermCreator, aTerms, aFilterValue) {
    let term, value;

    if (aFilterValue == null)
      return null;

    // just the true/false case
    if (this.isSimple(aFilterValue)) {
      term = aTermCreator.createTerm();
      term.attrib = Components.interfaces.nsMsgSearchAttrib.Keywords;
      value = term.value;
      value.str = "";
      term.value = value;
      term.op = aFilterValue ?
                  Components.interfaces.nsMsgSearchOp.IsntEmpty :
                  Components.interfaces.nsMsgSearchOp.IsEmpty;
      term.booleanAnd = true;
      aTerms.push(term);

      // we need to perform faceting if the value is literally true.
      if (aFilterValue === true)
        return this;
    }
    else {
      let firstIncludeClause = true, firstExcludeClause = true;
      let lastIncludeTerm = null;
      term = null;

      let excludeTerms = [];

      for each (let [key, shouldFilter] in Iterator(aFilterValue)) {
        if (shouldFilter !== null) {
          term = aTermCreator.createTerm();
          term.attrib = Components.interfaces.nsMsgSearchAttrib.Keywords;
          value = term.value;
          value.attrib = term.attrib;
          value.str = key;
          term.value = value;
          if (shouldFilter) {
            term.op = nsMsgSearchOp.Contains;
            // AND for the group, but OR inside the group
            term.booleanAnd = firstIncludeClause;
            term.beginsGrouping = firstIncludeClause;
            aTerms.push(term);
            firstIncludeClause = false;
            lastIncludeTerm = term;
          }
          else {
            term.op = nsMsgSearchOp.DoesntContain;
            // you need to not include all of the tags marked excluded.
            term.booleanAnd = true;
            term.beginsGrouping = firstExcludeClause;
            excludeTerms.push(term);
            firstExcludeClause = false;
          }
        }
      }
      if (lastIncludeTerm)
        lastIncludeTerm.endsGrouping = true;

      // if we have any exclude terms:
      // - we might need to add a "has a tag" clause if there were no explicit
      //   inclusions.
      // - extend the exclusions list in.
      if (excludeTerms.length) {
        // (we need to add has a tag)
        if (!lastIncludeTerm) {
          term = aTermCreator.createTerm();
          term.attrib = Components.interfaces.nsMsgSearchAttrib.Keywords;
          value = term.value;
          value.str = "";
          term.value = value;
          term.op = Components.interfaces.nsMsgSearchOp.IsntEmpty;
          term.booleanAnd = true;
          aTerms.push(term);
        }

        // (extend in the exclusions)
        excludeTerms[excludeTerms.length-1].endsGrouping = true;
        aTerms.push.apply(aTerms, excludeTerms);
      }
    }

    return null;
  },

  onSearchStart: function(aCurState) {
    // this becomes aKeywordMap; we want to start with an empty one
    return {};
  },
  onSearchMessage: function(aKeywordMap, aMsgHdr, aFolder) {
    let keywords = aMsgHdr.getStringProperty("keywords");
    let keywordList = keywords.split(' ');
    for (let iKeyword = 0; iKeyword < keywordList.length; iKeyword++) {
      let keyword = keywordList[iKeyword];
      aKeywordMap[keyword] = null;
    }
  },
  onSearchDone: function(aCurState, aKeywordMap, aStatus) {
    // we are an async operation; if the user turned off the tag facet already,
    //  then leave that state intact...
    if (aCurState == null)
      return [null, false, false];

    // only propagate things that are actually tags though!
    let outKeyMap = {};
    let tagService = Cc["@mozilla.org/messenger/tagservice;1"]
                       .getService(Ci.nsIMsgTagService);
    let tags = tagService.getAllTags({});
    let tagCount = tags.length;
    for (let iTag=0; iTag < tagCount; iTag++) {
      let tag = tags[iTag];

      if (tag.key in aKeywordMap)
        outKeyMap[tag.key] = aKeywordMap[tag.key];
    }

    return [outKeyMap, true, false];
  },

  /**
   * We need to clone our state if it's an object to avoid bad sharing.
   */
  propagateState: function(aOld, aSticky) {
    // stay disabled when disabled
    if (aOld == null)
      return null;
    if (this.isSimple(aOld))
      return aOld ? true : false; // could be an object, need to convert.
    return shallowObjCopy(aOld);
  },

  /**
   * Default behaviour but:
   * - We collapse our expando if we get unchecked.
   * - We want to initiate a faceting pass if we just got checked.
   */
  onCommand: function(aState, aNode, aEvent, aDocument) {
    let checked = aNode.checked ? true : null;
    if (!checked)
      aDocument.getElementById("quick-filter-bar-tab-bar").collapsed = true;

    // return ourselves if we just got checked to have
    //  onSearchStart/onSearchMessage/onSearchDone get to do their thing.
    return [checked, true];
  },

  reflectInDOM: function TFF_reflectInDOM(aNode, aFilterValue,
                                          aDocument, aMuxer) {
    aNode.checked = aFilterValue ? true : false;

    if ((aFilterValue != null) &&
        (typeof(aFilterValue) == "object"))
      this._populateTagBar(aFilterValue, aDocument, aMuxer);
    else
      aDocument.getElementById("quick-filter-bar-tab-bar").collapsed = true;
  },

  _populateTagBar: function TFF__populateTagMenu(aState, aDocument, aMuxer) {
    let tagbar = aDocument.getElementById("quick-filter-bar-tab-bar");
    let keywordMap = aState;

    function commandHandler(aEvent) {
      let tagKey = aEvent.target.getAttribute("value");
      let state = aMuxer.getFilterValueForMutation(TagFacetingFilter.name);
      state[tagKey] = aEvent.target.checked ? true : null;
      aEvent.target.removeAttribute("inverted");
      aMuxer.updateSearch();
    };

    function rightClickHandler(aEvent) {
      // Only do something if this is a right-click, otherwise commandHandler
      //  will pick up on it.
      if (aEvent.button == 2) {
        // we need to toggle the checked state ourselves
        aEvent.target.checked = !aEvent.target.checked;

        let tagKey = aEvent.target.getAttribute("value");
        let state = aMuxer.getFilterValueForMutation(TagFacetingFilter.name);
        state[tagKey] = aEvent.target.checked ? false : null;
        if (aEvent.target.checked)
          aEvent.target.setAttribute("inverted", "true");
        else
          aEvent.target.removeAttribute("inverted");
        aMuxer.updateSearch();
        aEvent.stopPropagation();
        aEvent.preventDefault();
      }
    }

    // -- nuke existing exposed tags
    while (tagbar.lastChild)
      tagbar.removeChild(tagbar.lastChild);

    let addCount = 0;

    // -- create an element for each tag
    let tagService = Components.classes["@mozilla.org/messenger/tagservice;1"]
                           .getService(Components.interfaces.nsIMsgTagService);
    let tags = tagService.getAllTags({});
    let tagCount = tags.length;
    for (let iTag=0; iTag < tagCount; iTag++) {
      let tag = tags[iTag];

      if (tag.key in keywordMap) {
        addCount++;

        // Keep in mind that the XBL does not get built for dynamically created
        //  elements such as these until they get displayed, which definitely
        //  means not before we append it into the tree.
        let button = aDocument.createElement("toolbarbutton");

        button.setAttribute("id", "qfb-tag-" + tag.key);
        button.addEventListener("command", commandHandler, false);
        button.addEventListener("click", rightClickHandler, false);
        button.setAttribute("type", "checkbox");
        if (keywordMap[tag.key] !== null) {
          button.setAttribute("checked", "true");
          if (!keywordMap[tag.key])
            button.setAttribute("inverted", "true");
        }
        button.setAttribute("label", tag.tag);
        button.setAttribute("value", tag.key);
        let color = tag.color;
        // everybody always gets to be an qfb-tag-button.
        if (color)
          button.setAttribute("class", "qfb-tag-button lc-" + color.substr(1));
        else
          button.setAttribute("class", "qfb-tag-button");
        tagbar.appendChild(button);
      }
    }

    tagbar.collapsed = !addCount;
  },
};
QuickFilterManager.defineFilter(TagFacetingFilter);

/**
 * true: must have attachment, false: must not have attachment.
 */
QuickFilterManager.defineFilter({
  name: "attachment",
  domId: "qfb-attachment",
  appendTerms: function(aTermCreator, aTerms, aFilterValue) {
    let term, value;
    term = aTermCreator.createTerm();
    term.attrib = Components.interfaces.nsMsgSearchAttrib.MsgStatus;
    value = term.value;
    value.attrib = term.attrib;
    value.status = Components.interfaces.nsMsgMessageFlags.Attachment;
    term.value = value;
    term.op = aFilterValue ? nsMsgSearchOp.Is : nsMsgSearchOp.Isnt;
    term.booleanAnd = true;
    aTerms.push(term);
  }
});

/**
 * The traditional quick-search text filter now with added gloda upsell!  We
 * are mildly extensible in case someone wants to add more specific text filter
 * criteria to toggle, but otherwise are intended to be taken out of the
 * picture entirely by extensions implementing more featureful text searches.
 *
 * Our state looks like {text: "", states: {a: true, b: false}} where a and b
 * are text filters.
 */
let MessageTextFilter = {
  name: "text",
  domId: "qfb-qs-textbox",
  /**
   * Parse the string into terms/phrases by finding matching double-quotes.  If
   * we find a quote that doesn't have a friend, we assume the user was going
   * to put a quote at the end of the string.  (This is important because we
   * update using a timer and this results in stable behavior.)
   *
   * This code is cloned from gloda's msg_search.js and known good (enough :).
   * I did change the friendless quote situation, though.
   *
   * @param aSearchString The phrase to parse up.
   * @return A list of terms.
   */
  _parseSearchString: function MTF__parseSearchString(aSearchString) {
    aSearchString = aSearchString.trim();
    let terms = [];

    /*
     * Add the term as long as the trim on the way in didn't obliterate it.
     *
     * In the future this might have other helper logic; it did once before.
     */
    function addTerm(aTerm) {
      if (aTerm)
        terms.push(aTerm);
    }

    while (aSearchString) {
      if (aSearchString[0] == '"') {
        let endIndex = aSearchString.indexOf(aSearchString[0], 1);
        // treat a quote without a friend as making a phrase containing the
        // rest of the string...
        if (endIndex == -1) {
          endIndex = aSearchString.length;
        }

        addTerm(aSearchString.substring(1, endIndex).trim());
        aSearchString = aSearchString.substring(endIndex + 1);
        continue;
      }

      let spaceIndex = aSearchString.indexOf(" ");
      if (spaceIndex == -1) {
        addTerm(aSearchString);
        break;
      }

      addTerm(aSearchString.substring(0, spaceIndex));
      aSearchString = aSearchString.substring(spaceIndex+1);
    }

    return terms;
  },

  /**
   * For each search phrase, build a group that contains all our active text
   *  filters OR'ed together.  So if the user queries for 'foo bar' with
   *  sender and recipient enabled, we build:
   * ("foo" sender OR "foo" recipient) AND ("bar" sender OR "bar" recipient)
   */
  appendTerms: function(aTermCreator, aTerms, aFilterValue) {
    let term, value;

    if (aFilterValue.text) {
      let phrases = this._parseSearchString(aFilterValue.text);
      for each (let [, phrase] in Iterator(phrases)) {
        let firstClause = true;
        term = null;
        for each (let [tfName, tfValue] in Iterator(aFilterValue.states)) {
          if (!tfValue)
            continue;
          let tfDef = this.textFilterDefs[tfName];

          term = aTermCreator.createTerm();
          term.attrib = tfDef.attrib;
          value = term.value;
          value.attrib = tfDef.attrib;
          value.str = phrase;
          term.value = value;
          term.op = nsMsgSearchOp.Contains;
          // AND for the group, but OR inside the group
          term.booleanAnd = firstClause;
          term.beginsGrouping = firstClause;
          aTerms.push(term);
          firstClause = false;
        }
        if (term)
          term.endsGrouping = true;
      }
    }
  },
  getDefaults: function() {
    let states = {};
    for each (let [name, value] in Iterator(this._defaultStates)) {
      states[name] = value;
    }
    return {
      text: null,
      states: states,
    };
  },
  propagateState: function(aOld, aSticky) {
    return {
      text: aSticky ? aOld.text : null,
      states: shallowObjCopy(aOld.states),
    };
  },
  clearState: function(aState) {
    let hadState = (aState.text && aState.text != "");
    aState.text = null;
    return [aState, hadState];
  },

  /**
   * We need to create and bind our expando-bar toggle buttons.  We also need to
   *  add a special down keypress handler that escapes the textbox into the
   *  thread pane.
   */
  domBindExtra: function MessageTextFilter_domBind(aDocument, aMuxer, aNode) {
    // -- platform-dependent emptytext setup
    aNode.setAttribute(
      "emptytext",
      aNode.getAttribute("emptytextbase")
           .replace("#1", aNode.getAttribute(Application.platformIsMac ?
                                             "keyLabelMac" : "keyLabelNonMac")));
    // force an update of the emptytext now that we've updated it.
    aNode.value = "";

    // -- Keypresses for focus transferral and upsell
    aNode.addEventListener("keypress", function(aEvent) {
      // - Down key into the thread pane
      if (aEvent.keyCode == aEvent.DOM_VK_DOWN) {
        let threadPane = aDocument.getElementById("threadTree");
        // focusing does not actually select the row...
        threadPane.focus();
        // ...so explicitly select the current index.
        threadPane.view.selection.select(threadPane.currentIndex);
        return false;
      }
      // - Enter when upsell is actively proposed...
      else if (aEvent.keyCode == aEvent.DOM_VK_ENTER) {
      }
      return true;
    }, false);

    // -- Blurring kills upsell.
    aNode.addEventListener("blur", function(aEvent) {
      let panel = aDocument.getElementById("qfb-text-search-upsell");
      if ((FocusManager.activeWindow != aDocument.defaultView ||
           aDocument.commandDispatcher.focusedElement != aNode.inputField) &&
          panel.state == "open") {
        panel.hidePopup();
      }
    }, true);

    // -- Expando Buttons!
    function commandHandler(aEvent) {
      let state = aMuxer.getFilterValueForMutation(MessageTextFilter.name);
      let filterDef = MessageTextFilter.textFilterDefsByDomId[aEvent.target.id];
      state.states[filterDef.name] = aEvent.target.checked;
      aMuxer.updateSearch();
    }

    for each (let [, textFilter] in Iterator(this.textFilterDefs)) {
      aDocument.getElementById(textFilter.domId).addEventListener(
        "command", commandHandler, false);
    }
  },

  onCommand: function(aState, aNode, aEvent, aDocument) {
    let text = aNode.value.length ? aNode.value : null;
    if (text == aState.text) {
      let upsell = aDocument.getElementById("qfb-text-search-upsell");
      if (upsell.state == "open") {
        upsell.hidePopup();
        let tabmail = aDocument.getElementById("tabmail");
        tabmail.openTab("glodaFacet", {
                          searcher: new GlodaMsgSearcher(null, aState.text)
                        });
      }
      return [aState, false];
    }

    aState.text = text;
    aDocument.getElementById("quick-filter-bar-filter-text-bar").collapsed =
      (text == null);
    return [aState, true];
  },

  reflectInDOM: function MessageTextFilter_reflectInDOM(aNode, aFilterValue,
                                                        aDocument, aMuxer,
                                                        aFromPFP) {
    if (aFromPFP == "nosale") {
      let panel = aDocument.getElementById("qfb-text-search-upsell");
      if (panel.state != "closed")
        panel.hidePopup();
      return;
    }
    if (aFromPFP == "upsell") {
      let panel = aDocument.getElementById("qfb-text-search-upsell");
      let line1 = aDocument.getElementById("qfb-upsell-line-one");
      let line2 = aDocument.getElementById("qfb-upsell-line-two");
      line1.value = line1.getAttribute("fmt").replace("#1", aFilterValue.text);
      line2.value = line2.getAttribute("fmt").replace("#1", aFilterValue.text);

      if (panel.state == "closed" &&
          aDocument.commandDispatcher.focusedElement == aNode.inputField) {
        let filterBar = aDocument.getElementById("quick-filter-bar");
        //panel.sizeTo(filterBar.clientWidth - 20, filterBar.clientHeight - 20);
        panel.openPopup(filterBar, "after_end", -7, 7, false, true);
      }
      return;
    }

    // Make sure we have no visible upsell on state change while our textbox
    //  retains focus.
    let panel = aDocument.getElementById("qfb-text-search-upsell");
    if (panel.state != "closed")
      panel.hidePopup();

    // Update the text if it has changed (linux does weird things with empty
    //  text if we're transitioning emptytext to emptytext)
    let desiredValue = aFilterValue.text || "";
    if (aNode.value != desiredValue)
      aNode.value = desiredValue;

    // Update our expando buttons
    let states = aFilterValue.states;
    for each (let [, textFilter] in Iterator(this.textFilterDefs)) {
      aDocument.getElementById(textFilter.domId).checked =
        states[textFilter.name];
    }

    // Show the expando?
    aDocument.getElementById("quick-filter-bar-filter-text-bar").collapsed =
      (aFilterValue.text == null);
  },

  /**
   * In order to do our upsell we need to know when we are not getting any
   *  results.
   */
  postFilterProcess: function MessageTextFilter_postFilterProcess(aState,
                                                                  aViewWrapper,
                                                                  aFiltering) {
    // If we're not filtering, not filtering on text, there are results, or
    //  gloda is not enabled so upselling makes no sense, then bail.
    // (Currently we always return "nosale" to make sure our panel is closed;
    //  this might be overkill but unless it becomes a performance problem, it
    //  keeps us safe from weird stuff.)
    if (!aFiltering || !aState.text || aViewWrapper.dbView.numMsgsInView ||
        !GlodaIndexer.enabled)
      return [aState, "nosale", false];

    // since we're filtering, filtering on text, and there are no results, tell
    //  the upsell code to get bizzay
    return [aState, "upsell", false];
  },

  /** maps text filter names to whether they are enabled by default (bool)  */
  _defaultStates: {},
  /** maps text filter name to text filter def */
  textFilterDefs: {},
  /** maps dom id to text filter def */
  textFilterDefsByDomId: {},
  defineTextFilter: function MessageTextFilter_defineTextFilter(aTextDef) {
    this.textFilterDefs[aTextDef.name] = aTextDef;
    this.textFilterDefsByDomId[aTextDef.domId] = aTextDef;
    if (aTextDef.defaultState)
      this._defaultStates[aTextDef.name] = true;
  },
};
// Note that we definitely want this filter defined AFTER the cheap message
// status filters, so don't reorder this invocation willy nilly.
QuickFilterManager.defineFilter(MessageTextFilter);
QuickFilterManager.textBoxDomId = "qfb-qs-textbox";

MessageTextFilter.defineTextFilter({
  name: "sender",
  domId: "qfb-qs-sender",
  attrib: nsMsgSearchAttrib.Sender,
  defaultState: true,
});
MessageTextFilter.defineTextFilter({
  name: "recipients",
  domId: "qfb-qs-recipients",
  attrib: nsMsgSearchAttrib.ToOrCC,
  defaultState: true,
});
MessageTextFilter.defineTextFilter({
  name: "subject",
  domId: "qfb-qs-subject",
  attrib: nsMsgSearchAttrib.Subject,
  defaultState: true,
});
MessageTextFilter.defineTextFilter({
  name: "body",
  domId: "qfb-qs-body",
  attrib: nsMsgSearchAttrib.Body,
  defaultState: false,
});

/**
 * We need to be parameterized by folder/muxer to provide update notifications
 * and this is the cleanest way given the current FolderDisplayWidget assumption
 * that everyone knows the window they are in already.
 */
function ResultsLabelFolderDisplayListener(aMuxer) {
  this.muxer = aMuxer;
}
ResultsLabelFolderDisplayListener.prototype = {
  _update: function ResultsLabelFolderDisplayListener__update(aFolderDisplay) {
    let filterer = aFolderDisplay._tabInfo._ext.quickFilter;
    if (!filterer)
      return;
    let oldCount = ("results" in filterer.filterValues) ?
                     filterer.filterValues.results : null;
    // (we only display the tally when the filter is active; don't change that)
    if (oldCount == null)
      return;
    let newCount = aFolderDisplay.view.dbView.numMsgsInView;
    if (oldCount == newCount)
      return;
    filterer.setFilterValue("results", newCount, true);
    if (aFolderDisplay.active)
      this.muxer.reflectFiltererState(filterer, aFolderDisplay, "results");
  },

  //////////////////////////////////////////////////////////////////////////////
  //// FolderDisplayListener

  // We want to make sure that anything that would change the count of displayed
  //  messages causes us to update our dislayed value.

  onMessageCountsChanged: function(aFolderDisplay) {
    this._update(aFolderDisplay);
  },

  onMessagesRemoved: function(aFolderDisplay) {
    this._update(aFolderDisplay);
  },
};

/**
 * The results label says whether there were any matches and, if so, how many.
 */
QuickFilterManager.defineFilter({
  name: "results",
  domId: "qfb-results-label",
  appendTerms: function(aTermCreator, aTerms, aFilterValue) {
  },
  /**
   * Hook us up as a folder display listener so we can get information on when
   * the counts change.
   */
  domBindExtra: function MessageTextFilter_domBind(aDocument, aMuxer, aNode) {
    aDocument.defaultView.FolderDisplayListenerManager.registerListener(
      new ResultsLabelFolderDisplayListener(aMuxer));
  },
  reflectInDOM: function MessageTextFilter_reflectInDOM(aNode, aFilterValue,
                                                        aDocument) {
    if (aFilterValue == null) {
      aNode.value = "";
      aNode.style.visibility = "hidden";
    }
    else if (aFilterValue == 0) {
      aNode.value = aNode.getAttribute("noresultsstring");
      aNode.style.visibility = "visible";
    }
    else {
      let fmtstring = aNode.getAttribute("somefmtstring");

      aNode.value = PluralForm.get(aFilterValue, fmtstring)
                              .replace("#1", aFilterValue.toString());
      aNode.style.visibility = "visible";
    }
  },
  /**
   * We slightly abuse the filtering hook to figure out how many messages there
   *  are and whether a filter is active.  What makes this reasonable is that
   *  a more complicated widget that visualized the results as a timeline would
   *  definitely want to be hooked up like this.  (Although they would want
   *  to implement propagateState since the state they store would be pretty
   *  expensive.)
   */
  postFilterProcess: function TFF_postFilterProcess(aState, aViewWrapper,
                                                    aFiltering) {
    return [aFiltering ? aViewWrapper.dbView.numMsgsInView : null, true, false];
  },
});
