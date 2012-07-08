/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let EXPORTED_SYMBOLS = ["MailServices"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

let MailServices = {};

XPCOMUtils.defineLazyServiceGetter(MailServices, "mailSession",
                                   "@mozilla.org/messenger/services/session;1",
                                   "nsIMsgMailSession");

XPCOMUtils.defineLazyServiceGetter(MailServices, "accounts",
                                   "@mozilla.org/messenger/account-manager;1",
                                   "nsIMsgAccountManager");

XPCOMUtils.defineLazyServiceGetter(MailServices, "pop3",
                                   "@mozilla.org/messenger/popservice;1",
                                   "nsIPop3Service");

XPCOMUtils.defineLazyServiceGetter(MailServices, "imap",
                                   "@mozilla.org/messenger/imapservice;1",
                                   "nsIImapService");

XPCOMUtils.defineLazyServiceGetter(MailServices, "nntp",
                                   "@mozilla.org/messenger/nntpservice;1",
                                   "nsINntpService");

XPCOMUtils.defineLazyServiceGetter(MailServices, "smtp",
                                   "@mozilla.org/messengercompose/smtp;1",
                                   "nsISmtpService");

XPCOMUtils.defineLazyServiceGetter(MailServices, "compose",
                                   "@mozilla.org/messengercompose;1",
                                   "nsIMsgComposeService");

XPCOMUtils.defineLazyServiceGetter(MailServices, "ab",
                                   "@mozilla.org/abmanager;1",
                                   "nsIAbManager");

XPCOMUtils.defineLazyServiceGetter(MailServices, "copy",
                                   "@mozilla.org/messenger/messagecopyservice;1",
                                   "nsIMsgCopyService");

XPCOMUtils.defineLazyServiceGetter(MailServices, "mfn",
                                   "@mozilla.org/messenger/msgnotificationservice;1",
                                   "nsIMsgFolderNotificationService");

XPCOMUtils.defineLazyServiceGetter(MailServices, "headerParser",
                                   "@mozilla.org/messenger/headerparser;1",
                                   "nsIMsgHeaderParser");

XPCOMUtils.defineLazyServiceGetter(MailServices, "mimeConverter",
                                   "@mozilla.org/messenger/mimeconverter;1",
                                   "nsIMimeConverter");

XPCOMUtils.defineLazyServiceGetter(MailServices, "tags",
                                   "@mozilla.org/messenger/tagservice;1",
                                   "nsIMsgTagService");

XPCOMUtils.defineLazyServiceGetter(MailServices, "filters",
                                   "@mozilla.org/messenger/services/filters;1",
                                   "nsIMsgFilterService");

XPCOMUtils.defineLazyServiceGetter(MailServices, "junk",
                                   "@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter",
                                   "nsIJunkMailPlugin");

XPCOMUtils.defineLazyServiceGetter(MailServices, "newMailNotification",
                                   "@mozilla.org/newMailNotificationService;1",
                                   "mozINewMailNotificationService");
