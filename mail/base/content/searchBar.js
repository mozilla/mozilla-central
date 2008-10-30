# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla Communicator client code, released
# March 31, 1998.
#
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 1998-1999
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Seth Spitzer <sspitzer@netscape.com>
#   Scott MacGregor <mscott@mozilla.org>
#   David Bienvenu <bienvenu@nventure.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either of the GNU General Public License Version 2 or later (the "GPL"),
# or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK ***** 

var gSearchSession = null;
var gPreQuickSearchView = null;
var gSearchTimer = null;
var gViewSearchListener;
var gSearchBundle;
var gStatusBar = null;
var gSearchInProgress = false;
var gDefaultSearchViewTerms = null;
var gQSViewIsDirty = false;
var gIgnoreFocus = false;
var gIgnoreClick = false;
var gNumTotalMessages;
var gNumUnreadMessages;

// search criteria mode values 
// Note: If you change these constants, please update the menuitem values in
// quick-search-menupopup. Note: These values are stored in localstore.rdf so we 
// can remember the users last quick search state. If you add values here, you must add
// them to the end of the list!
const kQuickSearchSubject = 0;
const kQuickSearchFrom = 1;
const kQuickSearchFromOrSubject = 2;
const kQuickSearchBody = 3;
// const kQuickSearchHighlight = 4; // * We no longer support this quick search mode..*
const kQuickSearchRecipient = 5;
const kQuickSearchRecipientOrSubject = 6;


function SetQSStatusText(aNumHits)
{
  var statusMsg;
  // if there are no hits, it means no matches were found in the search.
  if (aNumHits == 0)
    statusMsg = gSearchBundle.getString("searchFailureMessage");
  else 
  {
    if (aNumHits == 1) 
      statusMsg = gSearchBundle.getString("searchSuccessMessage");
    else
      statusMsg = gSearchBundle.getFormattedString("searchSuccessMessages", [aNumHits]);
  }

  statusFeedback.showStatusString(statusMsg);
}

// nsIMsgSearchNotify object
var gSearchNotificationListener =
{
    onSearchHit: function(header, folder)
    {
      gNumTotalMessages++;
      if (!header.isRead)
        gNumUnreadMessages++;
        // XXX todo
        // update status text?
    },

    onSearchDone: function(status)
    {
        SetQSStatusText(gDBView.QueryInterface(Components.interfaces.nsITreeView).rowCount)
        statusFeedback.showProgress(0);
        gStatusBar.setAttribute("mode","normal");
        gSearchInProgress = false;

        // ### TODO need to find out if there's quick search within a virtual folder.
        if (gCurrentVirtualFolderUri &&
         (!gSearchInput || gSearchInput.value == "" || gSearchInput.showingSearchCriteria))
        {
          var vFolder = GetMsgFolderFromUri(gCurrentVirtualFolderUri, false);
          var dbFolderInfo = vFolder.getMsgDatabase(msgWindow).dBFolderInfo;
          dbFolderInfo.numUnreadMessages = gNumUnreadMessages;
          dbFolderInfo.numMessages = gNumTotalMessages;
          vFolder.updateSummaryTotals(true); // force update from db.
          var msgdb = vFolder.getMsgDatabase(msgWindow);
          const MSG_DB_LARGE_COMMIT = 1;
          msgdb.Commit(MSG_DB_LARGE_COMMIT);
          // now that we have finished loading a virtual folder,
          // scroll to the correct message if there is at least one.
          if (vFolder.getTotalMessages(false) > 0)
            ScrollToMessageAfterFolderLoad(vFolder);
        }
    },

    onNewSearch: function()
    {
      statusFeedback.showProgress(0);
      statusFeedback.showStatusString(gSearchBundle.getString("searchingMessage"));
      gStatusBar.setAttribute("mode","undetermined");
      gSearchInProgress = true;
      gNumTotalMessages = 0; 
      gNumUnreadMessages = 0;
    }
}

function getDocumentElements()
{
  gSearchBundle = document.getElementById("bundle_search");  
  gStatusBar = document.getElementById('statusbar-icon');
  GetSearchInput();
}

function addListeners()
{
  gViewSearchListener = gDBView.QueryInterface(Components.interfaces.nsIMsgSearchNotify);
  gSearchSession.registerListener(gViewSearchListener);
}

function removeListeners()
{
  gSearchSession.unregisterListener(gViewSearchListener);
}

function removeGlobalListeners()
{
  removeListeners();
  gSearchSession.unregisterListener(gSearchNotificationListener); 
}

function initializeGlobalListeners()
{
  // Setup the javascript object as a listener on the search results
  gSearchSession.registerListener(gSearchNotificationListener);
}

function createQuickSearchView()
{
  //if not already in quick search view 
  if (gDBView.viewType != nsMsgViewType.eShowQuickSearchResults)  
  {
    var treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);  //clear selection
    if (treeView && treeView.selection)
      treeView.selection.clearSelection();
    gPreQuickSearchView = gDBView;
    if (gDBView.viewType == nsMsgViewType.eShowVirtualFolderResults)
    {
      // remove the view as a listener on the search results
      var saveViewSearchListener = gDBView.QueryInterface(Components.interfaces.nsIMsgSearchNotify);
      gSearchSession.unregisterListener(saveViewSearchListener);
    }
    var viewFlags = gDBView.viewFlags;
    CreateDBView(gDBView.msgFolder, (gXFVirtualFolderTerms) ? nsMsgViewType.eShowVirtualFolderResults : nsMsgViewType.eShowQuickSearchResults, viewFlags, gDBView.sortType, gDBView.sortOrder);
  }
}

function initializeSearchBar()
{
   createQuickSearchView();
   if (!gSearchSession)
   {
     getDocumentElements();
     var searchSessionContractID = "@mozilla.org/messenger/searchSession;1";
     gSearchSession = Components.classes[searchSessionContractID].createInstance(Components.interfaces.nsIMsgSearchSession);
     initializeGlobalListeners();
   }
   else
   {
     if (gSearchInProgress)
     {
       onSearchStop();
       gSearchInProgress = false;
     }
     removeListeners();
   }
   addListeners();
}

function onEnterInSearchBar()
{
   if (!gSearchInput || gSearchInput.value == "" || gSearchInput.showingSearchCriteria) 
   { 
     if (gDBView.viewType == nsMsgViewType.eShowQuickSearchResults 
        || gDBView.viewType == nsMsgViewType.eShowVirtualFolderResults)
     {
       statusFeedback.showStatusString("");

       viewDebug ("onEnterInSearchBar gDefaultSearchViewTerms = " + gDefaultSearchViewTerms + "gVirtualFolderTerms = " 
        + gVirtualFolderTerms + "gXFVirtualFolderTerms = " + gXFVirtualFolderTerms + "\n");
       var addTerms = gDefaultSearchViewTerms || gVirtualFolderTerms || gXFVirtualFolderTerms;
       if (addTerms)
       {
           viewDebug ("addTerms = " + addTerms + " count = " + addTerms.Count() + "\n");
           initializeSearchBar();
           onSearch(addTerms);
       }
       else
        restorePreSearchView();
     }
     else if (gPreQuickSearchView && !gDefaultSearchViewTerms)// may be a quick search from a cross-folder virtual folder
      restorePreSearchView();
     
     if (gSearchInput)
       gSearchInput.showingSearchCriteria = true;
   
     gQSViewIsDirty = false;
     return;
   }

   initializeSearchBar();

   ClearThreadPaneSelection();
   ClearMessagePane();

   onSearch(null);
   gQSViewIsDirty = false;
}

function restorePreSearchView()
{
  var selectedHdr = null;
  //save selection
  try 
  {
    selectedHdr = gDBView.hdrForFirstSelectedMessage;
  }
  catch (ex)
  {}

  //we might have to sort the view coming out of quick search
  var sortType = gDBView.sortType;
  var sortOrder = gDBView.sortOrder;
  var viewFlags = gDBView.viewFlags;
  var folder = gDBView.msgFolder;

  gDBView.close();
  gDBView = null; 

  if (gPreQuickSearchView)
  {
    gDBView = gPreQuickSearchView;
    if (gDBView.viewType == nsMsgViewType.eShowVirtualFolderResults)
    {
      // read the view as a listener on the search results
      var saveViewSearchListener = gDBView.QueryInterface(Components.interfaces.nsIMsgSearchNotify);
      if (gSearchSession)
        gSearchSession.registerListener(saveViewSearchListener);
    }
//    dump ("view type = " + gDBView.viewType + "\n");

    if (sortType != gDBView.sortType || sortOrder != gDBView.sortOrder)
    {
      gDBView.sort(sortType, sortOrder);
    }
    UpdateSortIndicators(sortType, sortOrder);

    gPreQuickSearchView = null;    
  }
  else //create default view type
  {
    CreateDBView(folder, nsMsgViewType.eShowAllThreads, viewFlags, sortType, sortOrder);
  }

  RerootThreadPane();
   
  var scrolled = false;
  
  // now restore selection
  if (selectedHdr)
  {
    gDBView.selectMsgByKey(selectedHdr.messageKey);
    var treeView = gDBView.QueryInterface(Components.interfaces.nsITreeView);
    var selectedIndex = treeView.selection.currentIndex;
    if (selectedIndex >= 0) 
    {
      // scroll
      EnsureRowInThreadTreeIsVisible(selectedIndex);
      scrolled = true;
    }
    else
      ClearMessagePane();
  }

  if (!scrolled)
    ScrollToMessageAfterFolderLoad(null);
}

function onSearch(aSearchTerms)
{
    viewDebug("in OnSearch, searchTerms = " + aSearchTerms + "\n");
    RerootThreadPane();

    if (aSearchTerms)
      createSearchTermsWithList(aSearchTerms);
    else
      createSearchTerms();

    gDBView.searchSession = gSearchSession;
    try
    {
      gSearchSession.search(msgWindow);
    }
    catch(ex)
    {
      dump("Search Exception\n");
    }
}

function createSearchTermsWithList(aTermsArray)
{
  var nsMsgSearchScope = Components.interfaces.nsMsgSearchScope;
  var nsMsgSearchAttrib = Components.interfaces.nsMsgSearchAttrib;
  var nsMsgSearchOp = Components.interfaces.nsMsgSearchOp;

  gSearchSession.clearScopes();
  var searchTerms = gSearchSession.searchTerms;
  var searchTermsArray = searchTerms.QueryInterface(Components.interfaces.nsISupportsArray);
  searchTermsArray.Clear();

  var i;
  var selectedFolder = GetThreadPaneFolder();
  var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                  .getService(Components.interfaces.nsIIOService);
  
  var termsArray = aTermsArray.QueryInterface(Components.interfaces.nsISupportsArray);

  if (gXFVirtualFolderTerms)
  {
    var msgDatabase = selectedFolder.getMsgDatabase(msgWindow);
    if (msgDatabase)
    {
      var dbFolderInfo = msgDatabase.dBFolderInfo;
      var srchFolderUri = dbFolderInfo.getCharProperty("searchFolderUri");
      viewDebug("createSearchTermsWithList xf vf scope = " + srchFolderUri + "\n");
      var srchFolderUriArray = srchFolderUri.split('|');
      for (i in srchFolderUriArray) 
      {
        var realFolder = GetMsgFolderFromUri(srchFolderUriArray[i]);
        if (!realFolder.isServer)
          gSearchSession.addScopeTerm(getScopeToUse(termsArray, realFolder, ioService.offline), realFolder);
      }
    }
  }
  else
  {
    viewDebug ("in createSearchTermsWithList, adding scope term for selected folder\n");
    gSearchSession.addScopeTerm(getScopeToUse(termsArray, selectedFolder, ioService.offline), selectedFolder);
  }

  // add each item in termsArray to the search session
  for (i = 0; i < termsArray.Count(); ++i)
    gSearchSession.appendTerm(termsArray.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgSearchTerm));
}

function getScopeToUse(aTermsArray, aFolderToSearch, aIsOffline)
{
  if (aIsOffline || aFolderToSearch.server.type != 'imap')
    return nsMsgSearchScope.offlineMail;

  var scopeToUse = gSearchInput && gSearchInput.searchMode == kQuickSearchBody && !gSearchInput.showingSearchCriteria
                   ? nsMsgSearchScope.onlineMail : nsMsgSearchScope.offlineMail;

  // it's possible one of our search terms may require us to use an online mail scope (such as imap body searches)
  for (var i = 0; scopeToUse != nsMsgSearchScope.onlineMail && i < aTermsArray.Count(); i++)
    if (aTermsArray.GetElementAt(i).QueryInterface(Components.interfaces.nsIMsgSearchTerm).attrib == nsMsgSearchAttrib.Body)
      scopeToUse = nsMsgSearchScope.onlineMail;
  
  return scopeToUse;
}

function createSearchTerms()
{
  var nsMsgSearchScope = Components.interfaces.nsMsgSearchScope;
  var nsMsgSearchAttrib = Components.interfaces.nsMsgSearchAttrib;
  var nsMsgSearchOp = Components.interfaces.nsMsgSearchOp;

  // create an i supports array to store our search terms 
  var searchTermsArray = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
  var selectedFolder = GetThreadPaneFolder();

  // implement | for QS
  // does this break if the user types "foo|bar" expecting to see subjects with that string?
  // I claim no, since "foo|bar" will be a hit for "foo" || "bar"
  // they just might get more false positives
  if (!gSearchInput.showingSearchCriteria) // ignore the text box value if it's just showing the search criteria string
  {
    var termList = gSearchInput.value.split("|");
    for (var i = 0; i < termList.length; i ++)
    {
      // if the term is empty, skip it
      if (termList[i] == "")
        continue;

      // create, fill, and append the subject term
      var term;
      var value;

      // if our search criteria is subject or subject|from then add a term for the subject
      if (gSearchInput.searchMode == kQuickSearchSubject ||
          gSearchInput.searchMode == kQuickSearchFromOrSubject ||
          gSearchInput.searchMode == kQuickSearchRecipientOrSubject)
      {
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.Subject;
        term.op = nsMsgSearchOp.Contains;
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);
      }

      if (gSearchInput.searchMode == kQuickSearchBody)
      {
        // what do we do for news and imap users that aren't configured for offline use?
        // in these cases the body search will never return any matches. Should we try to 
        // see if body is a valid search scope in this particular case before doing the search?
        // should we switch back to a subject/from search behind the scenes?
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.Body;
        term.op = nsMsgSearchOp.Contains; 
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);       
      }

      // create, fill, and append the from (or recipient) term
      if (gSearchInput.searchMode == kQuickSearchFrom || gSearchInput.searchMode == kQuickSearchFromOrSubject)
      {
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.Sender;
        term.op = nsMsgSearchOp.Contains; 
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);
      }

      // create, fill, and append the recipient
      if (gSearchInput.searchMode == kQuickSearchRecipient ||
          gSearchInput.searchMode == kQuickSearchRecipientOrSubject)
      {
        term = gSearchSession.createTerm();
        value = term.value;
        value.str = termList[i];
        term.value = value;
        term.attrib = nsMsgSearchAttrib.ToOrCC;
        term.op = nsMsgSearchOp.Contains; 
        term.booleanAnd = false;
        searchTermsArray.AppendElement(term);
      }
    }
  }

  // now append the default view or virtual folder criteria to the quick search   
  // so we don't lose any default view information
  viewDebug("gDefaultSearchViewTerms = " + gDefaultSearchViewTerms + "gVirtualFolderTerms = " + gVirtualFolderTerms + 
    "gXFVirtualFolderTerms = " + gXFVirtualFolderTerms + "\n");
  var defaultSearchTerms = (gDefaultSearchViewTerms || gVirtualFolderTerms || gXFVirtualFolderTerms);
  if (defaultSearchTerms)
  {
    var isupports = null;
    var searchTerm; 
    var termsArray = defaultSearchTerms.QueryInterface(Components.interfaces.nsISupportsArray);
    for (i = 0; i < termsArray.Count(); i++)
    {
      isupports = termsArray.GetElementAt(i);
      searchTerm = isupports.QueryInterface(Components.interfaces.nsIMsgSearchTerm);
      searchTermsArray.AppendElement(searchTerm);
    }
  }
  
  createSearchTermsWithList(searchTermsArray);
  
  // now that we've added the terms, clear out our input array
  searchTermsArray.Clear();
}

function onSearchStop() 
{
  gSearchSession.interruptSearch();
}

function onSearchKeyPress()
{
  if (gSearchInput.showingSearchCriteria)
    gSearchInput.showingSearchCriteria = false;
}

function onSearchInputFocus(event)
{
  GetSearchInput();
  // search bar has focus, ...clear the showing search criteria flag
  if (gSearchInput.showingSearchCriteria)
  {
    gSearchInput.value = "";
    gSearchInput.showingSearchCriteria = false;
  }
  
  if (gIgnoreFocus) // got focus via mouse click, don't need to anything else
    gIgnoreFocus = false;
  else
    gSearchInput.select();
}

function onSearchInputMousedown(event)
{
  GetSearchInput();
  if (gSearchInput.hasAttribute("focused")) 
    // If the search input is focused already, ignore the click so that
    // onSearchInputBlur does nothing.
    gIgnoreClick = true;
  else 
  {
    gIgnoreFocus = true;
    gIgnoreClick = false;
  }
}

function onSearchInputClick(event)
{
  if (!gIgnoreClick)
    // Triggers onSearchInputBlur(), but focus returns to field.
    gSearchInput.select();
}

function onSearchInputBlur(event)
{
  // If we're doing something else, don't process the blur.
  if (gIgnoreClick)
    return;

  if (!gSearchInput.value)
    gSearchInput.showingSearchCriteria = true;

  if (gSearchInput.showingSearchCriteria)
    gSearchInput.setSearchCriteriaText();
}

function onClearSearch()
{
  // If we're not showing search criteria, then we need to clear up.
  if (!gSearchInput.showingSearchCriteria)
  {
    Search("");
    // Hide the clear button
    gSearchInput.clearButtonHidden = true;
    gIgnoreClick = true;
    gSearchInput.select();
    gIgnoreClick = false;
  }
}

// called from commandglue.js in cases where the view is being changed and QS
// needs to be cleared.
function ClearQSIfNecessary()
{
  if (!gSearchInput || gSearchInput.showingSearchCriteria)
    return;
  gSearchInput.setSearchCriteriaText();
}

function Search(str)
{
  viewDebug("in Search str = " + str + "gSearchInput.showingSearchCriteria = " + gSearchInput.showingSearchCriteria + "\n");
  if (gSearchInput.showingSearchCriteria && str != "")
    return;

  if (str != gSearchInput.value)
  {
    gQSViewIsDirty = true; 
    viewDebug("in Search(), setting gQSViewIsDirty true\n");
  }

  gSearchInput.value = str;  //on input does not get fired for some reason
  onEnterInSearchBar();
}

// helper methods for the quick search drop down menu
function changeQuickSearchMode(aMenuItem)
{
  viewDebug("changing quick search mode\n");
  // extract the label and set the search input to match it
  var oldSearchMode = gSearchInput.searchMode;
  gSearchInput.searchMode = aMenuItem.value;

  if (gSearchInput.value == "" || gSearchInput.showingSearchCriteria)
  {
    gSearchInput.showingSearchCriteria = true;
    if (gSearchInput.value) // 
      gSearchInput.setSearchCriteriaText();
  }
  
  // if the search box is empty, set showing search criteria to true so it shows up when focus moves out of the box
  if (!gSearchInput.value)   
    gSearchInput.showingSearchCriteria = true;
  else if (gSearchInput.showingSearchCriteria) // if we are showing criteria text and the box isn't empty, change the criteria text
    gSearchInput.setSearchCriteriaText();     
  else if (oldSearchMode != gSearchInput.searchMode) // the search mode just changed so we need to redo the quick search
    onEnterInSearchBar();
}

function saveViewAsVirtualFolder()
{
  openNewVirtualFolderDialogWithArgs(gSearchInput.value, gSearchSession.searchTerms);
}

function InitQuickSearchPopup()
{
  // disable the create virtual folder menu item if the current radio
  // value is set to Find in message since you can't really  create a VF from find
  // in message
  
  GetSearchInput();  
  if (!gSearchInput ||gSearchInput.value == "" || gSearchInput.showingSearchCriteria)
    document.getElementById('quickSearchSaveAsVirtualFolder').setAttribute('disabled', 'true');
  else
    document.getElementById('quickSearchSaveAsVirtualFolder').removeAttribute('disabled');
}

/**
 * If switching from an "incoming" (Inbox, etc.) type of mail folder,
 * to an "outbound" (Sent, Drafts etc.)  type, and the current search
 * type contains 'Sender', then switch it to the equivalent
 * 'Recipient' search type by default. Vice versa when switching from
 * outbound to incoming folder type.
 * @param isOutboundFolder  Bool
 *        true:  switch from an incoming to an outgoing folder
 *        false: switch from an outgoing to an incoming folder
 */
function onSearchFolderTypeChanged(isOutboundFolder)
{
  var quickSearchMenu = document.getElementById('quick-search-menupopup');
  var newSearchType;
  var oldSearchMode;

  GetSearchInput();

  if (!gSearchInput)
    return;

  if (isOutboundFolder)
  {
    if (gSearchInput.searchMode == kQuickSearchFromOrSubject)
      newSearchType = kQuickSearchRecipientOrSubject;
    else if (gSearchInput.searchMode == kQuickSearchFrom)
      newSearchType = kQuickSearchRecipient;
    else
      return;
  }
  else
  {
    if (gSearchInput.searchMode == kQuickSearchRecipientOrSubject)
      newSearchType = kQuickSearchFromOrSubject;
    else if (gSearchInput.searchMode == kQuickSearchRecipient)
      newSearchType = kQuickSearchFrom;
    else
      return;
  }
  var newMenuItem = quickSearchMenu.getElementsByAttribute('value', newSearchType).item(0);
  if (newMenuItem)
  {
    // If a menu item is already checked, need to uncheck it first:
    var checked = quickSearchMenu.getElementsByAttribute('checked', 'true').item(0);
    if (checked)
      checked.setAttribute('checked', 'false');
    changeQuickSearchMode(newMenuItem);
    newMenuItem.setAttribute('checked', 'true');
  }
}
