/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
  * You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource:///modules/cloudFileAccounts.js");

const kUploadNotificationValue = "bigAttachmentUploading";
const kPrivacyWarningNotificationValue = "bigAttachmentPrivacyWarning";

var gBigFileObserver = {
  bigFiles: [],
  sessionHidden: false,
  privacyWarned: false,

  get hidden() {
    return this.sessionHidden ||
           !Services.prefs.getBoolPref("mail.cloud_files.enabled") ||
           !Services.prefs.getBoolPref("mail.compose.big_attachments.notify") ||
           Services.io.offline;
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
    bucket.addEventListener("attachments-uploading", this, false);
    bucket.addEventListener("attachment-uploaded", this, false);
    bucket.addEventListener("attachment-upload-failed", this, false);
    bucket.addEventListener("attachments-converted", this, false);

    this.sessionHidden = false;
    this.privacyWarned = false;
    this.bigFiles = [];
  },

  uninit: function() {
    let bucket = document.getElementById("attachmentBucket");
    bucket.removeEventListener("attachments-added", this, false);
    bucket.removeEventListener("attachments-removed", this, false);
    bucket.removeEventListener("attachments-uploading", this, false);
    bucket.removeEventListener("attachment-uploaded", this, false);
    bucket.removeEventListener("attachment-upload-failed", this, false);
    bucket.removeEventListener("attachments-converted", this, false);

    let nb = document.getElementById("attachmentNotificationBox");

    let removeValues = [kUploadNotificationValue,
                        kPrivacyWarningNotificationValue];

    for each (let [, value] in Iterator(removeValues)) {
      let notification = nb.getNotificationWithValue(value);
      if (notification) {
        nb.removeNotification(notification);
      }
    };
  },

  handleEvent: function(event) {
    if (this.hidden)
      return;

    const bucketCallbacks = {
      "attachments-added": this.attachmentsAdded,
      "attachments-removed": this.attachmentsRemoved,
      "attachments-converted": this.attachmentsConverted,
      "attachments-uploading": this.attachmentsUploading,
    };

    const itemCallbacks = {
      "attachment-uploaded": this.attachmentUploaded,
      "attachment-upload-failed": this.attachmentUploadFailed,
    }

    if (event.type in bucketCallbacks)
      bucketCallbacks[event.type].call(this, event.detail);

    if (event.type in itemCallbacks)
      itemCallbacks[event.type].call(this, event.target,
                                     ("detail" in event) ? event.detail : null);

    this.updateNotification();
  },

  formatString: function (key, replacements, plural) {
    let str = getComposeBundle().getString(key);
    if (plural !== undefined)
      str = PluralForm.get(plural, str);
    if (replacements !== undefined) {
      for (let i = 0; i < replacements.length; i++)
        str = str.replace("#" + (i + 1), replacements[i]);
    }
    return str;
  },

  attachmentsAdded: function(aAttachments) {
    let threshold = Services.prefs.getIntPref(
                    "mail.compose.big_attachments.threshold_kb") * 1024;

    for (let attachment in fixIterator(
         aAttachments, Components.interfaces.nsIMsgAttachment)) {
      if (attachment.size >= threshold && !attachment.sendViaCloud)
        this.bigFiles.push(attachment);
    }
  },

  attachmentsRemoved: function(aAttachments) {
    for (let attachment in fixIterator(
         aAttachments, Components.interfaces.nsIMsgAttachment)) {
      let index = this.bigFiles.indexOf(attachment);
      if (index != -1)
        this.bigFiles.splice(index, 1);
    }
  },

  attachmentsConverted: function(aAttachments) {
    let uploaded = [];

    for (let attachment in fixIterator(
         aAttachments, Components.interfaces.nsIMsgAttachment)) {
      if (attachment.sendViaCloud) {
        this.attachmentsRemoved([attachment]);
        uploaded.push(attachment);
      }
    }

    if (uploaded.length)
      this.showUploadingNotification(uploaded);
  },

  attachmentsUploading: function(aAttachments) {
    this.showUploadingNotification(aAttachments);
  },

  attachmentUploaded: function(aAttachment) {
    if (!this._anyUploadsInProgress()) {
      this.hideUploadingNotification();

      if (!this.privacyWarned) {
        this.showPrivacyNotification();
        this.privacyWarned = true;
      }
    }
  },

  attachmentUploadFailed: function(aAttachment, aStatusCode) {
    if (!this._anyUploadsInProgress())
      this.hideUploadingNotification();
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

    if (accounts.length == 1) {
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

  showUploadingNotification: function(aAttachments) {
    // We will show the uploading notification for a minimum of 2.5 seconds
    // seconds.
    const kThreshold = 2500; // milliseconds

    if (!aAttachments.length ||
        !Services.prefs
                 .getBoolPref("mail.compose.big_attachments.insert_notification"))
      return;

    let nb = document.getElementById("attachmentNotificationBox");
    let notification = nb.getNotificationWithValue(kUploadNotificationValue);

    if (notification)
      return;

    let message = this.formatString("cloudFileUploadingNotification");
    message = PluralForm.get(aAttachments.length, message);
    let showUploadButton = {
      accessKey: this.formatString("stopShowingUploadingNotification.accesskey"),
      label: this.formatString("stopShowingUploadingNotification.label"),
      callback: function (aNotificationBar, aButton)
      {
        Services.prefs.setBoolPref("mail.compose.big_attachments.insert_notification", false);
      }
    };
    notification = nb.appendNotification(message, kUploadNotificationValue,
                                         "null", nb.PRIORITY_WARNING_MEDIUM,
                                         [showUploadButton]);
    notification.timeout = Date.now() + kThreshold;
  },

  hideUploadingNotification: function() {
    let nb = document.getElementById("attachmentNotificationBox");
    let notification = nb.getNotificationWithValue(kUploadNotificationValue);

    if (notification) {
      // Check the timestamp that we stashed in the timeout field of the
      // notification...
      let now = Date.now();
      if (now >= notification.timeout) {
        nb.removeNotification(notification);
      } else {
        setTimeout(function() {
          nb.removeNotification(notification);
        }, notification.timeout - now);
      }
    }
  },

  showPrivacyNotification: function() {
    const kPrivacyNotificationValue = "bigAttachmentPrivacyWarning";

    let nb = document.getElementById("attachmentNotificationBox");
    let notification = nb.getNotificationWithValue(kPrivacyNotificationValue);

    if (notification)
      return;

    let message = this.formatString("cloudFilePrivacyNotification");
    nb.appendNotification(message, kPrivacyNotificationValue, "null",
                          nb.PRIORITY_WARNING_MEDIUM, null);

  },

  _anyUploadsInProgress: function() {
    let bucket = document.getElementById("attachmentBucket");
    let rowCount = bucket.getRowCount();
    for (let i = 0; i < bucket.getRowCount(); ++i) {
      let item = bucket.getItemAtIndex(i);
      if (item && item.uploading)
        return true;
    }
    return false;
  },

};

window.addEventListener("compose-window-init",
  gBigFileObserver.init.bind(gBigFileObserver), true);
window.addEventListener("compose-window-close",
  gBigFileObserver.uninit.bind(gBigFileObserver), true);
