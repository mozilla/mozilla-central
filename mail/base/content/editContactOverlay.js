/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

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
    document.getElementById("editContactAddressBookList").disabled = false;
    document.getElementById("contactMoveDisabledText").collapsed = true;
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
    let position = (getComputedStyle(this.panel, null).direction == "rtl") ?
      "after_end" : "after_start";
    this._doShowEditContactPanel(aAnchorElement, position);
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
      aAnchorElement.getAttribute("emailAddress");

    document.getElementById("editContactAddressBookList").value =
      this._cardDetails.book.URI;

    // Is this card contained within mailing lists?
    let inMailList = false;
    if (this._cardDetails.book.supportsMailingLists) {
      // We only have to look in one book here, because cards currently have
      // to be in the address book they belong to.
      let mailingLists = this._cardDetails.book.childNodes;
      while (mailingLists.hasMoreElements() && !inMailList) {
        let list = mailingLists.getNext();
        if (!(list instanceof Components.interfaces.nsIAbDirectory) ||
            !list.isMailList)
          continue;

        for (let card in fixIterator(list.addressLists)) {
          if (card instanceof Components.interfaces.nsIAbCard &&
              card.primaryEmail == this._cardDetails.card.primaryEmail) {
            inMailList = true;
            break;
          }
        }
      }
    }

    if (!this._writeable || inMailList)
      document.getElementById("editContactAddressBookList").disabled = true;

    if (inMailList)
      document.getElementById("contactMoveDisabledText").collapsed = false;

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
    if (!Services.prompt.confirm(window,
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

    let originalBook = this._cardDetails.book;

    let abURI = document.getElementById("editContactAddressBookList").value;
    if (abURI != originalBook.URI) {
      let abManager = Components.classes["@mozilla.org/abmanager;1"]
                                .getService(Components.interfaces.nsIAbManager);
      this._cardDetails.book = abManager.getDirectory(abURI);
    }

    // We can assume the email address stays the same, so just update the name
    var newName = document.getElementById("editContactName").value;
    if (newName != this._cardDetails.card.displayName) {
      this._cardDetails.card.displayName = newName;
      this._cardDetails.card.setProperty("PreferDisplayName", true);
    }

    // Save the card
    if (this._cardDetails.book.hasCard(this._cardDetails.card)) {
      // Address book wasn't changed.
      this._cardDetails.book.modifyCard(this._cardDetails.card);
    }
    else {
      // We changed address books for the card.

      // Delete  it from the old place...
      let cardArray = Components.classes["@mozilla.org/array;1"]
                              .createInstance(Components.interfaces.nsIMutableArray);
      cardArray.appendElement(this._cardDetails.card, false);
      originalBook.deleteCards(cardArray);

      // ... and add it to the chosen address book.
      this._cardDetails.book.addCard(this._cardDetails.card);
    }

    this.panel.hidePopup();
  }
}
