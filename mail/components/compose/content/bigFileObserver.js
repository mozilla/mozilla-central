/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
  * You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/cloudFileAccounts.js");

var gBigFileObserver = {
  bigFiles: [],
  sessionHidden: false,

  get hidden() {
    return this.sessionHidden ||
           !Services.prefs.getBoolPref("mail.cloud_files.enabled") ||
           !Services.prefs.getBoolPref("mail.compose.big_attachments.notify");
  },
  hide: function(aPermanent) {
    if (aPermanent)
      Services.prefs.setBoolPref("mail.compose.big_attachments.notify", false);
    else
      this.sessionHidden = true;
  },

  init: function() {
    let bucket = document.getElementById("attachmentBucket");
    bucket.addEventListener("attachments-added", this, false);
    bucket.addEventListener("attachments-removed", this, false);
    bucket.addEventListener("attachment-renamed", this, false);

    this.sessionHidden = false;
    this.bigFiles = [];
  },

  uninit: function() {
    let bucket = document.getElementById("attachmentBucket");
    bucket.removeEventListener("attachments-added", this, false);
    bucket.removeEventListener("attachments-removed", this, false);
    bucket.removeEventListener("attachment-renamed", this, false);
  },

  handleEvent: function(event) {
    if (this.hidden)
      return;

    const callbacks = {
      "attachments-added": this.attachmentAdded,
      "attachments-removed": this.attachmentRemoved,
      "attachments-converted": this.attachmentConverted,
    };

    for (let attachment in fixIterator(
         event.detail, Components.interfaces.nsIMsgAttachment)) {
      callbacks[event.type].call(this, attachment);
    }
    this.updateNotification();
  },

  formatString: function (key, replacements, plural) {
    let str = getComposeBundle().getString(key);
    if (plural !== undefined)
      str = PluralForm.get(plural, str);
    if (replacements !== undefined) {
      for (let i = 0; i < replacements.length; i++)
        str = str.replace("#" + (i+1), replacements[i]);
    }
    return str;
  },

  attachmentAdded: function(aAttachment) {
    let threshold = Services.prefs.getIntPref(
                    "mail.compose.big_attachments.threshold_kb") * 1024;

    if (aAttachment.size >= threshold && !aAttachment.sendViaCloud)
      this.bigFiles.push(aAttachment);
  },

  attachmentRemoved: function(aAttachment) {
    let index = this.bigFiles.indexOf(aAttachment);
    if (index != -1)
      this.bigFiles.splice(index, 1);
  },

  attachmentConverted: function(aAttachment) {
    if (aAttachment.sendViaCloud)
      this.attachmentRemoved(aAttachment);
    else
      this.attachmentAdded(aAttachment);
  },

  updateNotification: function() {
    let nb = document.getElementById("attachmentNotificationBox");
    let notification = nb.getNotificationWithValue("bigAttachment");
    let numAccounts = cloudFileAccounts.accounts.length;

    if (this.bigFiles.length) {
      if (notification) {
        notification.label = this.formatString("bigFileDescription",
                                               [this.bigFiles.length],
                                               this.bigFiles.length);
        return;
      }

      let buttons = [
        {
          label: getComposeBundle().getString("learnMore.label"),
          accessKey: getComposeBundle().getString("learnMore.accesskey"),
          callback: this.openLearnMore.bind(this),
        },
        { label: this.formatString("bigFileShare.label",
                                   []),
          accessKey: this.formatString("bigFileShare.accesskey"),
          callback: this.convertAttachments.bind(this),
        },

        { label: this.formatString("bigFileAttach.label",
                                   []),
          accessKey: this.formatString("bigFileAttach.accesskey"),
          callback: this.hideNotification.bind(this),
        },
      ];

      let msg = this.formatString("bigFileDescription", [this.bigFiles.length],
                                  this.bigFiles.length);

      notification = nb.appendNotification(msg, "bigAttachment", "null",
                                           nb.PRIORITY_WARNING_MEDIUM,
                                           buttons);
    }
    else {
      if (notification)
        nb.removeNotification(notification);
    }
  },

  openLearnMore: function() {
    let url = Services.prefs.getCharPref("mail.cloud_files.learn_more_url");
    openContentTab(url);
    return true;
  },

  convertAttachments: function() {
    let cloudProvider;
    let accounts = cloudFileAccounts.accounts;

    if(accounts.length == 1) {
      cloudProvider = accounts[0];
    }
    else if(accounts.length > 1) {
      let selection = {};
      let names = [cloudFileAccounts.getDisplayName(i) for each (i in accounts)];
      if (Services.prompt.select(window,
                                 this.formatString("bigFileChooseAccount.title"),
                                 this.formatString("bigFileChooseAccount.text"),
                                 names.length, names, selection))
        cloudProvider = accounts[selection.value];
    }
    else {
      let accountKey = cloudFileAccounts.addAccountDialog();
      if (accountKey)
        cloudProvider = cloudFileAccounts.getAccount(accountKey);
      else
        return true;
    }

    if (cloudProvider)
      convertToCloudAttachment(this.bigFiles, cloudProvider);
  },

  hideNotification: function() {
    let never = {};
    if (Services.prompt.confirmCheck(window,
                                     this.formatString("bigFileHideNotification.title"),
                                     this.formatString("bigFileHideNotification.text"),
                                     this.formatString("bigFileHideNotification.check"),
                                     never))
      this.hide(never.value);
    else
      return true;
  },
};

document.documentElement.addEventListener("compose-window-init",
  gBigFileObserver.init.bind(gBigFileObserver), false);
document.documentElement.addEventListener("compose-window-close",
  gBigFileObserver.uninit.bind(gBigFileObserver), false);
