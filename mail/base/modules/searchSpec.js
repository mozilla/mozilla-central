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
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
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

EXPORTED_SYMBOLS = ['SearchSpec'];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource://app/modules/iteratorUtils.jsm");
Cu.import("resource://app/modules/quickSearchManager.js");

const nsMsgSearchScope = Ci.nsMsgSearchScope;
const nsIMsgSearchTerm = Ci.nsIMsgSearchTerm;
const nsIMsgLocalMailFolder = Ci.nsIMsgLocalMailFolder;
const nsMsgFolderFlags = Ci.nsMsgFolderFlags;
const nsMsgSearchAttrib = Ci.nsMsgSearchAttrib;

const NS_MSG_SEARCH_INTERRUPTED = 0x00550002;

/**
 * Wrapper abstraction around a view's search session.  This is basically a
 *  friend class of FolderDisplayWidget and is privy to some of its internals.
 */
function SearchSpec(aViewWrapper) {
  this.owner = aViewWrapper;

  this._viewTerms = null;
  this._virtualFolderTerms = null;
  this._userTerms = null;

  this._session = null;
  this._sessionListener = null;
  this._listenersRegistered = false;

  this._onlineSearch = false;
}
SearchSpec.prototype = {
  /**
   * Clone this SearchSpec; intended to be used by DBViewWrapper.clone().
   */
  clone: function SearchSpec_clone(aViewWrapper) {
    let doppel = new SearchSpec(aViewWrapper);

    // we can just copy the terms since we never mutate them
    doppel._viewTerms = this._viewTerms;
    doppel._virtualFolderTerms = this._viewTerms;
    doppel._userTerms = this._viewTerms;

    // _session can stay null
    // no listener is required, so we can keep _sessionListener and
    //  _listenersRegistered at their default values

    return doppel;
  },

  get hasSearchTerms() {
    return this._viewTerms || this._virtualFolderTerms || this._userTerms;
  },

  get hasOnlyVirtualTerms() {
    return this._virtualFolderTerms && !this._viewTerms && !this._userTerms;
  },

  /**
   * On-demand creation of the nsIMsgSearchSession.  Automatically creates a
   *  SearchSpecListener at the same time and registers it as a listener.  The
   *  DBViewWrapper is responsible for adding (and removing) the db view
   *  as a listener.
   *
   * Code should only access this attribute when it wants to manipulate the
   *  session.  Callers should use hasSearchTerms if they want to determine if
   *  a search session is required.
   */
  get session() {
    if (this._session == null) {
      this._session =
        Components.classes["@mozilla.org/messenger/searchSession;1"]
                  .createInstance(Ci.nsIMsgSearchSession);
    }
    return this._session;
  },

  /**
   * (Potentially) add the db view as a search listener and kick off the search.
   *  We only do that if we have search terms.  The intent is to allow you to
   *  call this all the time, even if you don't need to.
   * DBViewWrapper._applyViewChanges used to handle a lot more of this, but our
   *  need to make sure that the session listener gets added after the DBView
   *  caused us to introduce this method.  (We want the DB View's OnDone method
   *  to run before our listener, as it may do important work.)
   */
  associateView: function SearchSpec_associateView(aDBView) {
    if (this.hasSearchTerms) {
      this.updateSession();

      if (this.owner.isSynthetic) {
        this.owner._syntheticView.search(new FilteringSyntheticListener(this));
      }
      else {
        if (!this._sessionListener)
          this._sessionListener = new SearchSpecListener(this);

        this.session.registerListener(aDBView);
        aDBView.searchSession = this._session;
        this._session.registerListener(this._sessionListener);
        this._listenersRegistered = true;

        this.owner.searching = true;
        this.session.search(this.owner.listener.msgWindow);
      }
    }
    // if it's synthetic but we have no search terms, hook the output of the
    //  synthetic view directly up to the search nsIMsgDBView
    else if (this.owner.isSynthetic) {
      let owner = this.owner;
      owner.searching = true;
      this.owner._syntheticView.search(
        aDBView.QueryInterface(Ci.nsIMsgSearchNotify),
        function() { owner.searching = false; });
    }
  },
  /**
   * Stop any active search and stop the db view being a search listener (if it
   *  is one).
   */
  dissociateView: function SearchSpec_dissociateView(aDBView) {
    // If we are currently searching, interrupt the search.  This will
    //  immediately notify the listeners that the search is done with and
    //  clear the searching flag for us.
    if (this.owner.searching) {
      if (this.owner.isSynthetic)
        this.owner._syntheticView.abortSearch();
      else
        this.session.interruptSearch();
    }

    if (this._listenersRegistered) {
      this._session.unregisterListener(this._sessionListener);
      this._session.unregisterListener(aDBView);
      aDBView.searchSession = null;
      this._listenersRegistered = false;
    }
  },

  /**
   * Given a list of terms, mutate them so that they form a single boolean
   *  group.
   *
   * @param aTerms The search terms
   * @param aCloneTerms Do we need to clone the terms?
   */
  _groupifyTerms: function SearchSpec__groupifyTerms(aTerms, aCloneTerms) {
    let iTerm = 0, term;
    let outTerms = aCloneTerms ? [] : aTerms;
    for (term in fixIterator(aTerms, Ci.nsIMsgSearchTerm)) {
      if (aCloneTerms) {
        let cloneTerm = this.session.createTerm();
        cloneTerm.value = term.value;
        cloneTerm.attrib = term.attrib;
        cloneTerm.arbitraryHeader = term.arbitraryHeader;
        cloneTerm.hdrProperty = term.hdrProperty;
        cloneTerm.customId = term.customId;
        cloneTerm.op = term.op;
        cloneTerm.booleanAnd = term.booleanAnd;
        cloneTerm.matchAll = term.matchAll;
        term = cloneTerm;
        outTerms.push(term);
      }
      if (iTerm == 0) {
        term.beginsGrouping = true;
        term.booleanAnd = true;
      }
      iTerm++;
    }
    if (term)
      term.endsGrouping = true;

    return outTerms;
  },

  /**
   * Set search terms that are defined by the 'view', which translates to that
   *  weird combo-box that lets you view your unread messages, messages by tag,
   *  messages that aren't deleted, etc.
   *
   * @param aViewTerms The list of terms.  We take ownership and mutate it.
   */
  set viewTerms(aViewTerms) {
    if (aViewTerms)
      this._viewTerms = this._groupifyTerms(aViewTerms);
    else
      this._viewTerms = null;
    this.owner._applyViewChanges();
  },
  /**
   * @return the view terms currently in effect.  Do not mutate this.
   */
  get viewTerms() {
    return this._viewTerms;
  },
  /**
   * Set search terms that are defined by the 'virtual folder' definition.  This
   *  could also be thought of as the 'saved search' part of a saved search.
   *
   * @param aVirtualFolderTerms The list of terms.  We make our own copy and
   *     do not mutate yours.
   */
  set virtualFolderTerms(aVirtualFolderTerms) {
    if (aVirtualFolderTerms)
      // we need to clone virtual folder terms because they are pulled from a
      //  persistent location rather than created on demand
      this._virtualFolderTerms = this._groupifyTerms(aVirtualFolderTerms,
                                                     true);
    else
      this._virtualFolderTerms = null;
    this.owner._applyViewChanges();
  },
  /**
   * @return the Virtual folder terms currently in effect.  Do not mutate this.
   */
  get virtualFolderTerms() {
    return this._virtualFolderTerms;
  },

  /**
   * Set the terms that the user is explicitly searching on.  These will be
   *  augmented with the 'context' search terms potentially provided by
   *  viewTerms and virtualFolderTerms.
   *
   * @param aUserTerms The list of terms.  We take ownership and mutate it.
   */
  set userTerms(aUserTerms) {
    if (aUserTerms)
      this._userTerms = this._groupifyTerms(aUserTerms);
    else
      this._userTerms = null;
    this.owner._applyViewChanges();
  },
  /**
   * @return the user terms currently in effect as set via the |userTerms|
   *     attribute or via the |quickSearch| method.  Do not mutate this.
   */
  get userTerms() {
    return this._userTerms;
  },
  /**
   * Apply a quick-search for the given search mode using the given search
   *  string.  All of the hard work is done by
   *  QuickSearchManager.createSearchTerms; we mainly just assign the result to
   *  our userTerms property.
   *
   * @param aSearchMode One of the QuickSearchConstants.kQuickSearch* search
   *     mode constants specifying what parts of the message to search on.
   * @param aSearchString The search string, consisting of sub-strings delimited
   *     by '|' to be OR-ed together.  Given the string "foo" we search for
   *     messages containing "foo".  Given the string "foo|bar", we search for
   *     messages containing "foo" or "bar".
   */
  quickSearch: function SearchSpec_quickSearch(aSearchMode, aSearchString) {
    this.userTerms = QuickSearchManager.createSearchTerms(
      this.session, aSearchMode, aSearchString);
  },

  clear: function SearchSpec_clear() {
    if (this.hasSearchTerms) {
      this._viewTerms = null;
      this._virtualFolderTerms = null;
      this._userTerms = null;
      this.owner._applyViewChanges();
    }
  },

  get onlineSearch() {
    return this._onlineSearch;
  },
  /**
   * Virtual folders have a concept of 'online search' which affects the logic
   *  in updateSession that builds our search scopes.  If onlineSearch is false,
   *  then when displaying the virtual folder unaffected by mail views or quick
   *  searches, we will most definitely perform an offline search.  If
   *  onlineSearch is true, we will perform an online search only for folders
   *  which are not available offline and for which the server is configured
   *  to have an online 'searchScope'.
   * When mail views or quick searches are in effect our search is always
   *  offline unless the only way to satisfy the needs of the constraints is an
   *  online search (read: the message body is required but not available
   *  offline.)
   */
  set onlineSearch(aOnlineSearch) {
    this._onlineSearch = aOnlineSearch;
  },

  /**
   * Populate the search session using viewTerms, virtualFolderTerms, and
   *  userTerms.  The way this works is that each of the 'context' sets of
   *  terms gets wrapped into a group which is boolean anded together with
   *  everything else.
   */
  updateSession: function SearchSpec_applySearch() {
    let session = this.session;

    // clear out our current terms and scope
    session.searchTerms.QueryInterface(Ci.nsISupportsArray).Clear();
    session.clearScopes();

    // the scope logic needs to know if any terms look at the body attribute.
    let haveBodyTerm = false;

    // -- apply terms
    if (this._virtualFolderTerms) {
      for each (let term in fixIterator(this._virtualFolderTerms,
                                        nsIMsgSearchTerm)) {
        if (term.attrib == nsMsgSearchAttrib.Body)
          haveBodyTerm = true;
        session.appendTerm(term);
      }
    }

    if (this._viewTerms) {
      for each (let term in fixIterator(this._viewTerms,
                                        nsIMsgSearchTerm)) {
        if (term.attrib == nsMsgSearchAttrib.Body)
          haveBodyTerm = true;
        session.appendTerm(term);
      }
    }

    if (this._userTerms) {
      for each (let term in fixIterator(this._userTerms,
                                        nsIMsgSearchTerm)) {
        if (term.attrib == nsMsgSearchAttrib.Body)
          haveBodyTerm = true;
        session.appendTerm(term);
      }
    }

    // -- apply scopes
    // If it is a synthetic view, create a single bogus scope so that we can use
    //  MatchHdr.
    if (this.owner.isSynthetic) {
      // We don't want to pass in a folder, and we don't want to use the
      //  allSearchableGroups scope, so we cheat and use AddDirectoryScopeTerm.
      session.addDirectoryScopeTerm(nsMsgSearchScope.offlineMail);
      return;
    }

    let ioService = Cc["@mozilla.org/network/io-service;1"]
                      .getService(Ci.nsIIOService);
    let validityManager = Cc['@mozilla.org/mail/search/validityManager;1']
                            .getService(Ci.nsIMsgSearchValidityManager);
    for each (let [, folder] in Iterator(this.owner._underlyingFolders)) {
      // we do not need to check isServer here because _underlyingFolders
      //  filtered it out when it was initialized.

      let scope;
      let serverScope = folder.server.searchScope;
      // If we're offline, or this is a local folder, or there's no separate
      //  online scope, use server scope.
      if (ioService.offline || (serverScope == nsMsgSearchScope.offlineMail) ||
                               (folder instanceof nsIMsgLocalMailFolder))
        scope = serverScope;
      else {
        // we need to test the validity in online and offline tables
        let onlineValidityTable = validityManager.getTable(serverScope);

        let offlineScope;
        if (folder.flags & nsMsgFolderFlags.Offline)
          offlineScope = nsMsgSearchScope.offlineMail;
        else
          // The onlineManual table is used for local search when there is no
          //  body available.
          offlineScope = nsMsgSearchScope.onlineManual;

        let offlineValidityTable = validityManager.getTable(offlineScope);
        let offlineAvailable = true;
        let onlineAvailable = true;
        for each (let term in fixIterator(session.searchTerms,
                                          nsIMsgSearchTerm)) {
          if (!term.matchAll) {
            if (!offlineValidityTable.getAvailable(term.attrib, term.op))
              offlineAvailable = false;
            if (!onlineValidityTable.getAvailable(term.attrib, term.op))
              onlineAvailable = false;
          }
        }
        // If both scopes work, honor the onlineSearch request
        if (onlineAvailable && offlineAvailable)
          scope = this.onlineSearch ? serverScope : offlineScope;
        // If only one works, use it. Otherwise, default to offline
        else if (onlineAvailable)
          scope = serverScope;
        else
          scope = offlineScope;
      }
      session.addScopeTerm(scope, folder);
    }
  },

  prettyStringOfSearchTerms: function(aSearchTerms) {
    if (aSearchTerms == null)
      return '      (none)\n';

    let s = '';

    for each (let term in fixIterator(aSearchTerms, nsIMsgSearchTerm)) {
      s += '      ' + term.termAsString + '\n';
    }

    return s;
  },

  prettyString: function() {
    let s = '  Search Terms:\n';
    s += '    Virtual Folder Terms:\n';
    s += this.prettyStringOfSearchTerms(this._virtualFolderTerms);
    s += '    View Terms:\n';
    s += this.prettyStringOfSearchTerms(this._viewTerms);
    s += '    User Terms:\n';
    s += this.prettyStringOfSearchTerms(this._userTerms);
    s += '    Scope (Folders):\n';
    for each (let [, folder] in Iterator(this.owner._underlyingFolders)) {
      s += '      ' + folder.prettyName + '\n';
    }
    return s;
  },
};

/**
 * An nsIMsgSearchNotify listener for searches, primarily to keep the UI
 *  up-to-date.  The db view itself always gets added as a listener and does
 *  the heavy lifting.
 *
 * The one notable thing we do is help single-folder virtual folders out by
 *  tracking and updating their total and unread message counts.  Our logic
 *  is simple and is not clever enough to deal with the user reading messages
 *  as they are displayed.  However, this is not a major issue for single-folder
 *  searches because they should complete very quickly.  (Note: I am documenting
 *  reality here, not implementing and rationalizing.)
 */
function SearchSpecListener(aSearchSpec) {
  this.searchSpec = aSearchSpec;
}
SearchSpecListener.prototype = {
  onNewSearch: function SearchSpecListener_onNewSearch() {
    // searching should already be true by the time this happens.  if it's not,
    //  it means some code is poking at the search session.  bad!
    if (!this.searchSpec.owner.searching) {
      dump("Search originated from unknown initiator! Confusion!\n");
      this.searchSpec.owner.searching = true;
    }

    // we track total/unread messages to help out single-folder virtual folders
    this.totalMessages = 0;
    this.unreadMessages = 0;
  },

  onSearchHit: function SearchSpecListener_onSearchHit(aMsgHdr, aFolder) {
    this.totalMessages++;
    if (!aMsgHdr.isRead)
      this.unreadMessages++;
  },

  onSearchDone: function SearchSpecListener_onSearchDone(aStatus) {
    let viewWrapper = this.searchSpec.owner;
    let folder = viewWrapper.displayedFolder;

    // Save message counts if it's a virtual folder and there are no additional
    //  constraints contaminating the virtual folder results.
    // The old code did this every time, for both cross-folder (multi-folder)
    //  virtual folders and single-folder backed virtual folders.  However,
    //  nsMsgXFVirtualFolderDBView already does this (and does a better job of
    //  it), so we only do this for single virtual folders.
    if (viewWrapper.isVirtual && viewWrapper.isSingleFolder) {
      let msgDatabase = folder.msgDatabase;
      if (msgDatabase) {
        let dbFolderInfo = msgDatabase.dBFolderInfo;
        dbFolderInfo.numUnreadMessages = this.unreadMessages;
        dbFolderInfo.numMessages = this.totalMessages;
        // passing true compels it to use the new message counts we just set.
        // this call also flushes to the folder cache.
        folder.updateSummaryTotals(true);
        const MSG_DB_LARGE_COMMIT = 1;
        msgDatabase.Commit(MSG_DB_LARGE_COMMIT);
      }
    }

    viewWrapper.searching = false;
  },
};

/**
 * Pretend to implement the nsIMsgSearchNotify interface, checking all matches
 *  we are given against the search session on the search spec.  If they pass,
 *  relay them to the underlying db view, otherwise quietly eat them.
 * This is what allows us to use mail-views and quick searches against
 *  gloda-backed searches.
 */
function FilteringSyntheticListener(aSearchSpec) {
  this.searchSpec = aSearchSpec;
  this.session = this.searchSpec.session;
  this.dbView =
    this.searchSpec.owner.dbView.QueryInterface(Ci.nsIMsgSearchNotify);
}
FilteringSyntheticListener.prototype = {
  onNewSearch: function FilteringSyntheticListener_onNewSearch() {
    this.searchSpec.owner.searching = true;
    this.dbView.onNewSearch();
  },
  onSearchHit:
      function FilteringSyntheticListener_onSearchHit(aMsgHdr, aFolder) {
    // We don't need to worry about msgDatabase opening the database.
    // It is (obviously) already open, and presumably gloda is already on the
    //  hook to perform the cleanup (assuming gloda is backing this search).
    if (this.session.MatchHdr(aMsgHdr, aFolder.msgDatabase))
      this.dbView.onSearchHit(aMsgHdr, aFolder);
  },
  onSearchDone: function FilteringSyntheticListener_OnSearchDone(aStatus) {
    this.searchSpec.owner.searching = false;
    this.dbView.onSearchDone(aStatus);
  }
};
