/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function openNewCardDialog()
{
  window.openDialog("chrome://messenger/content/addressbook/abNewCardDialog.xul",
                    "", "chrome,modal,resizable=no,centerscreen");
}

function goOpenNewMessage()
{
  // if there is a MsgNewMessage function in scope
  // and we should use it, so that we choose the proper
  // identity, based on the selected message or folder
  // if not, bring up the compose window to the default identity
  if ("MsgNewMessage" in window)
  {
    MsgNewMessage(null);
    return;
  }

  Components.classes["@mozilla.org/messengercompose;1"]
            .getService(Components.interfaces.nsIMsgComposeService)
            .OpenComposeWindow(null, null, null,
                               Components.interfaces.nsIMsgCompType.New,
                               Components.interfaces.nsIMsgCompFormat.Default,
                               null, null);
}
