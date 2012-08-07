/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const {interfaces: Ci, utils: Cu} = Components;
Cu.import("resource:///modules/imServices.jsm");
Cu.import("resource://gre/modules/DownloadUtils.jsm");
Cu.import("resource:///modules/iteratorUtils.jsm");

// This is the list of notifications that the account manager window observes
const events = [
  "prpl-quit",
  "account-list-updated",
  "account-added",
  "account-updated",
  "account-removed",
  "account-connected",
  "account-connecting",
  "account-disconnected",
  "account-disconnecting",
  "account-connect-progress",
  "account-connect-error",
  "autologin-processed",
  "status-changed",
  "network:offline-status-changed"
];

var gAccountManager = {
  // Sets the delay after connect() or disconnect() during which
  // it is impossible to perform disconnect() and connect()
  _disabledDelay: 500,
  disableTimerID: 0,
  _connectedLabelInterval: 0,
  load: function am_load() {
    this.accountList = document.getElementById("accountlist");
    let defaultID;
    Services.core.init(); // ensure the imCore is initialized.
    for (let acc in this.getAccounts()) {
      var elt = document.createElement("richlistitem");
      this.accountList.appendChild(elt);
      elt.build(acc);
      if (!defaultID && acc.firstConnectionState == acc.FIRST_CONNECTION_CRASHED)
        defaultID = acc.id;
    }
    for each (let event in events)
      Services.obs.addObserver(this, event, false);
    if (!this.accountList.getRowCount())
      // This is horrible, but it works. Otherwise (at least on mac)
      // the wizard is not centered relatively to the account manager
      setTimeout(function() { gAccountManager.new(); }, 0);
    else {
      // we have accounts, show the list
      document.getElementById("accountsDesk").selectedIndex = 1;

      // ensure an account is selected
      if (defaultID)
        this.selectAccount(defaultID);
      else
        this.accountList.selectedIndex = 0;
    }

    this.setAutoLoginNotification();

    this.accountList.addEventListener("keypress", this.onKeyPress, true);
    window.addEventListener("unload", this.unload.bind(this));
    this._connectedLabelInterval = setInterval(this.updateConnectedLabels, 60000);
    statusSelector.init();
  },
  unload: function am_unload() {
    clearInterval(this._connectedLabelInterval);
    for each (let event in events)
      Services.obs.removeObserver(this, event);
  },
  _updateAccountList: function am__updateAccountList() {
    let accountList = this.accountList;
    let i = 0;
    for (let acc in this.getAccounts()) {
      let oldItem = accountList.getItemAtIndex(i);
      if (oldItem.id != acc.id) {
        let accElt = document.getElementById(acc.id);
        accountList.insertBefore(accElt, oldItem);
        accElt.restoreItems();
      }
      ++i;
    }

    if (accountList.itemCount == 0) {
      // Focus the "New Account" button if there are no accounts left.
      document.getElementById("newaccount").focus();
      // Return early, otherwise we'll run into an 'undefined property' strict
      //  warning when trying to focus the buttons. Fixes bug 408.
      return;
    }

    // The selected item is still selected
    accountList.selectedItem.buttons.setFocus();
    accountList.ensureSelectedElementIsVisible();

    // We need to refresh the disabled menu items
    this.disableCommandItems();
  },
  observe: function am_observe(aObject, aTopic, aData) {
    if (aTopic == "prpl-quit") {
      // libpurple is being uninitialized. We don't need the account
      // manager window anymore, close it.
      this.close();
      return;
    }
    else if (aTopic == "autologin-processed") {
      var notification = document.getElementById("accountsNotificationBox")
                                 .getNotificationWithValue("autoLoginStatus");
      if (notification)
        notification.close();
      return;
    }
    else if (aTopic == "network:offline-status-changed") {
      this.setOffline(aData == "offline");
      return;
    }
    else if (aTopic == "status-changed") {
      this.setOffline(aObject.statusType == Ci.imIStatusInfo.STATUS_OFFLINE);
      return;
    }
    else if (aTopic == "account-list-updated") {
      this._updateAccountList();
      return;
    }

    // The following notification handlers need an account.
    aObject.QueryInterface(Ci.imIAccount);

    if (aTopic == "account-added") {
      document.getElementById("accountsDesk").selectedIndex = 1;
      var elt = document.createElement("richlistitem");
      this.accountList.appendChild(elt);
      elt.build(aObject);
      if (this.accountList.getRowCount() == 1)
        this.accountList.selectedIndex = 0;
    }
    else if (aTopic == "account-removed") {
      var elt = document.getElementById(aObject.id);
      elt.destroy();
      if (!elt.selected) {
        this.accountList.removeChild(elt);
        return;
      }
      // The currently selected element is removed,
      // ensure another element gets selected (if the list is not empty)
      var selectedIndex = this.accountList.selectedIndex;
      // Prevent errors if the timer is active and the account deleted
      clearTimeout(this.disableTimerID);
      this.disableTimerID = 0;
      this.accountList.removeChild(elt);
      var count = this.accountList.getRowCount();
      if (!count) {
        document.getElementById("accountsDesk").selectedIndex = 0;
        return;
      }
      if (selectedIndex == count)
        --selectedIndex;
      this.accountList.selectedIndex = selectedIndex;
    }
    else if (aTopic == "account-updated") {
      document.getElementById(aObject.id).build(aObject);
      this.disableCommandItems();
    }
    else if (aTopic == "account-connect-progress")
      document.getElementById(aObject.id).updateConnectionState();
    else if (aTopic == "account-connect-error")
      document.getElementById(aObject.id).updateConnectionError();
    else {
      const stateEvents = {
        "account-connected": "connected",
        "account-connecting": "connecting",
        "account-disconnected": "disconnected",
        "account-disconnecting": "disconnecting"
      };
      if (aTopic in stateEvents) {
        let elt = document.getElementById(aObject.id);
        if (!elt)
          return; // probably disconnecting a removed account.

        if (aTopic == "account-connecting") {
          elt.removeAttribute("error");
          elt.updateConnectionState();
        }
        else {
          if (aTopic == "account-connected")
            elt.refreshConnectedLabel();
        }

        elt.setAttribute("state", stateEvents[aTopic]);
      }
    }
  },
  cancelReconnection: function am_cancelReconnection() {
    this.accountList.selectedItem.cancelReconnection();
  },
  connect: function am_connect() {
    let account = this.accountList.selectedItem.account;
    if (account.disconnected) {
      this.temporarilyDisableButtons();
      account.connect();
    }
  },
  disconnect: function am_disconnect() {
    let account = this.accountList.selectedItem.account;
    if (account.connected || account.connecting) {
      this.temporarilyDisableButtons();
      account.disconnect();
    }
  },
  updateConnectedLabels: function am_updateConnectedLabels() {
    for (let i = 0; i < gAccountManager.accountList.itemCount; ++i) {
      let item = gAccountManager.accountList.getItemAtIndex(i);
      if (item.account.connected)
        item.refreshConnectedLabel();
    }
  },
  /* This function disables the connect/disconnect buttons for
   * `this._disabledDelay` ms before calling disableCommandItems to restore
   * the state of the buttons.
   */
  temporarilyDisableButtons: function am_temporarilyDisableButtons() {
    document.getElementById("cmd_disconnect").setAttribute("disabled", "true");
    document.getElementById("cmd_connect").setAttribute("disabled", "true");
    clearTimeout(this.disableTimerID);
    this.accountList.focus();
    this.disableTimerID = setTimeout(function(aItem) {
      gAccountManager.disableTimerID = 0;
      gAccountManager.disableCommandItems();
      aItem.buttons.setFocus();
    }, this._disabledDelay, this.accountList.selectedItem);
  },

  new: function am_new() {
    this.openDialog("chrome://messenger/content/chat/imAccountWizard.xul");
  },
  edit: function am_edit() {
    // Find the nsIIncomingServer for the current imIAccount.
    let server = null;
    let imAccountId = this.accountList.selectedItem.account.numericId;
    let mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                        .getService(Ci.nsIMsgAccountManager);
    for each (let account in fixIterator(mgr.accounts, Ci.nsIMsgAccount)) {
      let incomingServer = account.incomingServer;
      if (!incomingServer || incomingServer.type != "im")
        continue;
      if (incomingServer.wrappedJSObject.imAccount.numericId == imAccountId) {
        server = incomingServer;
        break;
      }
    }

    let win = Services.wm.getMostRecentWindow("mailnews:accountmanager");
    if (win) {
      win.focus();
      win.selectServer(server);
    }
    else {
      window.openDialog("chrome://messenger/content/AccountManager.xul",
                        "AccountManager",
                        "chrome,centerscreen,modal,titlebar,resizable",
                        { server: server, selectPage: null });
    }
  },
  autologin: function am_autologin() {
    var elt = this.accountList.selectedItem;
    elt.autoLogin = !elt.autoLogin;
  },
  close: function am_close() {
    // If a modal dialog is opened, we can't close this window now
    if (this.modalDialog)
      setTimeout(function() { window.close();}, 0);
    else
      window.close();
  },

  /* This function disables or enables the currently selected button and
     the corresponding context menu item */
  disableCommandItems: function am_disableCommandItems() {
    let accountList = this.accountList;
    let selectedItem = accountList.selectedItem;
    // When opening the account manager, if accounts have errors, we
    // can be called during build(), before any item is selected.
    // In this case, just return early.
    if (!selectedItem)
      return;

    // If the timer that disables the button (for a short time) already exists,
    // we don't want to interfere and set the button as enabled.
    if (this.disableTimerID)
      return;

    let account = selectedItem.account;
    let isCommandDisabled =
      (this.isOffline ||
       (account.disconnected &&
        account.connectionErrorReason == Ci.imIAccount.ERROR_UNKNOWN_PRPL));

    let disabledItems = {
      connect: isCommandDisabled,
      disconnect: isCommandDisabled,
      moveup: accountList.selectedIndex == 0,
      movedown: accountList.selectedIndex == accountList.itemCount - 1
    };
    for each (let [name, state] in Iterator(disabledItems)) {
      let elt = document.getElementById("cmd_" + name);
      if (state)
        elt.setAttribute("disabled", "true");
      else
        elt.removeAttribute("disabled");
    }
  },
  onContextMenuShowing: function am_onContextMenuShowing() {
    let targetElt = document.popupNode;
    let isAccount = targetElt instanceof Ci.nsIDOMXULSelectControlItemElement;
    document.getElementById("contextAccountsItems").hidden = !isAccount;
    if (isAccount) {
      let account = targetElt.account;
      let hiddenItems = {
        connect: !account.disconnected,
        disconnect: account.disconnected || account.disconnecting,
        cancelReconnection: !targetElt.hasAttribute("reconnectPending"),
        accountsItemsSeparator: account.disconnecting
      };
      for (let name in hiddenItems)
        document.getElementById("context_" + name).hidden = hiddenItems[name];
    }
  },

  selectAccount: function am_selectAccount(aAccountId) {
    this.accountList.selectedItem = document.getElementById(aAccountId);
    this.accountList.ensureSelectedElementIsVisible();
  },
  onAccountSelect: function am_onAccountSelect() {
    clearTimeout(this.disableTimerID);
    this.disableTimerID = 0;
    this.disableCommandItems();
    // Horrible hack here too, see Bug 177
    setTimeout(function(aThis) {
      try {
        aThis.accountList.selectedItem.buttons.setFocus();
      } catch (e) {
        /* Sometimes if the user goes too fast with VK_UP or VK_DOWN, the
           selectedItem doesn't have the expected binding attached */
      }
    }, 0, this);
  },

  onKeyPress: function am_onKeyPress(event) {
    if (!this.selectedItem)
      return;

    if (event.shiftKey &&
        (event.keyCode == event.DOM_VK_DOWN || event.keyCode == event.DOM_VK_UP)) {
      let offset = event.keyCode == event.DOM_VK_DOWN ? 1 : -1;
      gAccountManager.moveCurrentItem(offset);
      event.stopPropagation();
      event.preventDefault();
      return;
    }

    // As we stop propagation, the default action applies to the richlistbox
    // so that the selected account is changed with this default action
    if (event.keyCode == event.DOM_VK_DOWN) {
      if (this.selectedIndex < this.itemCount - 1)
        this.ensureIndexIsVisible(this.selectedIndex + 1);
      event.stopPropagation();
      return;
    }

    if (event.keyCode == event.DOM_VK_UP) {
      if (this.selectedIndex > 0)
        this.ensureIndexIsVisible(this.selectedIndex - 1);
      event.stopPropagation();
      return;
    }

    if (event.keyCode == event.DOM_VK_RETURN) {
      let target = event.originalTarget;
      if (target.localName != "checkbox" &&
          (target.localName != "button" ||
           /^(dis)?connect$/.test(target.getAttribute("anonid"))))
        this.selectedItem.buttons.proceedDefaultAction();
      return;
    }
  },

  moveCurrentItem: function am_moveCurrentItem(aOffset) {
    let accountList = this.accountList;
    if (!aOffset || !accountList.selectedItem)
      return;

    // Create the new preference value from the richlistbox list
    let items = accountList.children;
    let selectedID = accountList.selectedItem.id;
    let array = [];
    for (let i in items)
      if (items[i].id != selectedID)
        array.push(items[i].id);

    let newIndex = accountList.selectedIndex + aOffset;
    if (newIndex < 0)
      newIndex = 0;
    else if (newIndex >= accountList.itemCount)
      newIndex = accountList.itemCount - 1;
    array.splice(newIndex, 0, selectedID);

    Services.prefs.setCharPref("messenger.accounts", array.join(","));
  },

  getAccounts: function am_getAccounts() {
    let accounts = Services.accounts.getAccounts();
    while (accounts.hasMoreElements())
      yield accounts.getNext();
  },

  openDialog: function am_openDialog(aUrl, aArgs) {
    this.modalDialog = true;
    window.openDialog(aUrl, "", "chrome,modal,titlebar,centerscreen", aArgs);
    this.modalDialog = false;
  },
  setAutoLoginNotification: function am_setAutoLoginNotification() {
    var as = Services.accounts;
    var autoLoginStatus = as.autoLoginStatus;
    let isOffline = false;
    let crashCount = 0;
    for (let acc in this.getAccounts())
      if (acc.autoLogin && acc.firstConnectionState == acc.FIRST_CONNECTION_CRASHED)
        ++crashCount;

    if (autoLoginStatus == as.AUTOLOGIN_ENABLED && crashCount == 0) {
      let status = Services.core.globalUserStatus.statusType;
      this.setOffline(isOffline || status == Ci.imIStatusInfo.STATUS_OFFLINE);
      return;
    }

    var bundle = document.getElementById("accountsBundle");
    var box = document.getElementById("accountsNotificationBox");
    var priority = box.PRIORITY_INFO_HIGH;
    var connectNowButton = {
      accessKey: bundle.getString("accountsManager.notification.button.accessKey"),
      callback: this.processAutoLogin,
      label: bundle.getString("accountsManager.notification.button.label")
    };
    var label;

    switch (autoLoginStatus) {
      case as.AUTOLOGIN_USER_DISABLED:
        label = bundle.getString("accountsManager.notification.userDisabled.label");
        break;

      case as.AUTOLOGIN_SAFE_MODE:
        label = bundle.getString("accountsManager.notification.safeMode.label");
        break;

      case as.AUTOLOGIN_START_OFFLINE:
        label = bundle.getString("accountsManager.notification.startOffline.label");
        isOffline = true;
        break;

      case as.AUTOLOGIN_CRASH:
        label = bundle.getString("accountsManager.notification.crash.label");
        priority = box.PRIORITY_WARNING_MEDIUM;
        break;

      /* One or more accounts made the application crash during their connection.
         If none, this function has already returned */
      case as.AUTOLOGIN_ENABLED:
        if (!("PluralForm" in window))
          Components.utils.import("resource://gre/modules/PluralForm.jsm");
        label = bundle.getString("accountsManager.notification.singleCrash.label");
        label = PluralForm.get(crashCount, label).replace("#1", crashCount);
        priority = box.PRIORITY_WARNING_MEDIUM;
        connectNowButton.callback = this.processCrashedAccountsLogin;
        break;

      default:
        label = bundle.getString("accountsManager.notification.other.label");
    }
    let status = Services.core.globalUserStatus.statusType;
    this.setOffline(isOffline || status == Ci.imIStatusInfo.STATUS_OFFLINE);

    box.appendNotification(label, "autologinStatus", null, priority, [connectNowButton]);
  },
  processAutoLogin: function am_processAutoLogin() {
    var ioService = Services.io;
    if (ioService.offline) {
      ioService.manageOfflineStatus = false;
      ioService.offline = false;
    }

    Services.accounts.processAutoLogin();

    gAccountManager.accountList.selectedItem.buttons.setFocus();
  },
  processCrashedAccountsLogin: function am_processCrashedAccountsLogin() {
    for (let acc in gAccountManager.getAccounts())
      if (acc.disconnected && acc.autoLogin &&
          acc.firstConnectionState == acc.FIRST_CONNECTION_CRASHED)
        acc.connect();

    let notification = document.getElementById("accountsNotificationBox")
                               .getNotificationWithValue("autoLoginStatus");
    if (notification)
      notification.close();

    gAccountManager.accountList.selectedItem.buttons.setFocus();
  },
  setOffline: function am_setOffline(aState) {
    this.isOffline = aState;
    if (aState)
      this.accountList.setAttribute("offline", "true");
    else
      this.accountList.removeAttribute("offline");
    this.disableCommandItems();
  }
};


let gAMDragAndDrop = {
  ACCOUNT_MIME_TYPE: "application/x-moz-richlistitem",
  // Size of the scroll zone on the top and on the bottom of the account list
  MAGIC_SCROLL_HEIGHT: 20,

  // A preference already exists to define scroll speed, let's use it.
  get SCROLL_SPEED() {
    delete this.SCROLL_SPEED;
    try {
      this.SCROLL_SPEED =
        Services.prefs.getIntPref("toolkit.scrollbox.scrollIncrement");
    }
    catch (e) {
      this.SCROLL_SPEED = 20;
    }
    return this.SCROLL_SPEED;
  },

  onDragStart: function amdnd_onDragStart(aEvent, aTransferData, aAction) {
    let accountElement = aEvent.explicitOriginalTarget;
    // This stops the dragging session.
    if (!(accountElement instanceof Ci.nsIDOMXULSelectControlItemElement))
      throw "Element is not draggable!";
    if (gAccountManager.accountList.itemCount == 1)
      throw "Can't drag while there is only one account!";

    // Transferdata is never used, but we need to transfer something.
    aTransferData.data = new TransferData();
    aTransferData.data.addDataForFlavour(this.ACCOUNT_MIME_TYPE, accountElement);
  },

  onDragOver: function amdnd_onDragOver(aEvent, aFlavour, aSession) {
    let accountElement = aEvent.explicitOriginalTarget;
    // We are dragging over the account manager, consider it is the same as
    // the last element.
    if (accountElement == gAccountManager.accountList)
      accountElement = gAccountManager.accountList.lastChild;

    // Auto scroll the account list if we are dragging at the top/bottom
    this.checkForMagicScroll(aEvent.clientY);

    // The hovered element has changed, change the border too
    if (("_accountElement" in this) && this._accountElement != accountElement)
      this.cleanBorders();

    if (!aSession.canDrop) {
      aEvent.dataTransfer.dropEffect = "none";
      return;
    }
    aEvent.dataTransfer.dropEffect = "move";

    if (aEvent.clientY < accountElement.getBoundingClientRect().top +
                         accountElement.clientHeight / 2) {
      // we don't want the previous item to show its default bottom-border
      let previousItem = accountElement.previousSibling;
      if (previousItem)
        previousItem.style.borderBottom = "none";
      accountElement.setAttribute("dragover", "up");
    }
    else {
      if (("_accountElement" in this) &&
          this._accountElement == accountElement &&
          accountElement.getAttribute("dragover") == "up")
        this.cleanBorders();
      accountElement.setAttribute("dragover", "down");
    }

    this._accountElement = accountElement;
  },

  cleanBorders: function amdnd_cleanBorders(aIsEnd) {
    if (!this._accountElement)
      return;

    this._accountElement.removeAttribute("dragover");
    // reset the border of the previous element
    let previousItem = this._accountElement.previousSibling;
    if (previousItem) {
      if (aIsEnd && !previousItem.style.borderBottom && previousItem.previousSibling)
        previousItem = previousItem.previousSibling;
      previousItem.style.borderBottom = "";
    }

    if (aIsEnd)
      delete this._accountElement;
  },

  canDrop: function amdnd_canDrop(aEvent, aSession) {
    let accountElement = aEvent.explicitOriginalTarget;
    if (accountElement == gAccountManager.accountList)
      accountElement = gAccountManager.accountList.lastChild;
    return (accountElement != gAccountManager.accountList.selectedItem);
  },

  checkForMagicScroll: function amdnd_checkForMagicScroll(aClientY) {
    let accountList = gAccountManager.accountList;
    let listSize = accountList.getBoundingClientRect();
    let direction = 1;
    if (aClientY < listSize.top + this.MAGIC_SCROLL_HEIGHT)
      direction = -1;
    else if (aClientY < listSize.bottom - this.MAGIC_SCROLL_HEIGHT)
      // We are not on a scroll zone
      return;

    accountList._scrollbox.scrollTop += direction * this.SCROLL_SPEED;
  },

  onDrop: function amdnd_onDrop(aEvent, aTransferData, aSession) {
    let accountElement = aEvent.explicitOriginalTarget;
    if (accountElement == gAccountManager.accountList)
      accountElement = gAccountManager.accountList.lastChild;

     if (!aSession.canDrop)
      return;

    // compute the destination
    let accountList = gAccountManager.accountList;
    let offset = accountList.getIndexOfItem(accountElement) -
                 accountList.selectedIndex;
    let isDroppingAbove =
      aEvent.clientY < accountElement.getBoundingClientRect().top +
                       accountElement.clientHeight / 2;
    if (offset > 0)
      offset -= isDroppingAbove;
    else
      offset += !isDroppingAbove;
    gAccountManager.moveCurrentItem(offset);
  },

  getSupportedFlavours: function amdnd_getSupportedFlavours() {
    var flavours = new FlavourSet();
    flavours.appendFlavour(this.ACCOUNT_MIME_TYPE,
                           "nsIDOMXULSelectControlItemElement");
    return flavours;
  }
};
