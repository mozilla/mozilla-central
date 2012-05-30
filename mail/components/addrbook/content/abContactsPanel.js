/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
  var searchInput = document.getElementById("peopleSearchInput");
  if (searchInput.value && !searchInput.showingSearchCriteria)
    onEnterInSearchBar();
  else 
    ChangeDirectoryByURI(document.getElementById('addressbookList').value);
}

function AbPanelOnComposerClose()
{
  CloseAbView();
  onAbClearSearch();
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
    gQueryURIFormat = Services.prefs.getComplexValue("mail.addr_book.quicksearchquery.format",
      Components.interfaces.nsIPrefLocalizedString).data;

  var searchURI = GetSelectedDirectory();
  var searchInput = document.getElementById("peopleSearchInput");

  if (searchInput.value != "")
    searchURI += gQueryURIFormat.replace(/@V/g, encodeURIComponent(searchInput.value));

  SetAbView(searchURI);
}
