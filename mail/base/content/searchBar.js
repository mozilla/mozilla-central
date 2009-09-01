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

Components.utils.import("resource://app/modules/quickSearchManager.js");


var gSearchBundle;

var gStatusBar = null;

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
      let newTabEligible = ((aTab.mode.tabType == mailTabType) ||
                            (aTab.mode.tabType == glodaFacetTabType));
      searchInput.disabled = !newTabEligible;
      if (!newTabEligible)
        searchInput.value = "";
    }
  }
};


// XXX never called?
function SetQSStatusText(aNumHits)
{
  var statusMsg;
  gSearchBundle = document.getElementById("bundle_search");
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
    if (gSearchInput.searchMode == QuickSearchConstants.kQuickSearchFromOrSubject)
      newSearchType = QuickSearchConstants.kQuickSearchRecipientOrSubject;
    else if (gSearchInput.searchMode == QuickSearchConstants.kQuickSearchFrom)
      newSearchType = QuickSearchConstants.kQuickSearchRecipient;
    else
      return;
  }
  else
  {
    if (gSearchInput.searchMode == QuickSearchConstants.kQuickSearchRecipientOrSubject)
      newSearchType = QuickSearchConstants.kQuickSearchFromOrSubject;
    else if (gSearchInput.searchMode == QuickSearchConstants.kQuickSearchRecipient)
      newSearchType = QuickSearchConstants.kQuickSearchFrom;
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
