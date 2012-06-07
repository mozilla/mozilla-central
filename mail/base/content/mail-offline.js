/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var MailOfflineMgr = {
  offlineManager: null,
  offlineBundle: null,

  init: function()
  {
    var os = Components.classes["@mozilla.org/observer-service;1"]
              .getService(Components.interfaces.nsIObserverService);
    os.addObserver(this, "network:offline-status-changed", false);

    this.offlineManager = Components.classes["@mozilla.org/messenger/offline-manager;1"]                 
                        .getService(Components.interfaces.nsIMsgOfflineManager);
    this.offlineBundle = document.getElementById("bundle_offlinePrompts");

    // initialize our offline state UI
    this.updateOfflineUI(!this.isOnline());
  },

  uninit: function()
  {
    var os = Components.classes["@mozilla.org/observer-service;1"]
              .getService(Components.interfaces.nsIObserverService);
    os.removeObserver(this, "network:offline-status-changed");
  },

  /**
   * @return true if we are online
   */
   isOnline: function()
   {
      var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                             .getService(Components.interfaces.nsIIOService);
      return (!ioService.offline);
   },

  /**
   * Toggles the online / offline state, initiated by the user. Depending on user settings
   * we may prompt the user to send unsent messages when going online or to download messages for
   * offline use when going offline.
   */
  toggleOfflineStatus: function()
  {
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
                      .getService(Components.interfaces.nsIIOService2);
    // the offline manager(goOnline and synchronizeForOffline) actually does the dirty work of 
    // changing the offline state with the networking service.
    if (!this.isOnline()) 
    {
      // We do the go online stuff in our listener for the online state change.
      ioService.offline = false;
      // resume managing offline status now that we are going back online.
      ioService.manageOfflineStatus = gPrefBranch.getBoolPref("offline.autoDetect");
    }
    else // going offline
    {
      // Stop automatic management of the offline status since the user has
      // decided to go offline.
      ioService.manageOfflineStatus = false;
      var prefDownloadMessages = gPrefBranch.getIntPref("offline.download.download_messages");
      // 0 == Ask, 1 == Always Download, 2 == Never Download
      var downloadForOfflineUse = (prefDownloadMessages == 0 && this.confirmDownloadMessagesForOfflineUse())
                                  || prefDownloadMessages == 1;
      this.offlineManager.synchronizeForOffline(downloadForOfflineUse, downloadForOfflineUse, false, true, msgWindow);
    }
  },

  observe: function (aSubject, aTopic, aState)
  {
    if (aTopic == "network:offline-status-changed")
      this.mailOfflineStateChanged(aState == "offline");
  },

  /**
   * @return true if there are unsent messages
   */
  haveUnsentMessages: function()
  {
    return Components.classes["@mozilla.org/messengercompose/sendlater;1"]
                     .getService(Components.interfaces.nsIMsgSendLater)
                     .hasUnsentMessages();
  },

  /**
   * open the offline panel in the account manager for the currently loaded
   * account.
   */
  openOfflineAccountSettings: function()
  {
    window.parent.MsgAccountManager('am-offline.xul');
  },

  /**
   * Prompt the user about going online to send unsent messages, and then send them
   * if appropriate. Puts the app back into online mode.
   *
   * @param aMsgWindow the msg window to be used when going online
   */
  goOnlineToSendMessages: function(aMsgWindow)
  {
    const nsIPS = Components.interfaces.nsIPromptService;
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(nsIPS);
    var goOnlineToSendMsgs = promptService.confirm(window, 
                                                   this.offlineBundle.getString('sendMessagesOfflineWindowTitle1'), 
                                                   this.offlineBundle.getString('sendMessagesOfflineLabel1'));
    if (goOnlineToSendMsgs)
      this.offlineManager.goOnline(true /* send unsent messages*/, false, aMsgWindow);
  },

  /**
   * Prompts the user to confirm sending of unsent messages. This is different from 
   * goOnlineToSendMessages which involves going online to send unsent messages.
   *
   * @return true if the user wants to send unsent messages
   */
  confirmSendUnsentMessages: function()
  {
    const nsIPS = Components.interfaces.nsIPromptService;
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(nsIPS);
    var alwaysAsk = {value: true};
    var sendUnsentMessages = promptService.confirmEx(window, 
                                                     this.offlineBundle.getString('sendMessagesWindowTitle1'), 
                                                     this.offlineBundle.getString('sendMessagesLabel2'),
                                                     nsIPS.STD_YES_NO_BUTTONS,
                                                     null, null, null,
                                                     this.offlineBundle.getString('sendMessagesCheckboxLabel1'), 
                                                     alwaysAsk) == 0 ? true : false;

    // if the user changed the ask me setting then update the global pref based on their yes / no answer
    if (!alwaysAsk.value)
      gPrefBranch.setIntPref("offline.send.unsent_messages", sendUnsentMessages ? 1 : 2);
    return sendUnsentMessages;
  },

  /**
   * Should we send unsent messages? Based on the value of
   * offline.send.unsent_messages, this method may prompt the user.
   * @return true if we should send unsent messages
   */
  shouldSendUnsentMessages: function()
  {
    var sendUnsentWhenGoingOnlinePref = gPrefBranch.getIntPref("offline.send.unsent_messages");
    if(sendUnsentWhenGoingOnlinePref == 2) // never send
      return false;

    // if we we have unsent messages, then honor the offline.send.unsent_messages pref.
    else if (this.haveUnsentMessages())
    {
      if ((sendUnsentWhenGoingOnlinePref == 0 && this.confirmSendUnsentMessages())
           || sendUnsentWhenGoingOnlinePref == 1)
        return true;
    }
    return false;
  },

  /**
   * Prompts the user to download messages for offline use before going offline.
   * May update the value of offline.download.download_messages
   *
   * @return true if the user wants to download messages for offline use.
   */
  confirmDownloadMessagesForOfflineUse: function()
  {
    const nsIPS = Components.interfaces.nsIPromptService;
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(nsIPS);
    var alwaysAsk = {value: true};
    var downloadMessages = promptService.confirmEx(window, 
                                                   this.offlineBundle.getString('downloadMessagesWindowTitle1'), 
                                                   this.offlineBundle.getString('downloadMessagesLabel1'),
                                                   nsIPS.STD_YES_NO_BUTTONS,
                                                   null, null, null,
                                                   this.offlineBundle.getString('downloadMessagesCheckboxLabel1'), 
                                                   alwaysAsk) == 0 ? true : false;

    // if the user changed the ask me setting then update the global pref based on their yes / no answer
    if (!alwaysAsk.value)
      gPrefBranch.setIntPref("offline.download.download_messages", downloadMessages ? 1 : 2);
    return downloadMessages;      
  },

  /** 
   *  Get New Mail When Offline
   *  Prompts the user about going online in order to download new messages. 
   *  Based on the response, will move us back to online mode.
   *
   * @return true if the user confirms going online.
   */
  getNewMail: function()
  {
    const nsIPS = Components.interfaces.nsIPromptService;
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(nsIPS);
    var goOnline =  promptService.confirm(window, 
                                          this.offlineBundle.getString('getMessagesOfflineWindowTitle1'), 
                                          this.offlineBundle.getString('getMessagesOfflineLabel1'));    
    if (goOnline)
      this.offlineManager.goOnline(this.shouldSendUnsentMessages(),
                                   false /* playbackOfflineImapOperations */, msgWindow);
    return goOnline;
  },

  /** 
   * Private helper method to update the state of the Offline menu item
   * and the offline status bar indicator
   */
  updateOfflineUI: function(aIsOffline)
  {
    document.getElementById('goOfflineMenuItem').setAttribute("checked", aIsOffline);
    var statusBarPanel = document.getElementById('offline-status');
    if (aIsOffline)
    {
      statusBarPanel.setAttribute("offline", "true");
      statusBarPanel.setAttribute("tooltiptext", this.offlineBundle.getString("offlineTooltip"));
    }
    else
    {
      statusBarPanel.removeAttribute("offline");
      statusBarPanel.setAttribute("tooltiptext", this.offlineBundle.getString("onlineTooltip"));
    }
  },

  /**
   * private helper method called whenever we detect a change to the offline state
   */ 
  mailOfflineStateChanged: function (aGoingOffline)
  {
    this.updateOfflineUI(aGoingOffline);
    if (!aGoingOffline)
    {
      let prefSendUnsentMessages = gPrefBranch.getIntPref("offline.send.unsent_messages");
      // 0 == Ask, 1 == Always Send, 2 == Never Send
      let sendUnsentMessages = (prefSendUnsentMessages == 0 &&
                                this.haveUnsentMessages() &&
                                this.confirmSendUnsentMessages()) ||
                               prefSendUnsentMessages == 1;
      this.offlineManager.goOnline(sendUnsentMessages, true, msgWindow);
    }
  }
};
