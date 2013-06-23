/* -*- Mode: javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// SpaceHit() function: whether spacebar advances to next unread message.
pref("mail.advance_on_spacebar", true);

//mailnews.timeline_is_enabled should be set to true ONLY for perf measurement-timeline builds.
pref("mailnews.timeline_is_enabled", false);

pref("mailnews.logComposePerformance", false);

pref("mail.wrap_long_lines",                true);
pref("mail.inline_attachments",             true);
pref("mail.reply_quote_inline",             false);

// hidden pref for controlling if the user agent string
// is displayed in the message pane or not...
pref("mailnews.headers.showUserAgent",       false);

// hidden pref for controlling if the organization string
// is displayed in the message pane or not...
pref("mailnews.headers.showOrganization",    false);

// hidden pref for controlling if the references header
// is displayed in the message pane or not...
pref("mailnews.headers.showReferences",      false);

// hidden pref for controlling if the message-id header
// is displayed in the message pane or not...
pref("mailnews.headers.showMessageId",       false);

// hidden pref for controlling if the message to a message-id
// is opened in a new window or in the same window
pref("mailnews.messageid.openInNewWindow",   false);

// hidden pref for url which will be used to open  message-ids
// in browser (%mid ist replaced with the message-id)
pref("mailnews.messageid_browser.url", "chrome://messenger-region/locale/region.properties");


// hidden pref for whether or not to warn when deleting filters. Default YES
pref("mailnews.filters.confirm_delete", true);

// space-delimited list of extra headers to show in msg header display area.
pref("mailnews.headers.extraExpandedHeaders", "");

// default sort order settings (when creating new folder views)
// sort_order is an int value reflecting nsMsgViewSortOrder values
//   as defined in nsIMsgDBView.idl (ascending = 1, descending = 2)
// sort_type is an int value reflecting nsMsgViewSortType values
//   as defined in nsIMsgDBView.idl (byDate = 18, byId = 21 etc.)
pref("mailnews.default_sort_order", 1); // for Mail/RSS/... (nsMsgDatabase)
pref("mailnews.default_sort_type", 18); //
pref("mailnews.default_news_sort_order", 1); // for News (nsNewsDatabase)
pref("mailnews.default_news_sort_type", 21); //

// default view flags for new folders
// both flags are int values reflecting nsMsgViewFlagsType values
// as defined in nsIMsgDBView.idl (kNone = 0, kThreadedDisplay = 1 etc.)
pref("mailnews.default_view_flags", 0); // for Mail/RSS/... (nsMsgDatabase)
pref("mailnews.default_news_view_flags", 1); // for News (nsNewsDatabase)

// If true, delete will use the direction of the sort order
// in determining the next message to select.
pref("mail.delete_matches_sort_order", false);

// mailnews tcp read+write timeout in seconds.
pref("mailnews.tcptimeout", 100);

pref("mailnews.headers.showSender", false);

// set to 0 if you don't want to ignore timestamp differences between
// local mail folders and the value stored in the corresponding .msf file.
// 0 was the default up to and including 1.5. I've made the default
// be greater than one hour so daylight savings time changes don't affect us.
// We will still always regenerate .msf files if the file size changes.
pref("mail.db_timestamp_leeway", 4000);
// How long should we leave idle db's open, in milliseconds.
pref("mail.db.idle_limit", 300000);
// How many db's should we leave open? LRU db's will be closed first
pref("mail.db.max_open", 30);

pref("mail.imap.chunk_size",                65536);
pref("mail.imap.min_chunk_size_threshold",  98304);
pref("mail.imap.chunk_fast",                2);
pref("mail.imap.chunk_ideal",               4);
pref("mail.imap.chunk_add",                 8192);
pref("mail.imap.hide_other_users",          false);
pref("mail.imap.hide_unused_namespaces",    true);
pref("mail.imap.auto_unsubscribe_from_noselect_folders",    true);
pref("mail.imap.mime_parts_on_demand",      true);
pref("mail.imap.mime_parts_on_demand_threshold", 30000);
pref("mail.imap.use_literal_plus",          true);
pref("mail.imap.expunge_after_delete",      false);
pref("mail.imap.check_deleted_before_expunge", false);
pref("mail.imap.expunge_option",            0);
pref("mail.imap.expunge_threshold_number",  20);
pref("mail.imap.hdr_chunk_size", 200);

// if true, we assume that a user access a folder in the other users namespace
// is acting as a delegate for that folder, and wishes to use the other users
// identity when acting on messages in other users folders.
pref("mail.imap.delegateOtherUsersFolders", false);
pref("mail.thread_without_re",              false); // if false, only thread by subject if Re:
pref("mail.strict_threading",               true);  // if true, don't thread by subject at all
pref("mail.correct_threading",              true);  // if true, makes sure threading works correctly always (see bug 181446)
pref("mail.pop3.deleteFromServerOnMove",    false);
pref("mail.fixed_width_messages",           true);
pref("mail.citation_color",                 "#000000"); // quoted color
pref("mail.quoted_style",                   0); // 0=plain, 1=bold, 2=italic, 3=bolditalic
pref("mail.quoted_size",                    0); // 0=normal, 1=big, 2=small
pref("mail.quoted_graphical",               true); // use HTML-style quoting for displaying plain text
pref("mail.quoteasblock",                   true); // use HTML-style quoting for quoting plain text
pref("mail.strictly_mime",                  false);
pref("mail.strictly_mime_headers",          true);
// 0/1 (name param is encoded in a legacy way), 2(RFC 2231 only)
// 0 the name param is never separated to multiple lines.
pref("mail.strictly_mime.parm_folding",     1);
pref("mail.label_ascii_only_mail_as_us_ascii", false);
pref("mail.file_attach_binary",             false);
pref("mail.show_headers",                   1); // some
pref("mail.pane_config.dynamic",            0);
pref("mail.addr_book.mapit_url.format", "chrome://messenger-region/locale/region.properties");
#ifdef MOZ_SUITE
pref("mailnews.start_page.url", "chrome://messenger-region/locale/region.properties");
pref("messenger.throbber.url", "chrome://messenger-region/locale/region.properties");
pref("compose.throbber.url", "chrome://messenger-region/locale/region.properties");
pref("addressbook.throbber.url", "chrome://messenger-region/locale/region.properties");
pref("mail.accountwizard.deferstorage", false);
// |false|: Show both name and address, even for people in my addressbook.
pref("mail.showCondensedAddresses", false);
#endif

// the format for "mail.addr_book.quicksearchquery.format" is:
// @V == the escaped value typed in the quick search bar in the addressbook
//
// note, changing this might require a change to SearchNameOrEmail.label in
// messenger.dtd or searchNameAndEmail.emptytext in abMainWindow.dtd
pref("mail.addr_book.quicksearchquery.format", "chrome://messenger/locale/messenger.properties");

// values for "mail.addr_book.lastnamefirst" are:
//0=displayname, 1=lastname first, 2=firstname first
pref("mail.addr_book.lastnamefirst", 0);
pref("mail.addr_book.displayName.autoGeneration", true);
pref("mail.addr_book.displayName.lastnamefirst", "chrome://messenger/locale/messenger.properties");
pref("mail.addr_book.show_phonetic_fields", "chrome://messenger/locale/messenger.properties");
pref("mail.html_compose",                   true);
// you can specify multiple, option headers
// this will show up in the address picker in the compose window
// examples: "X-Face" or "Approved,X-No-Archive"
pref("mail.compose.other.header", "");
pref("mail.compose.autosave", true);
pref("mail.compose.autosaveinterval", 5); // in minutes

pref("mail.default_html_action", 0);          // 0=ask, 1=plain, 2=html, 3=both

pref("mail.mdn.report.not_in_to_cc", 2);               // 0: Never 1: Always 2: Ask me
pref("mail.mdn.report.outside_domain", 2);             // 0: Never 1: Always 2: Ask me
pref("mail.mdn.report.other", 2);                      // 0: Never 1: Always 2: Ask me 3: Denial

pref("mail.incorporate.return_receipt", 0);            // 0: Inbox/filter 1: Sent folder
pref("mail.request.return_receipt", 2);                // 1: DSN 2: MDN 3: Both
pref("mail.receipt.request_header_type", 0);           // 0: MDN-DNT header  1: RRT header 2: Both (MC)
pref("mail.receipt.request_return_receipt_on", false);
pref("mail.mdn.report.enabled", true);                 // false: Never send true: Send sometimes

pref("mail.dsn.always_request_on", false);
pref("mail.dsn.request_on_success_on", true);          // DSN request is sent with SUCCESS option
pref("mail.dsn.request_on_failure_on", true);          // DSN request is sent with FAILURE option
pref("mail.dsn.request_on_delay_on", true);            // DSN request is sent with DELAY option
pref("mail.dsn.request_never_on", false);              // DSN request is not sent with NEVER option
pref("mail.dsn.ret_full_on", true);                    // DSN request is sent with RET FULL option

pref("news.show_size_in_lines",             true);
pref("news.update_unread_on_expand",        true);
pref("news.get_messages_on_select",         true);

pref("mailnews.wraplength",                 72);
pref("mail.compose.wrap_to_window_width",   false);

// 0=no header, 1="<author> wrote:", 2="On <date> <author> wrote:", 3="<author> wrote On <date>:", 4=user specified
pref("mailnews.reply_header_type",          1);
// locale which affects date format, set empty string to use application default locale
pref("mailnews.reply_header_locale",        "");
pref("mailnews.reply_header_authorwrote",   "chrome://messenger/locale/messengercompose/composeMsgs.properties");
pref("mailnews.reply_header_ondate",        "chrome://messenger/locale/messengercompose/composeMsgs.properties");

// separator to separate between date and author
pref("mailnews.reply_header_separator",     ", ");
pref("mailnews.reply_header_colon",         ":");
pref("mailnews.reply_header_originalmessage",   "chrome://messenger/locale/messengercompose/composeMsgs.properties");

pref("mailnews.reply_to_self_check_all_ident", false);

pref("mailnews.reply_quoting_selection",               true);
pref("mailnews.reply_quoting_selection.only_if_chars", "");
pref("mailnews.reply_quoting_selection.multi_word",    true);

pref("mail.operate_on_msgs_in_collapsed_threads", false);
pref("mail.warn_on_collapsed_thread_operation", true);
pref("mail.warn_on_shift_delete", true);
pref("news.warn_on_delete", true);
pref("mail.purge_threshhold_mb", 20);
pref("mail.prompt_purge_threshhold",       true);
pref("mail.purge.ask",                     true);

pref("mailnews.offline_sync_mail",         false);
pref("mailnews.offline_sync_news",         false);
pref("mailnews.offline_sync_send_unsent",  true);
pref("mailnews.offline_sync_work_offline", false);
pref("mailnews.force_ascii_search",        false);

pref("mailnews.send_default_charset",       "chrome://messenger/locale/messenger.properties");
pref("mailnews.view_default_charset",       "chrome://messenger/locale/messenger.properties");
pref("mailnews.force_charset_override",     false); // ignore specified MIME encoding and use the default encoding for display
pref("mailnews.reply_in_default_charset",   false);
// mailnews.disable_fallback_to_utf8.<charset>
// don't fallback from <charset> to UTF-8 even if some characters are not found in <charset>.
// those characters will be crippled.
pref("mailnews.disable_fallback_to_utf8.ISO-2022-JP", false);
pref("mailnews.localizedRe",                "chrome://messenger-region/locale/region.properties");

pref("mailnews.search_date_format",        "chrome://messenger/locale/messenger.properties");
pref("mailnews.search_date_separator",     "chrome://messenger/locale/messenger.properties");
pref("mailnews.search_date_leading_zeros", "chrome://messenger/locale/messenger.properties");

pref("mailnews.quotingPrefs.version",       0);  // used to decide whether to migrate global quoting prefs

// the first time, we'll warn the user about the blind send, and they can disable the warning if they want.
pref("mapi.blind-send.enabled",             true);

pref("offline.autoDetect",                  false); // automatically move the user offline or online based on the network connection

pref("ldap_2.autoComplete.useDirectory", false);
pref("ldap_2.autoComplete.directoryServer", "");

pref("ldap_2.servers.pab.position", 1);
pref("ldap_2.servers.pab.description", "chrome://messenger/locale/addressbook/addressBook.properties");
pref("ldap_2.servers.pab.dirType", 2);
pref("ldap_2.servers.pab.filename", "abook.mab");
pref("ldap_2.servers.pab.isOffline", false);

pref("ldap_2.servers.history.position", 2);
pref("ldap_2.servers.history.description", "chrome://messenger/locale/addressbook/addressBook.properties");
pref("ldap_2.servers.history.dirType", 2);
pref("ldap_2.servers.history.filename", "history.mab");
pref("ldap_2.servers.history.isOffline", false);

// default mapping of addressbook properties to ldap attributes
pref("ldap_2.servers.default.attrmap.FirstName", "givenName");
pref("ldap_2.servers.default.attrmap.LastName", "sn,surname");
pref("ldap_2.servers.default.attrmap.DisplayName", "cn,commonname");
pref("ldap_2.servers.default.attrmap.NickName", "mozillaNickname,xmozillanickname");
pref("ldap_2.servers.default.attrmap.PrimaryEmail", "mail");
pref("ldap_2.servers.default.attrmap.SecondEmail", "mozillaSecondEmail,xmozillasecondemail");
pref("ldap_2.servers.default.attrmap.WorkPhone", "telephoneNumber");
pref("ldap_2.servers.default.attrmap.HomePhone", "homePhone");
pref("ldap_2.servers.default.attrmap.FaxNumber", "facsimiletelephonenumber,fax");
pref("ldap_2.servers.default.attrmap.PagerNumber", "pager,pagerphone");
pref("ldap_2.servers.default.attrmap.CellularNumber", "mobile,cellphone,carphone");
pref("ldap_2.servers.default.attrmap.WorkAddress", "street,streetaddress,postOfficeBox");
pref("ldap_2.servers.default.attrmap.HomeAddress", "mozillaHomeStreet");
pref("ldap_2.servers.default.attrmap.WorkAddress2", "mozillaWorkStreet2");
pref("ldap_2.servers.default.attrmap.HomeAddress2", "mozillaHomeStreet2");
pref("ldap_2.servers.default.attrmap.WorkCity", "l,locality");
pref("ldap_2.servers.default.attrmap.HomeCity", "mozillaHomeLocalityName");
pref("ldap_2.servers.default.attrmap.WorkState", "st,region");
pref("ldap_2.servers.default.attrmap.HomeState", "mozillaHomeState");
pref("ldap_2.servers.default.attrmap.WorkZipCode", "postalCode,zip");
pref("ldap_2.servers.default.attrmap.HomeZipCode", "mozillaHomePostalCode");
pref("ldap_2.servers.default.attrmap.WorkCountry", "c,countryname");
pref("ldap_2.servers.default.attrmap.HomeCountry", "mozillaHomeCountryName");
pref("ldap_2.servers.default.attrmap.JobTitle", "title");
pref("ldap_2.servers.default.attrmap.Department", "ou,department,departmentnumber,orgunit");
pref("ldap_2.servers.default.attrmap.Company", "o,company");
pref("ldap_2.servers.default.attrmap._AimScreenName", "nsAIMid,nscpaimscreenname");
pref("ldap_2.servers.default.attrmap.WebPage1", "mozillaWorkUrl,workurl,labeledURI");
pref("ldap_2.servers.default.attrmap.WebPage2", "mozillaHomeUrl,homeurl");
pref("ldap_2.servers.default.attrmap.BirthYear", "birthyear");
pref("ldap_2.servers.default.attrmap.BirthMonth", "birthmonth");
pref("ldap_2.servers.default.attrmap.BirthDay", "birthday");
pref("ldap_2.servers.default.attrmap.Custom1", "mozillaCustom1,custom1");
pref("ldap_2.servers.default.attrmap.Custom2", "mozillaCustom2,custom2");
pref("ldap_2.servers.default.attrmap.Custom3", "mozillaCustom3,custom3");
pref("ldap_2.servers.default.attrmap.Custom4", "mozillaCustom4,custom4");
pref("ldap_2.servers.default.attrmap.Notes", "description,notes");
pref("ldap_2.servers.default.attrmap.PreferMailFormat", "mozillaUseHtmlMail,xmozillausehtmlmail");
pref("ldap_2.servers.default.attrmap.LastModifiedDate", "modifytimestamp");

pref("ldap_2.user_id", 0);
pref("ldap_2.version", 3); /* Update kCurrentListVersion in include/dirprefs.h if you change this */

pref("mailnews.confirm.moveFoldersToTrash", true);

// space-delimited list of extra headers to add to .msf file
pref("mailnews.customDBHeaders", "");

// close standalone message window when deleting the displayed message
pref("mail.close_message_window.on_delete", false);

#ifdef MOZ_SUITE
pref("mailnews.reuse_message_window", true);
#endif

pref("mailnews.open_window_warning", 10); // warn user if they attempt to open more than this many messages at once

pref("mailnews.start_page.enabled", true);

pref("mailnews.remember_selected_message", true);
pref("mailnews.scroll_to_new_message", true);

// if true, any click on a column header other than the thread column will unthread the view
pref("mailnews.thread_pane_column_unthreads", false);

pref("mailnews.account_central_page.url", "chrome://messenger/locale/messenger.properties");

/* default prefs for Mozilla 5.0 */
pref("mail.identity.default.compose_html", true);
pref("mail.identity.default.valid", true);
pref("mail.identity.default.fcc", true);
pref("mail.identity.default.fcc_folder", "mailbox://nobody@Local%20Folders/Sent");
pref("mail.identity.default.fcc_reply_follows_parent", false);
pref("mail.identity.default.autocompleteToMyDomain", false);

pref("mail.identity.default.archive_enabled", true);
// archive into 0: single folder, 1: yearly folder, 2: year/year-month folder
pref("mail.identity.default.archive_granularity", 1);
pref("mail.identity.default.archive_keep_folder_structure", false);

// keep these defaults for backwards compatibility and migration

// but .doBcc and .doBccList are the right ones from now on.
pref("mail.identity.default.bcc_self", false);
pref("mail.identity.default.bcc_others", false);
pref("mail.identity.default.bcc_list", "");

pref("mail.identity.default.draft_folder", "mailbox://nobody@Local%20Folders/Drafts");
pref("mail.identity.default.stationery_folder", "mailbox://nobody@Local%20Folders/Templates");
pref("mail.identity.default.directoryServer", "");
pref("mail.identity.default.overrideGlobal_Pref", false);
pref("mail.identity.default.auto_quote", true);
pref("mail.identity.default.reply_on_top", 0); // 0=bottom 1=top 2=select
pref("mail.identity.default.sig_bottom", true); // true=below quoted false=above quoted
pref("mail.identity.default.sig_on_fwd", false); // Include signature on fwd?
pref("mail.identity.default.sig_on_reply", true); // Include signature on re?

// Suppress double-dash signature separator
pref("mail.identity.default.suppress_signature_separator", false);
 
// default to archives folder on same server.
pref("mail.identity.default.archives_folder_picker_mode", "0");

// Headers to always add to outgoing mail
// examples: "header1,header2"
// pref("mail.identity.id1.headers", "header1");
// user_pref("mail.identity.id1.header.header1", "X-Mozilla-Rocks: True")
pref("mail.identity.default.headers", "");

// by default, only collect addresses the user sends to (outgoing)
// incoming is all spam anyways
#ifdef MOZ_SUITE
pref("mail.collect_email_address_incoming", false);
pref("mail.collect_email_address_newsgroup", false);
#endif
pref("mail.collect_email_address_outgoing", true);

// by default, use the Collected Addressbook for collection
pref("mail.collect_addressbook", "moz-abmdbdirectory://history.mab");

pref("mail.default_sendlater_uri", "mailbox://nobody@Local%20Folders/Unsent%20Messages");

pref("mail.smtpservers", "");
pref("mail.accountmanager.accounts", "");

// Last used account key value
pref("mail.account.lastKey", 0);

pref("mail.server.default.port", -1);
pref("mail.server.default.offline_support_level", -1);
pref("mail.server.default.leave_on_server", false);
pref("mail.server.default.download_on_biff", false);
pref("mail.server.default.check_time", 10);
pref("mail.server.default.delete_by_age_from_server", false);
pref("mail.server.default.num_days_to_leave_on_server", 7);
pref("mail.server.default.dot_fix", true);
pref("mail.server.default.limit_offline_message_size", false);
pref("mail.server.default.max_size", 50);
pref("mail.server.default.delete_mail_left_on_server", false);
pref("mail.server.default.valid", true);
pref("mail.server.default.abbreviate", true);
pref("mail.server.default.isSecure", false);
pref("mail.server.default.authMethod", 3); // cleartext password. @see nsIMsgIncomingServer.authMethod.
pref("mail.server.default.socketType", 0); // @see nsIMsgIncomingServer.socketType
pref("mail.server.default.override_namespaces", true);
pref("mail.server.default.deferred_to_account", "");

pref("mail.server.default.delete_model", 1);
pref("mail.server.default.fetch_by_chunks", true);
pref("mail.server.default.mime_parts_on_demand", true);
// Send IMAP RFC 2971 ID Info to server
pref("mail.server.default.send_client_info", true);
pref("mail.server.default.always_authenticate", false);
pref("mail.server.default.singleSignon", true);
pref("mail.server.default.max_articles", 500);
pref("mail.server.default.notify.on", true);
pref("mail.server.default.mark_old_read", false);
pref("mail.server.default.empty_trash_on_exit", false);
// 0 = Keep Dupes, leave them alone
// 1 = delete dupes
// 2 = Move Dupes to trash
// 3 = Mark Dupes as Read
pref("mail.server.default.dup_action", 0);
pref("mail.server.default.hidden", false);

pref("mail.server.default.using_subscription", true);
pref("mail.server.default.dual_use_folders", true);
pref("mail.server.default.canDelete", false);
pref("mail.server.default.login_at_startup", false);
pref("mail.server.default.allows_specialfolders_usage", true);
pref("mail.server.default.canCreateFolders", true);
pref("mail.server.default.canFileMessages", true);

// special enhancements for IMAP servers
pref("mail.server.default.is_gmail", false);
pref("mail.server.default.use_idle", true);
// in case client or server has bugs in condstore implementation
pref("mail.server.default.use_condstore", true);
// in case client or server has bugs in compress implementation
pref("mail.server.default.use_compress_deflate", true);
// for spam
pref("mail.server.default.spamLevel", 100); // 0 off, 100 on.  not doing bool since we might have real levels one day.
pref("mail.server.default.moveOnSpam", false);
pref("mail.server.default.moveTargetMode", 0); // 0 == "Junk" on server, 1 == specific folder
pref("mail.server.default.spamActionTargetAccount", "");
pref("mail.server.default.spamActionTargetFolder", "");
pref("mail.server.default.useWhiteList", true);
pref("mail.server.default.whiteListAbURI", "moz-abmdbdirectory://abook.mab"); // the Personal addressbook.
pref("mail.server.default.useServerFilter", false);
pref("mail.server.default.serverFilterName", "SpamAssassin");
pref("mail.server.default.serverFilterTrustFlags", 1); // 1 == trust positives, 2 == trust negatives, 3 == trust both
pref("mail.server.default.purgeSpam", false);
pref("mail.server.default.purgeSpamInterval", 14); // 14 days
pref("mail.server.default.check_all_folders_for_new", false);
// should we inhibit whitelisting of the email addresses for a server's identities?
pref("mail.server.default.inhibitWhiteListingIdentityUser", true);
// should we inhibit whitelisting of the domain for a server's identities?
pref("mail.server.default.inhibitWhiteListingIdentityDomain", false);

// to activate auto-sync feature (preemptive message download for imap) by default
pref("mail.server.default.autosync_offline_stores",true);
pref("mail.server.default.offline_download",true);

// -1 means no limit, no purging of offline stores.
pref("mail.server.default.autosync_max_age_days", -1);

// This is the default store contractID for newly created servers.
// We don't use mail.server.default because we want to ensure that the
// store contract id is always written out to prefs.js
pref("mail.serverDefaultStoreContractID", "@mozilla.org/msgstore/berkeleystore;1");
// the probablilty threshold over which messages are classified as junk
// this number is divided by 100 before it is used. The classifier can be fine tuned
// by changing this pref. Typical values are .99, .95, .90, .5, etc.
pref("mail.adaptivefilters.junk_threshold", 90);
pref("mail.spam.version", 0); // used to determine when to migrate global spam settings
pref("mail.spam.logging.enabled", false);
pref("mail.spam.manualMark", false);
pref("mail.spam.markAsReadOnSpam", false);
pref("mail.spam.manualMarkMode", 0); // 0 == "move to junk folder", 1 == "delete"
pref("mail.spam.markAsNotJunkMarksUnRead", true);
pref("mail.spam.display.sanitize", true); // display simple html for html junk messages
// the number of allowed bayes tokens before the database is shrunk
pref("mailnews.bayesian_spam_filter.junk_maxtokens", 100000);

// set default traits for junk and good. Index should match the values in nsIJunkMailPlugin
pref("mailnews.traits.id.1", "mailnews@mozilla.org#good");
pref("mailnews.traits.name.1", "Good");
pref("mailnews.traits.enabled.1", false);
pref("mailnews.traits.id.2", "mailnews@mozilla.org#junk");
pref("mailnews.traits.name.2", "Junk");
pref("mailnews.traits.enabled.2", true);
pref("mailnews.traits.antiId.2", "mailnews@mozilla.org#good");
// traits 3 - 1000 are reserved for use by mailnews@mozilla.org
// the first externally defined trait will have index 1001
pref("mailnews.traits.lastIndex", 1000);

pref("mail.autoComplete.highlightNonMatches", true);

// if true, we'll use the password from an incoming server with
// matching username and domain
pref("mail.smtp.useMatchingDomainServer", false);

// if true, we'll use the password from an incoming server with
// matching username and host name
pref("mail.smtp.useMatchingHostNameServer", false);

pref("mail.smtpserver.default.authMethod", 3); // cleartext password. @see nsIMsgIncomingServer.authMethod.
pref("mail.smtpserver.default.try_ssl", 0); // @see nsISmtpServer.socketType

// For the next 3 prefs, see <http://www.bucksch.org/1/projects/mozilla/16507>
pref("mail.display_glyph", true);   // TXT->HTML :-) etc. in viewer
pref("mail.display_struct", true);  // TXT->HTML *bold* etc. in viewer; ditto
pref("mail.send_struct", false);   // HTML->HTML *bold* etc. during Send; ditto
// display time and date in message pane using senders timezone
pref("mailnews.display.date_senders_timezone", false);
// For the next 4 prefs, see <http://www.bucksch.org/1/projects/mozilla/108153>
pref("mailnews.display.prefer_plaintext", false);  // Ignore HTML parts in multipart/alternative
pref("mailnews.display.html_as", 0);  // How to display HTML/MIME parts. 0 = Render the sender's HTML; 1 = HTML->TXT->HTML; 2 = Show HTML source; 3 = Sanitize HTML; 4 = Show all body parts
pref("mailnews.display.show_all_body_parts_menu", false); // Whether the View > Message body as > All body parts menu item is available
pref("mailnews.display.html_sanitizer.allowed_tags.migrated", false); // whether legacy mailnews.display.html_sanitizer.allowed_tags pref has been migrated to values of the two prefs below
pref("mailnews.display.html_sanitizer.drop_non_css_presentation", true); // whether to drop <font>, <center>, align='...', etc.
pref("mailnews.display.html_sanitizer.drop_media", false); // whether to drop <img>, <video> and <audio>
pref("mailnews.display.disallow_mime_handlers", 0);  /* Let only a few classes process incoming data. This protects from bugs (e.g. buffer overflows) and from security loopholes (e.g. allowing unchecked HTML in some obscure classes, although the user has html_as > 0).
This option is mainly for the UI of html_as.
0 = allow all available classes
1 = Use hardcoded blacklist to avoid rendering (incoming) HTML
2 = ... and inline images
3 = ... and some other uncommon content types
100 = Use hardcoded whitelist to avoid even more bugs(buffer overflows).
      This mode will limit the features available (e.g. uncommon
      attachment types and inline images) and is for paranoid users.
*/
// RSS rendering options, see prior 4 prefs above.
pref("rss.display.prefer_plaintext", false);
pref("rss.display.html_as", 0);
pref("rss.display.disallow_mime_handlers", 0);

// Feed message display (summary or web page), on select.
// 0 - global override, load web page
// 1 - global override, load summary
// 2 - use default feed folder setting from Subscribe dialog; if no setting default to 1
pref("rss.show.summary", 1);

// Feed message display (summary or web page), on open.
// Action on double click or enter in threadpane for a feed message.
// 0 - open content-base url in new window
// 1 - open summary in new window
// 2 - toggle load summary and content-base url in message pane
// 3 - load content-base url in browser
pref("rss.show.content-base", 0);

// Feed message additional web page display.
// 0 - no action
// 1 - load web page in default browser, on select
pref("rss.message.loadWebPageOnSelect", 0);

// Feeds system logging, uses log4moz conventions.
pref("Feeds.logging.console", "Info");

pref("mail.forward_message_mode", 0); // 0=default as attachment 2=forward as inline with attachments, (obsolete 4.x value)1=forward as quoted (mapped to 2 in mozilla)
pref("mail.forward_add_extension", true); // add .eml extension when forwarding as attachment
// Prefix of for mail forwards. E.g. "Fwd" -> subject will be Fwd: <subject>
pref("mail.forward_subject_prefix", "Fwd");

pref("mail.startup.enabledMailCheckOnce", false);

pref("mailnews.send_plaintext_flowed", true); // RFC 2646=======
pref("mailnews.display.disable_format_flowed_support", false);
pref("mailnews.nav_crosses_folders", 1); // prompt user when crossing folders

// these two news.cancel.* prefs are for use by QA for automated testing.  see bug #31057
pref("news.cancel.confirm", true);
pref("news.cancel.alert_on_success", true);
pref("mail.SpellCheckBeforeSend", false);
pref("mail.spellcheck.inline", true);
pref("mail.phishing.detection.enabled", true); // enable / disable phishing detection for link clicks
pref("mail.warn_on_send_accel_key", true);
pref("mail.enable_autocomplete", true);
pref("mailnews.html_domains", "");
pref("mailnews.plaintext_domains", "");
pref("mailnews.global_html_domains.version", 1);

/////////////////////////////////////////////////////////////////
// Privacy Controls for Handling Remote Content
/////////////////////////////////////////////////////////////////
// Specific plugins pref just for message content. RSS is not covered by this.
pref("mailnews.message_display.allow_plugins", false);
pref("mailnews.message_display.disable_remote_image", true);

/////////////////////////////////////////////////////////////////
// Trusted Mail Domains
//
// Specific domains can be white listed to bypass various privacy controls in Thunderbird
// such as blocking remote images, the phishing detector, etc. This is particularly
// useful for business deployments where images or links reference servers inside a
// corporate intranet. For multiple domains, separate them with a comma. i.e.
// pref("mail.trusteddomains", "mozilla.org,mozillafoundation.org");
/////////////////////////////////////////////////////////////////
pref("mail.trusteddomains", "");

pref("mail.imap.use_status_for_biff", true);

pref("mail.quota.mainwindow_threshold.show", 75); // in percent. when the quota meter starts showing up at all. decrease this for it to be more than a warning.
pref("mail.quota.mainwindow_threshold.warning", 80); // when it gets yellow
pref("mail.quota.mainwindow_threshold.critical", 95); // when it gets red

// Pref controlling the updates on the pre-configured accounts.
// In order to add new pre-configured accounts (after a version),
// increase the following version number besides updating the
// pref mail.accountmanager.appendaccounts
pref("mailnews.append_preconfig_accounts.version", 1);

// Pref controlling the updates on the pre-configured smtp servers.
// In order to add new pre-configured smtp servers (after a version),
// increase the following version number besides updating the
// pref mail.smtpservers.appendsmtpservers
pref("mail.append_preconfig_smtpservers.version", 1);

pref("mail.biff.alert.show_preview", true);
pref("mail.biff.alert.show_subject", true);
pref("mail.biff.alert.show_sender",  true);
pref("mail.biff.alert.preview_length", 40);

pref("mail.biff.play_sound", true);
// 0 == default system sound, 1 == user specified wav
pref("mail.biff.play_sound.type", 0);
// _moz_mailbeep is a magic key, for the default sound.
// otherwise, this needs to be a file url
pref("mail.biff.play_sound.url", "");
pref("mail.biff.show_alert", true);
pref("mail.biff.show_tray_icon", true); // currently Windows-only
pref("mail.biff.show_balloon", false); // currently Windows-only
pref("mail.biff.animate_dock_icon", false);

// add jitter to biff interval
pref("mail.biff.add_interval_jitter", true);

#ifdef MOZ_SUITE
// if true, check for new mail even when opening non-mail windows
pref("mail.biff.on_new_window", true);
#endif

// If true, the number used in the Mac OS X dock notification will be the
// the number of "new" messages, as per the classic Thunderbird definition.
// Defaults to false, which notifies about the number of unread messages.
pref("mail.biff.use_new_count_in_mac_dock", false);

// Content disposition for attachments (except binary files and vcards).
//   0= Content-Disposition: inline
//   1= Content-Disposition: attachment
pref("mail.content_disposition_type", 1);

// Experimental option to send message in the background - don't wait to close window.
pref("mailnews.sendInBackground", false);
// Will show a progress dialog when saving or sending a message
pref("mailnews.show_send_progress", true);
pref("mail.server.default.retainBy", 1);

pref("mailnews.ui.junk.firstuse", true);
pref("mailnews.ui.junk.manualMarkAsJunkMarksRead", true);

// for manual upgrades of certain UI features.
// 1 -> 2 is for the folder pane tree landing, to hide the
// unread and total columns, see msgMail3PaneWindow.js
pref("mail.ui.folderpane.version", 1);

// for manual upgrades of certain UI features.
#ifdef MOZ_SUITE
pref("mailnews.ui.threadpane.version", 5);
#else
// Thunderbird uses this pref in msgMail3PaneWindow.js for bad reasons.
pref("mailnews.ui.threadpane.version", 7);
#endif
// for manual upgrades of certain UI features.
// 1 -> 2 is for the ab results pane tree landing
// to hide the non default columns in the addressbook dialog
// see abCommon.js and addressbook.js
pref("mailnews.ui.addressbook_results.version", 1);
// for manual upgrades of certain UI features.
// 1 -> 2 is for the ab results pane tree landing
// to hide the non default columns in the addressbook sidebar panel
// see abCommon.js and addressbook-panel.js
pref("mailnews.ui.addressbook_panel_results.version", 1);
// for manual upgrades of certain UI features.
// 1 -> 2 is for the ab results pane tree landing
// to hide the non default columns in the select addresses dialog
// see abCommon.js and abSelectAddressesDialog.js
pref("mailnews.ui.select_addresses_results.version", 1);
// for manual upgrades of certain UI features.
// 1 -> 2 is for the ab results pane
// to hide the non default columns in the advanced directory search dialog
// see abCommon.js and ABSearchDialog.js
pref("mailnews.ui.advanced_directory_search_results.version", 1);
//If set to a number greater than 0, msg compose windows will be recycled in order to open them quickly
pref("mail.compose.max_recycled_windows", 1);

// default description and color prefs for tags
// (we keep the .labels. names for backwards compatibility)
pref("mailnews.labels.description.1", "chrome://messenger/locale/messenger.properties");
pref("mailnews.labels.description.2", "chrome://messenger/locale/messenger.properties");
pref("mailnews.labels.description.3", "chrome://messenger/locale/messenger.properties");
pref("mailnews.labels.description.4", "chrome://messenger/locale/messenger.properties");
pref("mailnews.labels.description.5", "chrome://messenger/locale/messenger.properties");
pref("mailnews.labels.color.1", "#FF0000"); // default: red
pref("mailnews.labels.color.2", "#FF9900"); // default: orange
pref("mailnews.labels.color.3", "#009900"); // default: green
pref("mailnews.labels.color.4", "#3333FF"); // default: blue
pref("mailnews.labels.color.5", "#993399"); // default: purple

//default null headers
//example "X-Warn: XReply", list of hdrs separated by ": "
pref("mailnews.customHeaders", "");

// default msg compose font prefs
pref("msgcompose.font_face",                "");
pref("msgcompose.font_size",                "medium");
pref("msgcompose.text_color",               "#000000");
pref("msgcompose.background_color",         "#FFFFFF");

// When there is no disclosed recipients (only bcc), we should address the message to empty group
// to prevent some mail server to disclose the bcc recipients
pref("mail.compose.add_undisclosed_recipients", true);

// Set this preference to true to tell mail not to attach the source of a link to a local
// network file (file://///<network name>/<path>/<file name>). Windows only
pref("mail.compose.dont_attach_source_of_local_network_links", false);
pref("mail.compose.dontWarnMail2Newsgroup", false);

// these prefs (in minutes) are here to help QA test this feature
// "mail.purge.min_delay", never purge a junk folder more than once every 480 minutes (60 mins/hour * 8 hours)
// "mail.purge.timer_interval", fire the purge timer every 5 minutes, starting 5 minutes after we load accounts
pref("mail.purge.min_delay", 480);
pref("mail.purge.timer_interval", 5);

// Set to false if opening a message in the standalone message window or viewing
// it in the message pane should never mark it as read.
pref("mailnews.mark_message_read.auto", true);

// Set to true if viewing a message should mark it as read after the msg is
// viewed in the message pane for a specified time interval in seconds.
pref("mailnews.mark_message_read.delay", false);
pref("mailnews.mark_message_read.delay.interval", 5); // measured in seconds

// delay after which messages are showed when moving through them with cursors
// during thread pane navigation
pref("mailnews.threadpane_select_delay", 250); // measured in milliseconds

// require a password before showing imap or local headers in thread pane
pref("mail.password_protect_local_cache", false);

// import option to skip the first record, recorded so that we can save
// the users last used preference.
pref("mailnews.import.text.skipfirstrecord", true);

// automatically scale attached images that are displayed inline
pref("mail.enable_automatic_image_resizing", true);

#ifdef MOZ_SUITE
#ifdef XP_WIN
pref("ldap_2.servers.oe.uri", "moz-aboutlookdirectory://oe/");
pref("ldap_2.servers.oe.description", "chrome://messenger/locale/addressbook/addressBook.properties");
pref("ldap_2.servers.oe.dirType", 3);
#endif
#endif
#ifdef XP_MACOSX
pref("ldap_2.servers.osx.uri", "moz-abosxdirectory:///");
pref("ldap_2.servers.osx.description", "chrome://messenger/locale/addressbook/addressBook.properties");
pref("ldap_2.servers.osx.dirType", 3);
pref("mail.notification.sound",             "");
pref("mail.notification.count.inbox_only", true);
// Work around bug 482811 by disabling slow script warning for chrome scripts on Mac
pref("dom.max_chrome_script_run_time", 0);
#endif

// gtk2 (*nix) lacks transparent/translucent drag support (bug 376238), so we
// want to disable it so people can see where they are dragging things.
// (Stock gtk drag icons will be used instead.)
#ifdef MOZ_WIDGET_GTK2
pref("nglayout.enable_drag_images", false);
#endif

#ifdef XP_OS2
pref("mail.compose.max_recycled_windows", 0);
#endif

// For the Empty Junk/Trash confirmation dialogs.
pref("mailnews.emptyJunk.dontAskAgain", false);
pref("mailnews.emptyTrash.dontAskAgain", false);

// where to fetch auto config information from.
pref("mailnews.auto_config_url", "https://live.mozillamessaging.com/autoconfig/v1.1/");
// Added in bug 551519. Remove when bug 545866 is fixed.
pref("mailnews.mx_service_url", "https://live.mozillamessaging.com/dns/mx/");

// -- Summary Database options
// dontPreserveOnCopy: a space separated list of properties that are not
//                     copied to the new nsIMsgHdr when a message is copied.
//                     Allows extensions to control preservation of properties.
pref("mailnews.database.summary.dontPreserveOnCopy",
  "account msgOffset threadParent msgThreadId statusOfset flags size numLines ProtoThreadFlags label gloda-id gloda-dirty storeToken");

// dontPreserveOnMove: a space separated list of properties that are not
//                     copied to the new nsIMsgHdr when a message is moved.
//                     Allows extensions to control preservation of properties.
pref("mailnews.database.summary.dontPreserveOnMove",
  "account msgOffset threadParent msgThreadId statusOfset flags size numLines ProtoThreadFlags label storeToken");

// -- Global Database (gloda) options
// Should the indexer be enabled?
pref("mailnews.database.global.indexer.enabled", false);
// Should we output warnings and errors to the "error console"?
pref("mailnews.database.global.logging.console", false);
// Should we output all output levels to stdout via dump?
pref("mailnews.database.global.logging.dump", false);
// Should we consider outputting all levels via the network?
pref("mailnews.database.global.logging.net", false);
// Rate of growth of the gloda cache, whose maximum value is 8 MiB and max is 64 MiB.
// See more: https://developer.mozilla.org/en/Thunderbird/gloda#Cache_Size"
pref("mailnews.database.global.datastore.cache_to_memory_permillage", 10);

// default field order in the fieldmap
pref("mailnews.import.text.fieldmap", "+0,+1,+2,+3,+4,+5,+36,+6,+7,+8,+9,+10,+11,+12,+13,+14,+15,+16,+17,+18,+19,+20,+21,+22,+23,+24,+25,+26,+27,+28,+29,+30,+31,+32,+33,+34,+35");

// On networks deploying QoS, it is recommended that these be lockpref()'d,
// since inappropriate marking can easily overwhelm bandwidth reservations
// for certain services (i.e. EF for VoIP, AF4x for interactive video,
// AF3x for broadcast/streaming video, etc)

// default value for SMTP and POP3.
// in a DSCP environment this should be 48 (0x30, or AF12) per RFC-4594,
// Section 4.8 "High-Throughput Data Service Class"
pref("mail.pop3.qos", 0);
pref("mail.smtp.qos", 0);
pref("mail.nntp.qos", 0);

// default value for IMAP4
// in a DSCP environment this should be 56 (0x38, or AF13), ibid.
pref("mail.imap.qos", 0);

// PgpMime Addon
pref("mail.pgpmime.addon_url", "https://addons.mozilla.org/addon/enigmail/");
