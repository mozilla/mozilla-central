/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
