/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// IWYU pragma: private, include "mozilla/mailnews/Services.h"

MOZ_SERVICE(AbManager,         nsIAbManager,
            "@mozilla.org/abmanager;1")
MOZ_SERVICE(AccountManager,    nsIMsgAccountManager,
            "@mozilla.org/messenger/account-manager;1")
MOZ_SERVICE(ComposeService,    nsIMsgComposeService,
            "@mozilla.org/messengercompose;1")
MOZ_SERVICE(CopyService,       nsIMsgCopyService,
            "@mozilla.org/messenger/messagecopyservice;1")
MOZ_SERVICE(DBService,         nsIMsgDBService,
            "@mozilla.org/msgDatabase/msgDBService;1")
MOZ_SERVICE(FilterService,     nsIMsgFilterService,
            "@mozilla.org/messenger/services/filters;1")
MOZ_SERVICE(HeaderParser,      nsIMsgHeaderParser,
            "@mozilla.org/messenger/headerparser;1")
MOZ_SERVICE(ImapService,       nsIImapService,
            "@mozilla.org/messenger/imapservice;1")
MOZ_SERVICE(ImportService,     nsIImportService,
            "@mozilla.org/import/import-service;1")
MOZ_SERVICE(MailNotifyService, mozINewMailNotificationService,
            "@mozilla.org/newMailNotificationService;1")
MOZ_SERVICE(MailSession,       nsIMsgMailSession,
            "@mozilla.org/messenger/services/session;1")
MOZ_SERVICE(MimeConverter,     nsIMimeConverter,
            "@mozilla.org/messenger/mimeconverter;1")
MOZ_SERVICE(MFNService,        nsIMsgFolderNotificationService,
            "@mozilla.org/messenger/msgnotificationservice;1")
MOZ_SERVICE(NntpService,       nsINntpService,
            "@mozilla.org/messenger/nntpservice;1")
MOZ_SERVICE(Pop3Service,       nsIPop3Service,
            "@mozilla.org/messenger/popservice;1")
MOZ_SERVICE(SmtpService,       nsISmtpService,
            "@mozilla.org/messengercompose/smtp;1")
MOZ_SERVICE(TagService,        nsIMsgTagService,
            "@mozilla.org/messenger/tagservice;1")
