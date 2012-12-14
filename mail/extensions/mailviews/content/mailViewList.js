/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

var gMailListView; 
var gListBox; 
var gEditButton;
var gDeleteButton;

function mailViewListOnLoad()
{
  gMailListView = Components.classes["@mozilla.org/messenger/mailviewlist;1"].getService(Components.interfaces.nsIMsgMailViewList);; 
  gListBox = document.getElementById('mailViewList');

  // Construct list view based on current mail view list data
  refreshListView(null);
  gEditButton = document.getElementById('editButton');
  gDeleteButton = document.getElementById('deleteButton');

  updateButtons();
}

function refreshListView(aSelectedMailView)
{
  // remove any existing items in the view...
  for (var index = gListBox.getRowCount(); index > 0; index--)
    gListBox.removeChild(gListBox.getItemAtIndex(index - 1));

  var numItems = gMailListView.mailViewCount;
  var mailView; 
  for (index = 0; index < numItems; index++)
  {
    mailView = gMailListView.getMailViewAt(index);
    gListBox.appendItem(mailView.prettyName, index);
    if (aSelectedMailView && (mailView.prettyName == aSelectedMailView.prettyName) )
      gListBox.selectedIndex = index;
  }
}

function onNewMailView()
{
   window.openDialog('chrome://messenger/content/mailViewSetup.xul', "", 'centerscreen,resizable,modal,titlebar,chrome', {onOkCallback: refreshListView});
}

function onDeleteMailView()
{  
  var bundle = Services.strings.createBundle("chrome://messenger/locale/messenger.properties");

  if (!Services.prompt.confirm(window, bundle.GetStringFromName("confirmViewDeleteTitle"), bundle.GetStringFromName("confirmViewDeleteMessage")))
    return;

  // get the selected index
  var selectedIndex = gListBox.selectedIndex;
  if (selectedIndex >= 0)
  {
    var mailView = gMailListView.getMailViewAt(selectedIndex);
    if (mailView)
    {
      gMailListView.removeMailView(mailView);
      // now remove it from the view...
      gListBox.removeChild(gListBox.selectedItem);

      // select the next item in the list..
      if (selectedIndex < gListBox.getRowCount())
        gListBox.selectedIndex = selectedIndex;
      else
        gListBox.selectedIndex = gListBox.getRowCount() - 1;

      gMailListView.save();
    }
  }
}

function onEditMailView()
{
  // get the selected index
  var selectedIndex = gListBox.selectedIndex;
  if (selectedIndex >= 0)
  {
    var selMailView = gMailListView.getMailViewAt(selectedIndex);
    // open up the mail view setup dialog passing in the mail view as an argument....

    var args = {mailView: selMailView, onOkCallback: refreshListView};

    window.openDialog('chrome://messenger/content/mailViewSetup.xul', "", 'centerscreen,modal,resizable,titlebar,chrome', args);
  }
}

function onMailViewSelect(event)
{
  updateButtons();
}

function updateButtons()
{
  var selectedIndex = gListBox.selectedIndex;
  // "edit" and "delete" only enabled when one filter selected
  gEditButton.disabled = selectedIndex < 0;
  gDeleteButton.disabled = selectedIndex < 0;
}
