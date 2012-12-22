/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gIsMsgCompose = false;

function GetAbViewListener()
{
  // the ab panel doesn't care if the total changes, or if the selection changes
  return null;
}

function AbPanelLoad() 
{
  InitCommonJS(); 

  UpgradeAddressBookResultsPaneUI("mailnews.ui.addressbook_panel_results.version");

  var abPopup = document.getElementById('addressbookList');

  // Reselect the persisted address book if possible, if not just select the
  // first in the list.
  var temp = abPopup.value;
  abPopup.selectedItem = null;
  abPopup.value = temp;
  if (!abPopup.selectedItem)
    abPopup.selectedIndex = 0;

  ChangeDirectoryByURI(abPopup.value);

  gSearchInput = document.getElementById("searchInput");

  // for the compose window we want to show To, Cc, Bcc and a separator
  // for all other windows we want to show Compose Mail To
  var popup = document.getElementById("composeMail");
  gIsMsgCompose = parent.document
                        .documentElement
                        .getAttribute("windowtype") == "msgcompose";
  for (var i = 0; i < 4; i++)
    popup.childNodes[i].hidden = !gIsMsgCompose;
  popup.childNodes[4].hidden = gIsMsgCompose;

  if (gIsMsgCompose)
    parent.addEventListener("compose-window-close", onAbClearSearch, true);
}

function AbPanelUnload()
{
  if (gIsMsgCompose)
    parent.removeEventListener("compose-window-close", onAbClearSearch, true);

  CloseAbView();
}

function onAbClearSearch()
{
  gSearchInput.value = "";
  onEnterInSearchBar();
}

function AbPanelAdd(addrtype)
{
  var cards = GetSelectedAbCards();
  var count = cards.length;

  for (var i = 0; i < count; i++) {
    // turn each card into a properly formatted address
    var address = GenerateAddressFromCard(cards[i]);
    if (address)
      top.awAddRecipient(addrtype, address);
    else
      Services.prompt.alert(window,
                            gAddressBookBundle.getString("emptyEmailAddCardTitle"),
                            gAddressBookBundle.getString("emptyEmailAddCard"));
  }
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
  if (gIsMsgCompose)
    AbPanelAdd('addr_to');
  else
    AbNewMessage();
}

function UpdateCardView() 
{
  // do nothing for ab panel
}
