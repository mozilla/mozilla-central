/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/MailUtils.js");

var gMessengerBundle;

// call this from dialog onload() to set the menu item to the correct value
function MsgFolderPickerOnLoad(pickerID)
{
	var uri = null;
	try { 
		uri = window.arguments[0].preselectedURI;
	}
	catch (ex) {
		uri = null;
	}

	if (uri) {
		//dump("on loading, set titled button to " + uri + "\n");

		// verify that the value we are attempting to
		// pre-flight the menu with is valid for this
		// picker type
		var msgfolder = MailUtils.getFolderForURI(uri, true);
        	if (!msgfolder) return; 
		
		var verifyFunction = null;

		switch (pickerID) {
			case "msgNewFolderPicker":
				verifyFunction = msgfolder.canCreateSubfolders;
				break;
			case "msgRenameFolderPicker":
				verifyFunction = msgfolder.canRename;
				break;
			default:
				verifyFunction = msgfolder.canFileMessages;
				break;
		}

		if (verifyFunction) {
			SetFolderPicker(uri,pickerID);
		}
	}
}

function PickedMsgFolder(selection,pickerID)
{
  var selectedUri = selection.getAttribute('id');
  SetFolderPicker(selectedUri,pickerID);
}     

function SetFolderPickerElement(uri, picker)
{
  var msgfolder = MailUtils.getFolderForURI(uri, true);

  if (!msgfolder) 
    return;

  var selectedValue = null;
  var serverName;

  if (msgfolder.isServer)
    selectedValue = msgfolder.name;
  else {
    if (msgfolder.server)
      serverName = msgfolder.server.prettyName;
    else {
     dump("Can't find server for " + uri + "\n");
     serverName = "???";
    }

  switch (picker.id) {
    case "runFiltersFolder":
      selectedValue = msgfolder.name;
      break;
    case "msgTrashFolderPicker":
      selectedValue = msgfolder.name;
      break;
    default:
      if (!gMessengerBundle)
        gMessengerBundle = document.getElementById("bundle_messenger");
      selectedValue = gMessengerBundle.getFormattedString("verboseFolderFormat",
        [msgfolder.name, serverName]);
      break;
    }
  }

  picker.setAttribute("label",selectedValue);
  picker.setAttribute("uri",uri);
}

function SetFolderPicker(uri,pickerID)
{
  SetFolderPickerElement(uri, document.getElementById(pickerID));
}
