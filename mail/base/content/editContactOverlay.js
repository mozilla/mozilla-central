/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is Thunderbird Inline Edit Contact Panel.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark Banner <bugzilla@standard8.plus.com>
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

var editContactInlineUI = {
  _overlayLoaded: false,
  _overlayLoading: false,
  _cardDetails: null,
  _writeable: true,
  _blockedCommands: ["cmd_close"],

  _blockCommands: function () {
    for (var i = 0; i < this._blockedCommands; ++i) {
      var elt = document.getElementById(this._blockedCommands[i]);
      // make sure not to permanetly disable this item
      if (elt.hasAttribute("wasDisabled"))
        continue;

      if (elt.getAttribute("disabled") == "true")
        elt.setAttribute("wasDisabled", "true");
      else {
        elt.setAttribute("wasDisabled", "false");
        elt.setAttribute("disabled", "true");
      }
    }
  },

  _restoreCommandsState: function () {
    for (var i = 0; i < this._blockedCommands; ++i) {
      var elt = document.getElementById(this._blockedCommands[i]);
      if (elt.getAttribute("wasDisabled") != "true")
        elt.removeAttribute("disabled");
      elt.removeAttribute("wasDisabled");
    }
  },

  onPopupHidden: function (aEvent) {
    if (aEvent.target == this.panel)
      this._restoreCommandsState();
  },

  onPopupShown: function (aEvent) {
    if (aEvent.target == this.panel)
      document.getElementById("editContactName").focus();
  },

  onKeyPress: function (aEvent, aHandleOnlyReadOnly) {
    // Escape should just close this panel
    if (aEvent.keyCode == KeyEvent.DOM_VK_ESCAPE) {
      this.panel.hidePopup();
      return;
    }

    // Return does the default button (done)
    if (aEvent.keyCode == KeyEvent.DOM_VK_RETURN) {
      if (!aEvent.target.hasAttribute("oncommand"))
        this.saveChanges();
      return;
    }

    // Only handle the read-only cases here.
    if (aHandleOnlyReadOnly &&
        (this._writeable && !aEvent.target.readOnly))
      return;

    // Any other character and we prevent the default, this stops us doing
    // things in the main message window.
    if (aEvent.charCode)
      aEvent.preventDefault();
  },

  get panel() {
    delete this.panel;
    var element = document.getElementById("editContactPanel");
    // initially the panel is hidden to avoid impacting startup / new window
    // performance
    element.hidden = false;
    return this.panel = element;
  },

  showEditContactPanel: function showEditContactPanel(aCardDetails, aAnchorElement) {
    this._cardDetails = aCardDetails;
    this._doShowEditContactPanel(aAnchorElement,
                                 this.panel.getAttribute("chromedir") == "ltr" ?
                                 "after_start" : "after_end");
  },

  _doShowEditContactPanel: function (aAnchorElement, aPosition) {
    this._blockCommands(); // un-done in the popuphiding handler.

    var bundle = document.getElementById("bundle_editContact");

    // Is this address book writeable?
    this._writeable = !this._cardDetails.book.readOnly;
    var type = this._writeable ? "edit" : "view";

    // Update the labels accordingly.
    document.getElementById("editContactPanelTitle").value =
      bundle.getString(type + "Title");
    document.getElementById("editContactPanelEditDetailsButton").label =
      bundle.getString(type + "DetailsLabel");
    document.getElementById("editContactPanelEditDetailsButton").accessKey =
      bundle.getString(type + "DetailsAccessKey");

    // We don't need a cancel button for a read only card.
    document.getElementById("editContactPanelCancelButton").hidden =
      !this._writeable;

    // We don't need a delete button for a read only card.
    document.getElementById("editContactPanelDeleteContactButton").hidden =
      !this._writeable;

    var nameElement = document.getElementById("editContactName");

    // Set these to read only if we can't write to the directory.
    if (this._writeable) {
      nameElement.removeAttribute("readonly");
      nameElement.class = "editContactTextbox";
    }
    else {
      nameElement.readOnly = true;
      nameElement.class = "plain";
    }

    // Fill in the card details
    nameElement.value = this._cardDetails.card.displayName;
    document.getElementById("editContactEmail").value =
      this._cardDetails.card.primaryEmail;

    this.panel.popupBoxObject
        .setConsumeRollupEvent(Components.interfaces
                                         .nsIPopupBoxObject.ROLLUP_CONSUME);
    this.panel.openPopup(aAnchorElement, aPosition, -1, -1);
  },

  editDetails: function() {
    this.panel.hidePopup();

    window.openDialog("chrome://messenger/content/addressbook/abEditCardDialog.xul",
                      "",
                      "chrome,modal,resizable=no,centerscreen",
                      { abURI: this._cardDetails.book.URI,
                        card: this._cardDetails.card });

  },

  deleteContact: function() {
    if (this._cardDetails.book.readOnly)
      return; /* double check we can delete this */

    /* hide before the dialog or the panel takes the first click */
    this.panel.hidePopup();

    var bundle = document.getElementById("bundle_editContact");
    if (!Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Components.interfaces.nsIPromptService)
                  .confirm(window,
                            bundle.getString("deleteContactTitle"),
                            bundle.getString("deleteContactMessage")))
      return;  /* XXX would be nice to bring the popup back up here */

    let cardArray = Components.classes["@mozilla.org/array;1"]
                              .createInstance(Components.interfaces.nsIMutableArray);
    cardArray.appendElement(this._cardDetails.card, false);

    Components.classes["@mozilla.org/abmanager;1"]
              .getService(Components.interfaces.nsIAbManager)
              .getDirectory(this._cardDetails.book.URI)
              .deleteCards(cardArray);
  },

  saveChanges: function() {
    // If we're a popup dialog, just hide the popup and return
    if (!this._writeable) {
      this.panel.hidePopup();
      return;
    }

    this._cardDetails.card.displayName =
      document.getElementById("editContactName").value;
    this._cardDetails.card.primaryEmail =
      document.getElementById("editContactEmail").value;

    // Save the card
    this._cardDetails.book.modifyCard(this._cardDetails.card);
    this.panel.hidePopup();
  }
}
