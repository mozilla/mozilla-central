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
 * The Original Code is autoconfig test code.
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

/*
 * Tests for the MailServices module.
 */

Components.utils.import("resource:///modules/mailServices.js");

function check_service(aService, aInterface) {
  do_check_true(aService in MailServices);
  do_check_true(MailServices[aService] instanceof aInterface);
}

function check_services() {
  check_service("mailSession", Ci.nsIMsgMailSession);
  check_service("accounts", Ci.nsIMsgAccountManager);
  check_service("pop3", Ci.nsIPop3Service);
  check_service("imap", Ci.nsIImapService);
  check_service("nntp", Ci.nsINntpService);
  check_service("smtp", Ci.nsISmtpService);
  check_service("compose", Ci.nsIMsgComposeService);
  check_service("ab", Ci.nsIAbManager);
  check_service("copy", Ci.nsIMsgCopyService);
  check_service("mfn", Ci.nsIMsgFolderNotificationService);
  check_service("headerParser", Ci.nsIMsgHeaderParser);
  check_service("mimeConverter", Ci.nsIMimeConverter);
  check_service("tags", Ci.nsIMsgTagService);
  check_service("filters", Ci.nsIMsgFilterService);
  check_service("junk", Ci.nsIJunkMailPlugin);
}

function run_test() {
  check_services();
}
