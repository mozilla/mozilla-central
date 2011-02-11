/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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
