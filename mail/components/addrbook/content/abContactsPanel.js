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
 * The Original Code is Mozilla addressbook.
 *
 * The Initial Developer of the Original Code is
 * Seth Spitzer <sspitzer@netscape.com>.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

function GetAbViewListener()
{
  // the ab panel doesn't care if the total changes, or if the selection changes
  return null;
}


function contactsListOnClick(event)
{
  // we only care about button 0 (left click) events
  if (event.button != 0)
    return;

  var target = event.originalTarget;
  if (target.localName == "treecol") {
    var sortDirection = target.getAttribute("sortDirection") == kDefaultDescending ?
                        kDefaultAscending : kDefaultDescending;
    SortAndUpdateIndicators(target.id, sortDirection);
  }
  else if (target.localName == "treechildren" && event.detail == 2) {
    var contactsTree = document.getElementById("abResultsTree");
    var row = contactsTree.treeBoxObject.getRowAt(event.clientX, event.clientY);
    if (row == -1 || row > contactsTree.view.rowCount-1)
      // double clicking on a non valid row should not add any entry
      return;

    // ok, go ahead and add the entry
    addSelectedAddresses('addr_to');
  }
}

function addSelectedAddresses(recipientType)
{
  var cards = GetSelectedAbCards();
  var count = cards.length;
 

  for (var i = 0; i < count; i++) 
  {
    // turn each card into a properly formatted address 
    var address = GenerateAddressFromCard(cards[i]);
    if (address != "")
      parent.AddRecipient(recipientType, address);     
  }
}

function AddressBookMenuListChange()
{
  if (gSearchInput.value && !gSearchInput.showingSearchCriteria) 
    onEnterInSearchBar();
  else 
    ChangeDirectoryByURI(document.getElementById('addressbookList').value);
}

function AbPanelOnComposerClose()
{
  CloseAbView();
  onClearSearch();
}

function AbPanelOnComposerReOpen()
{
  SetAbView(GetSelectedDirectory());
}

function AbPanelLoad() 
{
  InitCommonJS();

  document.title = parent.document.getElementById("sidebar-title").value;

  var abPopup = document.getElementById('addressbookList');

  // Reselect the persisted address book if possible, if not just select the
  // first in the list.
  var temp = abPopup.value;
  abPopup.selectedItem = null;
  abPopup.value = temp;
  if (!abPopup.selectedItem)
    abPopup.selectedIndex = 0;

  ChangeDirectoryByURI(abPopup.value);

  parent.addEventListener("compose-window-close", AbPanelOnComposerClose, true);
  parent.addEventListener("compose-window-reopen", AbPanelOnComposerReOpen, true);
  gSearchInput = document.getElementById("searchInput");
}

function AbPanelUnload()
{
  parent.removeEventListener("compose-window-close", AbPanelOnComposerClose, true);
  parent.removeEventListener("compose-window-reopen", AbPanelOnComposerReOpen, true);

  CloseAbView();
}

function AbPanelNewCard() 
{
  goNewCardDialog(abList.value);
}

function AbPanelNewList() 
{
  goNewListDialog(abList.value);
}

function ResultsPaneSelectionChanged() 
{
  // do nothing for ab panel
}

function OnClickedCard() 
{
  // do nothing for ab panel
}

function AbResultsPaneDoubleClick(card) 
{
  // double click for ab panel means "send mail to this person / list"
  AbNewMessage();
}

function UpdateCardView() 
{
  // do nothing for ab panel
}

function onEnterInSearchBar()
{
  if (!gQueryURIFormat) 
    gQueryURIFormat = gPrefs.getComplexValue("mail.addr_book.quicksearchquery.format", 
                                              Components.interfaces.nsIPrefLocalizedString).data;
 
  var searchURI = GetSelectedDirectory();

  if (gSearchInput.value != "")
    searchURI += gQueryURIFormat.replace(/@V/g, encodeURIComponent(gSearchInput.value));

  SetAbView(searchURI);
}
