/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

var imServices = {};
Components.utils.import("resource:///modules/imServices.jsm", imServices);
imServices = imServices.Services;

Components.utils.import("resource://gre/modules/FileUtils.jsm");

var gBuddyListContextMenu = null;

function buddyListContextMenu(aXulMenu) {
  this.target = aXulMenu.triggerNode;
  this.menu = aXulMenu;
  let localName = this.target.localName;
  this.onContact = localName == "imcontact";
  this.onConv = localName == "imconv";
  this.shouldDisplay = this.onContact || this.onConv;

  let hide = !this.onContact;
  ["context-openconversation", "context-edit-buddy-separator",
    "context-alias", "context-delete"].forEach(function(aId) {
    document.getElementById(aId).hidden = hide;
  });

  document.getElementById("context-close-conversation").hidden = !this.onConv;
  document.getElementById("context-openconversation").disabled =
    !hide && !this.target.canOpenConversation();
}
buddyListContextMenu.prototype = {
  openConversation: function blcm_openConversation() {
    if (this.onContact || this.onConv)
      this.target.openConversation();
  },
  closeConversation: function blcm_closeConversation() {
    if (this.onConv)
      this.target.closeConversation();
  },
  alias: function blcm_alias() {
    if (this.onContact)
      this.target.startAliasing();
  },
  delete: function blcm_delete() {
    if (!this.onContact)
      return;

    let buddy = this.target.contact.preferredBuddy;
    let bundle = document.getElementById("chatBundle");
    let displayName = this.target.displayName;
    let promptTitle = bundle.getFormattedString("buddy.deletePrompt.title",
                                                [displayName]);
    let userName = buddy.userName;
    if (displayName != userName) {
      displayName = bundle.getFormattedString("buddy.deletePrompt.displayName",
                                              [displayName, userName]);
    }
    let proto = buddy.protocol.name; // FIXME build a list
    let promptMessage = bundle.getFormattedString("buddy.deletePrompt.message",
                                                  [displayName, proto]);
    let deleteButton = bundle.getString("buddy.deletePrompt.button");
    let prompts = Services.prompt;
    let flags = prompts.BUTTON_TITLE_IS_STRING * prompts.BUTTON_POS_0 +
                prompts.BUTTON_TITLE_CANCEL * prompts.BUTTON_POS_1 +
                prompts.BUTTON_POS_1_DEFAULT;
    if (prompts.confirmEx(window, promptTitle, promptMessage, flags,
                          deleteButton, null, null, null, {}))
      return;

    this.target.remove();
  }
};

var gChatTab = null;

var chatTabType = {
  name: "chat",
  panelId: "chatTabPanel",
  hasBeenOpened: false,
  modes: {
    chat: {
      type: "chat"
    }
  },

  _handleArgs: function(aArgs) {
    if (!aArgs || !("convType" in aArgs) ||
        (aArgs.convType != "log" && aArgs.convType != "focus"))
      return;

    if (aArgs.convType == "focus") {
      chatHandler.focusConversation(aArgs.conv);
      return;
    }

    let item = document.getElementById("searchResultConv");
    item.log = aArgs.conv;
    if (aArgs.searchTerm)
      item.searchTerm = aArgs.searchTerm;
    else
      delete item.searchTerm;
    item.hidden = false;
    if (item.getAttribute("selected"))
      chatHandler.onListItemSelected();
    else
      document.getElementById("contactlistbox").selectedItem = item;
  },
  openTab: function(aTab, aArgs) {
    if (!this.hasBeenOpened) {
      let convs = imServices.conversations.getUIConversations();
      if (convs.length != 0) {
        convs.sort(function(a, b)
                   a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
        for each (let conv in convs)
          chatHandler._addConversation(conv);
      }
    }

    gChatTab = aTab;
    aTab.tabNode.setAttribute("type", "chat");
    this._handleArgs(aArgs);
    chatHandler._updateSelectedConversation();
    chatHandler.updateTitle();
    chatHandler._updateFocus();
    this.hasBeenOpened = true;
  },
  shouldSwitchTo: function(aArgs) {
    if (!gChatTab)
      return -1;
    this._handleArgs(aArgs);
    return document.getElementById("tabmail").tabInfo.indexOf(gChatTab);
  },
  showTab: function(aTab) {
    gChatTab = aTab;
    let list = document.getElementById("contactlistbox");
    chatHandler._updateSelectedConversation();
    chatHandler._updateFocus();
  },
  closeTab: function(aTab) {
    gChatTab = null;
  },

  supportsCommand: function ct_supportsCommand(aCommand, aTab) {
    switch (aCommand) {
      case "cmd_fullZoomReduce":
      case "cmd_fullZoomEnlarge":
      case "cmd_fullZoomReset":
      case "cmd_fullZoomToggle":
      case "cmd_find":
      case "cmd_findAgain":
      case "cmd_findPrevious":
        return true;
      default:
        return false;
    }
  },
  isCommandEnabled: function ct_isCommandEnabled(aCommand, aTab) {
    switch (aCommand) {
      case "cmd_fullZoomReduce":
      case "cmd_fullZoomEnlarge":
      case "cmd_fullZoomReset":
      case "cmd_fullZoomToggle":
        return !!this.getBrowser();
      case "cmd_find":
      case "cmd_findAgain":
      case "cmd_findPrevious":
        return !!this.getFindbar();
      default:
        return false;
    }
  },
  doCommand: function ct_doCommand(aCommand, aTab) {
    switch (aCommand) {
      case "cmd_fullZoomReduce":
        ZoomManager.reduce();
        break;
      case "cmd_fullZoomEnlarge":
        ZoomManager.enlarge();
        break;
      case "cmd_fullZoomReset":
        ZoomManager.reset();
        break;
      case "cmd_fullZoomToggle":
        ZoomManager.toggleZoom();
        break;
      case "cmd_find":
        this.getFindbar().onFindCommand();
        break;
      case "cmd_findAgain":
        this.getFindbar().onFindAgainCommand(false);
        break;
      case "cmd_findPrevious":
        this.getFindbar().onFindAgainCommand(true);
        break;
    }
  },
  onEvent: function(aEvent, aTab) { },
  getBrowser: function ct_getBrowser(aTab) {
    let panel = document.getElementById("conversationsDeck").selectedPanel;
    if (panel == document.getElementById("logDisplay")) {
      if (document.getElementById("logDisplayDeck").selectedPanel ==
          document.getElementById("logDisplayBrowserBox"))
        return document.getElementById("conv-log-browser");
    }
    else if (panel && panel.localName == "imconversation") {
      return panel.browser;
    }
    return null;
  },
  getFindbar: function ct_getFindbar(aTab) {
    let panel = document.getElementById("conversationsDeck").selectedPanel;
    if (panel == document.getElementById("logDisplay")) {
      if (document.getElementById("logDisplayDeck").selectedPanel ==
          document.getElementById("logDisplayBrowserBox"))
        return document.getElementById("log-findbar");
    }
    else if (panel && panel.localName == "imconversation") {
      return panel.findbar;
    }
    return null;
  },

  saveTabState: function(aTab) { }
};

var chatHandler = {
  _addConversation: function(aConv) {
    let list = document.getElementById("contactlistbox");
    let convs = document.getElementById("conversationsGroup");
    let selectedItem = list.selectedItem;
    let shouldSelect =
      gChatTab && gChatTab.tabNode.selected &&
      (!selectedItem || (selectedItem == convs &&
                        convs.nextSibling.localName != "imconv"));
    let elt = convs.addContact(aConv, "imconv");
    if (shouldSelect)
      list.selectedItem = elt;

    if (aConv.isChat || !aConv.buddy)
      return;

    let contact = aConv.buddy.buddy.contact;
    elt.imContact = contact;
    let groupName = (contact.online ? "on" : "off") + "linecontactsGroup";
    let item = document.getElementById(groupName).removeContact(contact);
    if (list.selectedItem == item)
      list.selectedItem = elt;
  },

  _hasConversationForContact: function(aContact) {
    let convs = document.getElementById("conversationsGroup").contacts;
    return convs.some(function(aConversation)
      aConversation.hasOwnProperty("imContact") &&
      aConversation.imContact.id == aContact.id);
  },

  _chatButtonUpdatePending: false,
  updateChatButtonState: function() {
    if (this._chatButtonUpdatePending)
      return;
    this._chatButtonUpdatePending = true;
    Services.tm.mainThread.dispatch(this._updateChatButtonState.bind(this),
                                    Ci.nsIEventTarget.DISPATCH_NORMAL);
  },
  // This is the unread count that was part of the latest
  // unread-im-count-changed notification.
  _notifiedUnreadCount: 0,
  _updateChatButtonState: function() {
    delete this._chatButtonUpdatePending;
    let chatButton = document.getElementById("button-chat");
    if (!chatButton)
      return;

    let [unreadTargettedCount, unreadTotalCount] = this.countUnreadMessages();
    chatButton.badgeCount = unreadTargettedCount;

    if (unreadTotalCount)
      chatButton.setAttribute("unreadMessages", "true");
    else
      chatButton.removeAttribute("unreadMessages");

    if (unreadTargettedCount != this._notifiedUnreadCount) {
      let unreadInt = Components.classes["@mozilla.org/supports-PRInt32;1"]
                                .createInstance(Ci.nsISupportsPRInt32);
      unreadInt.data = unreadTargettedCount;
      Services.obs.notifyObservers(unreadInt, "unread-im-count-changed", unreadTargettedCount);
      this._notifiedUnreadCount = unreadTargettedCount;
    }
  },

  countUnreadMessages: function() {
    let convs = imServices.conversations.getUIConversations();
    let unreadTargettedCount = 0;
    let unreadTotalCount = 0;
    for each (let conv in convs) {
      unreadTargettedCount += conv.unreadTargetedMessageCount;
      unreadTotalCount += conv.unreadIncomingMessageCount;
    }
    return [unreadTargettedCount, unreadTotalCount];
  },

  updateTitle: function() {
    if (!gChatTab)
      return;

    let title =
      document.getElementById("chatBundle").getString("chatTabTitle");
    let [unreadTargettedCount] = this.countUnreadMessages();
    if (unreadTargettedCount)
      title += " (" + unreadTargettedCount + ")";
    let selectedItem = document.getElementById("contactlistbox").selectedItem;
    if (selectedItem && selectedItem.localName == "imconv" &&
        !selectedItem.hidden)
      title += " - " + selectedItem.getAttribute("displayname");
    gChatTab.title = title;
    document.getElementById("tabmail").setTabTitle(gChatTab);
  },

  onConvResize: function() {
    let convDeck = document.getElementById("conversationsDeck");
    let panel = convDeck.selectedPanel;
    if (panel && panel.localName == "imconversation")
      panel.onConvResize();
  },

  setStatusMenupopupCommand: function(aEvent) {
    let target = aEvent.originalTarget;
    if (target.getAttribute("id") == "imStatusShowAccounts") {
      openIMAccountMgr();
      return;
    }

    if (target.getAttribute("id") == "appmenu_imStatusShowAccounts") {
      openIMAccountMgr();
      return;
    }

    let status = target.getAttribute("status");
    if (!status)
      return; // Can status really be null? Maybe because of an add-on...

    let us = imServices.core.globalUserStatus;
    us.setStatus(Status.toFlag(status), us.statusText);
  },

  _pendingLogBrowserLoad: false,
  _showLogPanel: function() {
    document.getElementById("conversationsDeck").selectedPanel =
      document.getElementById("logDisplay");
    document.getElementById("logDisplayDeck").selectedPanel =
      document.getElementById("logDisplayBrowserBox");
  },
  _showLog: function(aConversation, aPath, aSearchTerm) {
    if (!aConversation)
      return;
    this._showLogPanel();
    if (this._displayedLog == aPath)
      return;
    this._displayedLog = aPath;
    let browser = document.getElementById("conv-log-browser");
    browser._autoScrollEnabled = false;
    if (this._pendingLogBrowserLoad) {
      browser._conv = aConversation;
      return;
    }
    browser.init(aConversation);
    this._pendingLogBrowserLoad = true;
    if (aSearchTerm)
      this._pendingSearchTerm = aSearchTerm;
    Services.obs.addObserver(this, "conversation-loaded", false);
  },
  _makeFriendlyDate: function(aDate) {
    let dts = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                        .getService(Components.interfaces.nsIScriptableDateFormat);

    // Figure out when today begins
    let now = new Date();
    let today = new Date(now.getFullYear(), now.getMonth(),
                         now.getDate());

    // Figure out if the end time is from today, yesterday,
    // this week, etc.
    let kDayInMsecs = 24 * 60 * 60 * 1000;
    let time = dts.FormatTime("", dts.timeFormatNoSeconds,
                              aDate.getHours(), aDate.getMinutes(),0);
    let bundle = document.getElementById("chatBundle");
    if (aDate >= today)
      return bundle.getFormattedString("today", [time]);
    if (today - aDate < kDayInMsecs)
      return bundle.getFormattedString("yesterday", [time]);

    let date = dts.FormatDate("", dts.dateFormatShort, aDate.getFullYear(),
                              aDate.getMonth() + 1, aDate.getDate());
    return bundle.getFormattedString("dateTime", [date, time]);
  },

  /**
   * Display a list of logs into a tree, and optionally handle a default selection.
   *
   * @param aLogs An nsISimpleEnumerator of imILog.
   * @param aShouldSelect Either a boolean (true means select the first log
   * of the list, false or undefined means don't mess with the selection) or a log
   * item that needs to be selected.
   * @returns true if there's at least one log in the list, false if empty.
   */
  _showLogList: function(aLogs, aShouldSelect) {
    let logTree = document.getElementById("logTree");
    let treeView = this._treeView = new chatLogTreeView(logTree, aLogs);
    if (!treeView._rowMap.length)
      return false;
    if (aShouldSelect) {
      if (aShouldSelect === true) {
        // Open the first group (index 0)
        treeView.toggleOpenState(0);
        // Select the first log of the first group (index 1)
        logTree.view.selection.select(1);
      }
      else {
        let logTime = aShouldSelect.time;
        for (let index = 0; index < treeView._rowMap.length; ++index) {
          if (!treeView._rowMap[index].children.some(function (i) i.log.time == logTime))
            continue;
          treeView.toggleOpenState(index);
          ++index;
          while (index < treeView._rowMap.length && treeView._rowMap[index].log.time != logTime)
            ++index;
          if (treeView._rowMap[index].log.time == logTime) {
            logTree.view.selection.select(index);
            logTree.treeBoxObject.ensureRowIsVisible(index);
          }
          return true;
        }
      }
    }
    return true;
  },

  onLogSelect: function() {
    let selection = this._treeView.selection;
    let currentIndex = selection.currentIndex;
    // The current (focused) row may not be actually selected...
    if (!selection.isSelected(currentIndex))
      return;

    let log = this._treeView._rowMap[currentIndex].log;
    if (!log)
      return;

    let list = document.getElementById("contactlistbox");
    if (list.selectedItem.getAttribute("id") != "searchResultConv")
      document.getElementById("goToConversation").hidden = false;
    this._showLog(log.getConversation(), log.path);
  },

  _contactObserver: {
    observe: function(aSubject, aTopic, aData) {
      if (aTopic == "contact-status-changed" ||
          aTopic == "contact-display-name-changed" ||
          aTopic == "contact-icon-changed")
        chatHandler.showContactInfo(aSubject);
    }
  },
  _observedContact: null,
  get observedContact() this._observedContact,
  set observedContact(aContact) {
    if (aContact == this._observedContact)
      return aContact;
    if (this._observedContact) {
      this._observedContact.removeObserver(this._contactObserver);
      delete this._observedContact;
    }
    this._observedContact = aContact;
    if (aContact)
      aContact.addObserver(this._contactObserver);
    return aContact;
  },
  showCurrentConversation: function() {
    let item = document.getElementById("contactlistbox").selectedItem;
    if (!item)
      return;
    if (item.localName == "imconv") {
      document.getElementById("conversationsDeck").selectedPanel = item.convView;
      document.getElementById("logTree").view.selection.clearSelection();
      item.convView.focus();
    }
    else if (item.localName == "imcontact")
      item.openConversation();
  },
  focusConversation: function(aUIConv) {
    let conv =
      document.getElementById("conversationsGroup").contactsById[aUIConv.id];
    document.getElementById("contactlistbox").selectedItem = conv;
    if (conv.convView)
      conv.convView.focus();
  },
  showContactInfo: function(aContact) {
    let cti = document.getElementById("conv-top-info");
    cti.setAttribute("userIcon", aContact.buddyIconFilename);
    cti.setAttribute("displayName", aContact.displayName);
    let proto = aContact.preferredBuddy.protocol;
    cti.setAttribute("prplIcon", proto.iconBaseURI + "icon.png");
    let statusText = aContact.statusText;
    let statusType = aContact.statusType;
    if (statusText)
      statusText = " - " + statusText;
    cti.setAttribute("statusMessageWithDash", statusText);
    let statusString = Status.toLabel(statusType);
    cti.setAttribute("statusMessage", statusString + statusText);
    cti.setAttribute("status", Status.toAttribute(statusType));
    cti.setAttribute("statusTypeTooltiptext", statusString);
    cti.setAttribute("statusTooltiptext", statusString + statusText);
    cti.removeAttribute("typing");
    cti.removeAttribute("typed");
    cti.removeAttribute("topicEditable");
    cti.removeAttribute("noTopic");

    let bundle = document.getElementById("chatBundle");
    let button = document.getElementById("goToConversation");
    button.label = bundle.getFormattedString("startAConversationWith.button",
                                             [aContact.displayName]);
    button.disabled = !aContact.canSendMessage;
  },
  _hideContextPane: function(aHide) {
    document.getElementById("contextSplitter").hidden = aHide;
    document.getElementById("contextPane").hidden = aHide;
  },
  onListItemClick: function(aEvent) {
    // We only care about single clicks of the left button.
    if (aEvent.button != 0 || aEvent.detail != 1)
      return;
    let item = document.getElementById("contactlistbox").selectedItem;
    if (item.localName == "imconv" && item.convView)
      item.convView.focus();
  },
  onListItemSelected: function() {
    let item = document.getElementById("contactlistbox").selectedItem;
    if (!item || item.hidden || item.localName == "imgroup") {
      this._hideContextPane(true);
      document.getElementById("conversationsDeck").selectedPanel =
        document.getElementById("noConvScreen");
      this.updateTitle();
      this.observedContact = null;
      return;
    }

    this._hideContextPane(false);

    if (item.getAttribute("id") == "searchResultConv") {
      let path = "logs/" + item.log.path;
      let file = FileUtils.getFile("ProfD", path.split("/"));
      let log = imServices.logs.getLogFromFile(file, true);
      document.getElementById("goToConversation").hidden = true;
      document.getElementById("contextPane").removeAttribute("chat");
      let conv = log.getConversation();
      this._showLog(conv, file.path, item.searchTerm || undefined);
      let cti = document.getElementById("conv-top-info");
      cti.setAttribute("displayName", conv.title);
      cti.removeAttribute("userIcon");
      cti.removeAttribute("statusMessageWithDash");
      cti.removeAttribute("statusMessage");
      cti.removeAttribute("status");
      cti.removeAttribute("statusTypeTooltiptext");
      cti.removeAttribute("statusTooltiptext");
      cti.removeAttribute("topicEditable");
      cti.removeAttribute("noTopic");
      this._showLogList(imServices.logs.getSimilarLogs(log, true), log);
      this.observedContact = null;
    }
    else if (item.localName == "imconv") {
      let convDeck = document.getElementById("conversationsDeck");
      if (!item.convView) {
        let conv = document.createElement("imconversation");
        convDeck.appendChild(conv);
        conv.conv = item.conv;
        conv.tab = item;
        conv.setAttribute("contentcontextmenu", "chatConversationContextMenu");
        conv.setAttribute("contenttooltip", "aHTMLTooltip");
        item.convView = conv;
        document.getElementById("contextSplitter").hidden = false;
        document.getElementById("contextPane").hidden = false;
      }
      else
        item.convView.onConvResize();

      convDeck.selectedPanel = item.convView;
      item.convView.updateConvStatus();
      item.update();

      this._showLogList(imServices.logs.getLogsForConversation(item.conv, true));
      let contextPane = document.getElementById("contextPane");
      if (item.conv.isChat) {
        contextPane.setAttribute("chat", "true");
        item.convView.showParticipants();
      }
      else
        contextPane.removeAttribute("chat");

      let button = document.getElementById("goToConversation");
      let bundle = document.getElementById("chatBundle");
      button.label = bundle.getString("goBackToCurrentConversation.button");
      button.disabled = false;
      this.observedContact = null;
    }
    else if (item.localName == "imcontact") {
      let contact = item.contact;
      if (this.observedContact && contact &&
          this.observedContact.id == contact.id)
        return; // onselect has just been fired again because a status
                // change caused the imcontact to move.
                // Return early to avoid flickering and changing the selected log.

      this.showContactInfo(contact);
      this.observedContact = contact;

      document.getElementById("contextPane").removeAttribute("chat");

      if (!this._showLogList(imServices.logs.getLogsForContact(contact), true)) {
        document.getElementById("conversationsDeck").selectedPanel =
          document.getElementById("logDisplay");
        document.getElementById("logDisplayDeck").selectedPanel =
          document.getElementById("noPreviousConvScreen");
      }
    }
    this.updateTitle();
  },

  onNickClick: function(aEvent) {
    // Open a private conversation only for a middle or double click.
    if (aEvent.button != 1 && (aEvent.button != 0 || aEvent.detail != 2))
      return;

    let conv = document.getElementById("contactlistbox").selectedItem.conv;
    let nick = aEvent.originalTarget.chatBuddy.name;
    let name = conv.target.getNormalizedChatBuddyName(nick);
    try {
      conv.account.createConversation(name);
    } catch (e) {}
  },

  onNicklistKeyPress: function(aEvent) {
    if (aEvent.keyCode != aEvent.DOM_VK_RETURN &&
        aEvent.keyCode != aEvent.DOM_VK_ENTER)
      return;

    let listbox = aEvent.originalTarget;
    if (listbox.selectedCount == 0)
      return;

    let conv = document.getElementById("contactlistbox").selectedItem.conv;
    for (let i = 0; i < listbox.selectedCount; ++i) {
      let nick = listbox.getSelectedItem(i).chatBuddy.name;
      let name = conv.target.getNormalizedChatBuddyName(nick);
      try {
        conv.account.createConversation(name);
      } catch (e) {}
    }
  },

  _openDialog: function(aType) {
    let features = "chrome,modal,titlebar,centerscreen";
    window.openDialog("chrome://messenger/content/chat/" + aType + ".xul", "",
                      features);
  },
  addBuddy: function() {
     this._openDialog("addbuddy");
  },
  joinChat: function() {
    this._openDialog("joinchat");
  },

  _colorCache: {},
  // Duplicated code from imconversation.xml :-(
  _computeColor: function(aName) {
    if (Object.prototype.hasOwnProperty.call(this._colorCache, aName))
      return this._colorCache[aName];

    // Compute the color based on the nick
    var nick = aName.match(/[a-zA-Z0-9]+/);
    nick = nick ? nick[0].toLowerCase() : nick = aName;
    // We compute a hue value (between 0 and 359) based on the
    // characters of the nick.
    // The first character weights kInitialWeight, each following
    // character weights kWeightReductionPerChar * the weight of the
    // previous character.
    const kInitialWeight = 10; // 10 = 360 hue values / 36 possible characters.
    const kWeightReductionPerChar = 0.52; // arbitrary value
    var weight = kInitialWeight;
    var res = 0;
    for (var i = 0; i < nick.length; ++i) {
      var char = nick.charCodeAt(i) - 47;
      if (char > 10)
        char -= 39;
      // now char contains a value between 1 and 36
      res += char * weight;
      weight *= kWeightReductionPerChar;
    }
    return (this._colorCache[aName] = Math.round(res) % 360);
  },

  _placeHolderButtonId: "",
  _updateNoConvPlaceHolder: function() {
    let connected = false;
    let hasAccount = false;
    let canJoinChat = false;
    for (let account in fixIterator(imServices.accounts.getAccounts())) {
      hasAccount = true;
      if (account.connected) {
        connected = true;
        if (account.canJoinChat) {
          canJoinChat = true;
          break;
        }
      }
    }
    document.getElementById("noConvInnerBox").hidden = !connected;
    document.getElementById("noAccountInnerBox").hidden = hasAccount;
    document.getElementById("noConnectedAccountInnerBox").hidden =
      connected || !hasAccount;
    if (connected) {
      delete this._placeHolderButtonId;
    }
    else {
      this._placeHolderButtonId =
        hasAccount ? "openIMAccountManagerButton" : "openIMAccountWizardButton";
    }
    for each (let id in ["statusTypeIcon", "statusMessage", "button-chat-accounts"]) {
      let elt = document.getElementById(id);
      if (elt)
        elt.disabled = !hasAccount;
    }
    for each (let id in ["button-add-buddy", "newIMContactMenuItem",
                         "appmenu_newIMContactMenuItem"]) {
      let elt = document.getElementById(id);
      if (elt)
        elt.disabled = !connected;
    }
    for each (let id in ["button-join-chat", "joinChatMenuItem",
                         "appmenu_joinChatMenuItem"]) {
      let elt = document.getElementById(id);
      if (elt)
        elt.disabled = !canJoinChat;
    }
    let groupIds = ["conversations", "onlinecontacts", "offlinecontacts"];
    let contactlist = document.getElementById("contactlistbox");
    if (!hasAccount || !connected && groupIds.every(function(id)
        document.getElementById(id + "Group").contacts.length)) {
      contactlist.disabled = true;
    }
    else {
      contactlist.disabled = false;
      this._updateSelectedConversation();
    }
  },
  _updateSelectedConversation: function() {
    let list = document.getElementById("contactlistbox");
    // We can't select anything if there's no account.
    if (list.disabled)
      return;

    // If the selection is already a conversation with unread messages, keep it.
    let selectedItem = list.selectedItem;
    if (selectedItem && selectedItem.localName == "imconv" &&
        selectedItem.directedUnreadCount) {
      selectedItem.update();
      return;
    }

    let firstConv;
    let convs = document.getElementById("conversationsGroup");
    let conv = convs.nextSibling;
    while (conv.id != "searchResultConv") {
      if (!firstConv)
        firstConv = conv;
      // If there is a conversation with unread messages, select it.
      if (conv.directedUnreadCount) {
        list.selectedItem = conv;
        return;
      }
      conv = conv.nextSibling;
    }

    // No unread messages, select the first conversation, but only if
    // the existing selection is uninteresting (a section header).
    if (firstConv) {
      if (!selectedItem || selectedItem.localName == "imgroup")
        list.selectedItem = firstConv;
      return;
    }

    // No conversation, if a visible item is selected, keep it.
    if (selectedItem && !selectedItem.collapsed)
      return;

    // Select the first visible group header.
    let groupIds = ["conversations", "onlinecontacts", "offlinecontacts"];
    for each (let id in groupIds) {
      let item = document.getElementById(id + "Group");
      if (item.collapsed)
        continue;
      list.selectedItem = item;
      return;
    }
  },
  _updateFocus: function() {
    let focusId = this._placeHolderButtonId || "contactlistbox";
    document.getElementById(focusId).focus();
  },
  observe: function(aSubject, aTopic, aData) {
    if (aTopic == "chat-core-initialized") {
      this.initAfterChatCore();
      return;
    }

    if (aTopic == "conversation-loaded") {
      let browser = document.getElementById("conv-log-browser");
      if (aSubject != browser)
        return;

      for each (let msg in browser._conv.getMessages()) {
        if (!msg.system)
          msg.color = "color: hsl(" + this._computeColor(msg.who) + ", 100%, 40%);";
        browser.appendMessage(msg);
      }

      if (this._pendingSearchTerm) {
        let findbar = document.getElementById("log-findbar");
        let findField = findbar._findField;
        findField.value = this._pendingSearchTerm;
        findbar.open();
        findField.focus();
        delete this._pendingSearchTerm;
        let eventListener = function() {
          findbar.onFindAgainCommand();
          if (findbar._findField.getAttribute("status") != "notfound" ||
              !browser._messageDisplayPending)
            browser.removeEventListener("MessagesDisplayed", eventListener);
        };
        browser.addEventListener("MessagesDisplayed", eventListener);
      }
      delete this._pendingLogBrowserLoad;
      Services.obs.removeObserver(this, "conversation-loaded");
      return;      
    }

    if (aTopic == "account-connected" || aTopic == "account-disconnected" ||
        aTopic == "account-added" || aTopic == "account-removed") {
      this._updateNoConvPlaceHolder();
      return;
    }

    if (aTopic == "contact-signed-on") {
      if (!this._hasConversationForContact(aSubject)) {
        document.getElementById("onlinecontactsGroup").addContact(aSubject);
        document.getElementById("offlinecontactsGroup").removeContact(aSubject);
      }
      return;
    }
    if (aTopic == "contact-signed-off") {
      if (!this._hasConversationForContact(aSubject)) {
        document.getElementById("offlinecontactsGroup").addContact(aSubject);
        document.getElementById("onlinecontactsGroup").removeContact(aSubject);
      }
      return;
    }
    if (aTopic == "contact-added") {
      let groupName = (aSubject.online ? "on" : "off") + "linecontactsGroup";
      document.getElementById(groupName).addContact(aSubject);
      return;
    }
    if (aTopic == "contact-removed") {
      let groupName = (aSubject.online ? "on" : "off") + "linecontactsGroup";
      document.getElementById(groupName).removeContact(aSubject);
      return;
    }
    if (aTopic == "contact-no-longer-dummy") {
      let oldId = parseInt(aData);
      let groupName = (aSubject.online ? "on" : "off") + "linecontactsGroup";
      let group = document.getElementById(groupName);
      if (group.contactsById.hasOwnProperty(oldId)) {
        let contact = group.contactsById[oldId];
        delete group.contactsById[oldId];
        group.contactsById[contact.contact.id] = contact;
      }
      return;
    }
    if (aTopic == "new-text") {
      this.updateChatButtonState();
      return;
    }
    if (aTopic == "new-ui-conversation") {
      if (chatTabType.hasBeenOpened)
        chatHandler._addConversation(aSubject);
      return;
    }
    if (aTopic == "ui-conversation-closed") {
      let conv =
        document.getElementById("conversationsGroup").removeContact(aSubject);
      if (conv.imContact) {
        let contact = conv.imContact;
        let groupName = (contact.online ? "on" : "off") + "linecontactsGroup";
        document.getElementById(groupName).addContact(contact);
      }
      return;
    }

    if (aTopic == "buddy-authorization-request") {
      aSubject.QueryInterface(Ci.prplIBuddyRequest);
      let bundle = document.getElementById("chatBundle");
      let label = bundle.getFormattedString("buddy.authRequest.label",
                                            [aSubject.userName]);
      let value =
        "buddy-auth-request-" + aSubject.account.id + aSubject.userName;
      let acceptButton = {
        accessKey: bundle.getString("buddy.authRequest.allow.accesskey"),
        label: bundle.getString("buddy.authRequest.allow.label"),
        callback: function() { aSubject.grant(); }
      };
      let denyButton = {
        accessKey: bundle.getString("buddy.authRequest.deny.accesskey"),
        label: bundle.getString("buddy.authRequest.deny.label"),
        callback: function() { aSubject.deny(); }
      };
      let box = document.getElementById("chatTabPanel");
      box.appendNotification(label, value, null, box.PRIORITY_INFO_HIGH,
                            [acceptButton, denyButton]);
      if (!gChatTab) {
        let tabmail = document.getElementById("tabmail");
        tabmail.openTab("chat", {background: true});
      }
      return;
    }
    if (aTopic == "buddy-authorization-request-canceled") {
      aSubject.QueryInterface(Ci.prplIBuddyRequest);
      let value =
        "buddy-auth-request-" + aSubject.account.id + aSubject.userName;
      let notification =
        document.getElementById("chatTabPanel")
                .getNotificationWithValue(value);
      if (notification)
        notification.close();
      return;
    }
  },
  initAfterChatCore: function() {
    let onGroup = document.getElementById("onlinecontactsGroup");
    let offGroup = document.getElementById("offlinecontactsGroup");

    for each (let contact in chatHandler.allContacts) {
      let group = contact.online ? onGroup : offGroup;
      group.addContact(contact);
    }

    onGroup._updateGroupLabel();
    offGroup._updateGroupLabel();

    ["new-text", "new-ui-conversation", "ui-conversation-closed",
     "contact-signed-on", "contact-signed-off",
     "contact-added", "contact-removed", "contact-no-longer-dummy",
     "account-connected", "account-disconnected",
     "account-added","account-removed"
    ].forEach(chatHandler._addObserver);

    chatHandler._updateNoConvPlaceHolder();
    statusSelector.init();
  },
  _observedTopics: [],
  _addObserver: function(aTopic) {
    imServices.obs.addObserver(chatHandler, aTopic, false);
    chatHandler._observedTopics.push(aTopic);
  },
  _removeObservers: function() {
    for each (let topic in this._observedTopics)
      imServices.obs.removeObserver(this, topic);
  },
  init: function() {
    if (!Services.prefs.getBoolPref("mail.chat.enabled")) {
      ["button-chat", "menu_goChat", "goChatSeparator",
       "imAccountsStatus", "joinChatMenuItem", "newIMAccountMenuItem",
       "newIMContactMenuItem", "appmenu_joinChatMenuItem",
       "appmenu_newIMAccountMenuItem", "appmenu_newIMContactMenuItem"].forEach(function(aId) {
         let elt = document.getElementById(aId);
         if (elt)
           elt.hidden = true;
       });
      document.getElementById("key_goChat").disabled = true;
      return;
    }

    window.addEventListener("unload", this._removeObservers.bind(this));

    // initialize the customizeDone method on the customizeable toolbar
    var toolbox = document.getElementById("chat-view-toolbox");
    toolbox.customizeDone = function(aEvent) {
      MailToolboxCustomizeDone(aEvent, "CustomizeChatToolbar");
    };

    let tabmail = document.getElementById("tabmail");
    tabmail.registerTabType(chatTabType);
    this._addObserver("buddy-authorization-request");
    this._addObserver("buddy-authorization-request-canceled");
    let listbox = document.getElementById("contactlistbox");
    listbox.addEventListener("keypress", function(aEvent) {
      let item = listbox.selectedItem;
      if (!item || !item.parentNode) // empty list or item no longer in the list
        return;
      item.keyPress(aEvent);
    });
    listbox.addEventListener("select", this.onListItemSelected.bind(this));
    listbox.addEventListener("click", this.onListItemClick.bind(this));
    document.getElementById("chatTabPanel").addEventListener("keypress", function(aEvent) {
      let accelKeyPressed = Application.platformIsMac ? aEvent.metaKey : aEvent.ctrlKey;
      if (!accelKeyPressed ||
          (aEvent.keyCode != aEvent.DOM_VK_DOWN && aEvent.keyCode != aEvent.DOM_VK_UP))
        return;
      listbox._userSelecting = true;
      listbox.moveByOffset(aEvent.keyCode == aEvent.DOM_VK_DOWN ? 1 : -1, true, false);
      listbox._userSelecting = false;
      let item = listbox.selectedItem;
      if (item.localName == "imconv" && item.convView)
        item.convView.focus();
      else
        listbox.focus();
    });
    window.addEventListener("resize", this.onConvResize.bind(this));
    document.getElementById("conversationsGroup").sortComparator =
      function(a, b) a.title.toLowerCase().localeCompare(b.title.toLowerCase());

    Components.utils.import("resource:///modules/chatHandler.jsm", this);
    if (this.ChatCore.initialized)
      this.initAfterChatCore();
    else {
      this.ChatCore.init();
      this._addObserver("chat-core-initialized");
    }
  }
};

function chatLogTreeGroupItem(aTitle, aLogItems) {
  this._title = aTitle;
  this._children = aLogItems;
  for each (let child in this._children)
    child._parent = this;
  this._open = false;
}
chatLogTreeGroupItem.prototype = {
  getText: function() this._title,
  get id() this._title,
  get open() this._open,
  get level() 0,
  get _parent() null,
  get children() this._children,
  getProperties: function(aProps) {}
};

function chatLogTreeLogItem(aLog, aText, aLevel) {
  this.log = aLog;
  this._text = aText;
  this._level = aLevel;
}
chatLogTreeLogItem.prototype = {
  getText: function() this._text,
  get id() this.log.title,
  get open() false,
  get level() this._level,
  get children() [],
  getProperties: function(aProps) {}
};

function chatLogTreeView(aTree, aLogs) {
  this._tree = aTree;
  this._logs = aLogs;
  this._tree.view = this;
  this._rebuild();
}
chatLogTreeView.prototype = {
  __proto__: new PROTO_TREE_VIEW(),

  _rebuild: function cLTV__rebuild() {
    // Some date helpers...
    const kDayInMsecs = 24 * 60 * 60 * 1000;
    const kWeekInMsecs = 7 * kDayInMsecs;
    const kTwoWeeksInMsecs = 2 * kWeekInMsecs;

    // Drop the old rowMap.
    if (this._tree)
      this._tree.rowCountChanged(0, -this._rowMap.length);
    this._rowMap = [];

    // The keys used in the 'groups' object should match string ids in
    // messenger.properties, except 'other' that has a special handling.
    let groups = {
      lastWeek: [],
      twoWeeksAgo: [],
      other: []
    };

    // today and yesterday are treated differently, because they represent
    // individual logs, and are not "groups".
    let today = null, yesterday = null;

    let dts = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                        .getService(Ci.nsIScriptableDateFormat);
    let formatDate = function(aDate) {
      return dts.FormatDate("", dts.dateFormatShort, aDate.getFullYear(),
                            aDate.getMonth() + 1, aDate.getDate());
    };
    let nowDate = new Date();
    let todayDate = new Date(nowDate.getFullYear(), nowDate.getMonth(),
                             nowDate.getDate());

    // Build a chatLogTreeLogItem for each log, and put it in the right group.
    let msgBundle = document.getElementById("bundle_messenger");

    for each (let log in fixIterator(this._logs)) {
      let logDate = new Date(log.time * 1000);
      let timeFromToday = todayDate - logDate;
      let title = formatDate(logDate);
      let group;
      if (timeFromToday <= 0) {
        today = new chatLogTreeLogItem(log, msgBundle.getString("today"), 0);
        continue;
      }
      else if (timeFromToday <= kDayInMsecs) {
        yesterday = new chatLogTreeLogItem(log, msgBundle.getString("yesterday"), 0);
        continue;
      }
      else if (timeFromToday <= kWeekInMsecs)
        group = groups.lastWeek;
      else if (timeFromToday <= kTwoWeeksInMsecs)
        group = groups.twoWeeksAgo;
      else
        group = groups.other;
      group.push(new chatLogTreeLogItem(log, title, 1));
    }

    if (today)
      this._rowMap.push(today);
    if (yesterday)
      this._rowMap.push(yesterday);

    for each (let [groupId, group] in Iterator(groups)) {
      if (!group.length)
        continue;

      group.sort(function(l1, l2) l2.log.time - l1.log.time);

      let groupName;
      if (groupId == "other") {
        // If we're in the "other" group, the title will be the end and
        // beginning dates for that group.
        // Example: 28/08/2012 - 04/01/2012
        groupName = formatDate(new Date(group[0].log.time * 1000));
        if (group.length > 1) {
          let fromDate = new Date(group[group.length - 1].log.time * 1000);
          groupName += " - " + formatDate(fromDate);
        }
      }
      else {
        // Otherwise, get the appropriate string for this group.
        groupName = msgBundle.getString(groupId);
      }
      this._rowMap.push(new chatLogTreeGroupItem(groupName, group));
    }

    // Finally, notify the tree.
    if (this._tree)
      this._tree.rowCountChanged(0, this._rowMap.length);
  }
};

window.addEventListener("load", chatHandler.init.bind(chatHandler));
