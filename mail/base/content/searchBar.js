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

Components.utils.import("resource://app/modules/quickSearchManager.js");

var gSearchBundle;
var gStatusBar = null;
var gIgnoreFocus = false;
var gIgnoreClick = false;

// change/add constants in QuickSearchConstants in quickSearchManager.js first
// ideally these should go away in favor of everyone using QuickSearchConstants
const kQuickSearchSubject = QuickSearchConstants.kQuickSearchSubject;
const kQuickSearchFrom = QuickSearchConstants.kQuickSearchFrom;
const kQuickSearchFromOrSubject =
  QuickSearchConstants.kQuickSearchFromOrSubject;
const kQuickSearchBody = QuickSearchConstants.kQuickSearchBody;
const kQuickSearchRecipient = QuickSearchConstants.kQuickSearchRecipient;
const kQuickSearchRecipientOrSubject =
  QuickSearchConstants.kQuickSearchRecipientOrSubject;


/**
 * We are exclusively concerned with disabling the quick-search box when a
 *  tab is being displayed that lacks quick search abilities.
 */
var QuickSearchTabMonitor = {
  onTabTitleChanged: function() {
  },

  onTabSwitched: function (aTab, aOldTab) {
    let searchInput = document.getElementById("searchInput");

    if (searchInput) {
      let newTabEligible = aTab.mode.tabType == mailTabType;
      searchInput.disabled = !newTabEligible;
      if (!newTabEligible)
        searchInput.value = "";
    }
  },
};


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

function getDocumentElements()
{
  gSearchBundle = document.getElementById("bundle_search");
  gStatusBar = document.getElementById('statusbar-icon');
  GetSearchInput();
}

function onEnterInSearchBar()
{
  if (!gSearchInput)
    return;

  // nothing changes while showing the criteria
  if (gSearchInput.showingSearchCriteria)
    return;

  if (!gSearchInput || gSearchInput.value == "")
     gFolderDisplay.view.search.userTerms = null;
  else
     gFolderDisplay.view.search.quickSearch(gSearchInput.searchMode,
                                            gSearchInput.value);
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
  if (gSearchInput.showingSearchCriteria && str != "")
    return;

  gSearchInput.value = str;  //on input does not get fired for some reason
  onEnterInSearchBar();
}

// helper methods for the quick search drop down menu
function changeQuickSearchMode(aMenuItem)
{
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
  gFolderTreeController.newVirtualFolder(gSearchInput.value,
                                         gSearchSession.searchTerms);
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
