/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is The Browser Profile Migrator.
 *
 * The Initial Developer of the Original Code is Ben Goodger.
 * Portions created by the Initial Developer are Copyright (C) 2004
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *  Ben Goodger <ben@bengoodger.com>
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

#include "nsSuiteProfileMigratorUtils.h"
#include "nsCRT.h"
#include "nsDirectoryServiceDefs.h"
#include "nsIObserverService.h"
#include "nsIPrefLocalizedString.h"
#include "nsIPrefService.h"
#include "nsIServiceManager.h"
#include "nsISupportsArray.h"
#include "nsISupportsPrimitives.h"
#include "nsNetCID.h"
#include "nsNetUtil.h"
#include "nsSeamonkeyProfileMigrator.h"
#include "prprf.h"

///////////////////////////////////////////////////////////////////////////////
// nsSeamonkeyProfileMigrator

#define FILE_NAME_SITEPERM_OLD    "cookperm.txt"
#define FILE_NAME_SITEPERM_NEW    "hostperm.1"
#define FILE_NAME_CERT8DB         "cert8.db"
#define FILE_NAME_KEY3DB          "key3.db"
#define FILE_NAME_SECMODDB        "secmod.db"
#define FILE_NAME_HISTORY         "history.dat"
#define FILE_NAME_MIMETYPES       "mimeTypes.rdf"
#define FILE_NAME_USER_PREFS      "user.js"
#define FILE_NAME_PERSONALDICTIONARY "persdict.dat"
#define FILE_NAME_MAILVIEWS       "mailViews.dat"
#define FILE_NAME_USERCHROME      "userChrome.css"

NS_IMPL_ISUPPORTS2(nsSeamonkeyProfileMigrator, nsISuiteProfileMigrator,
                   nsITimerCallback)

nsSeamonkeyProfileMigrator::nsSeamonkeyProfileMigrator()
{
}

nsSeamonkeyProfileMigrator::~nsSeamonkeyProfileMigrator()
{
}

///////////////////////////////////////////////////////////////////////////////
// nsISuiteProfileMigrator

NS_IMETHODIMP
nsSeamonkeyProfileMigrator::Migrate(PRUint16 aItems,
                                    nsIProfileStartup* aStartup,
                                    const PRUnichar* aProfile)
{
  nsresult rv = NS_OK;
  PRBool aReplace = aStartup ? PR_TRUE : PR_FALSE;

  if (!mTargetProfile) {
    GetProfilePath(aStartup, getter_AddRefs(mTargetProfile));
    if (!mTargetProfile) return NS_ERROR_FAILURE;
  }
  if (!mSourceProfile)
    GetSourceProfile(aProfile);

  NOTIFY_OBSERVERS(MIGRATION_STARTED, nsnull);

  if (aItems & nsISuiteProfileMigrator::HOMEPAGEDATA)
    COPY_DATA(CopyHomePageData, aReplace,
              nsISuiteProfileMigrator::HOMEPAGEDATA);

  COPY_DATA(CopyPreferences,  aReplace, nsISuiteProfileMigrator::SETTINGS);
  COPY_DATA(CopyCookies,      aReplace, nsISuiteProfileMigrator::COOKIES);
  COPY_DATA(CopyHistory,      aReplace, nsISuiteProfileMigrator::HISTORY);
  COPY_DATA(CopyPasswords,    aReplace, nsISuiteProfileMigrator::PASSWORDS);
  COPY_DATA(CopyOtherData,    aReplace, nsISuiteProfileMigrator::OTHERDATA);
  COPY_DATA(CopyBookmarks,    aReplace, nsISuiteProfileMigrator::BOOKMARKS);

  // fake notifications for things we've already imported as part of
  // CopyPreferences
  nsAutoString index;
  index.AppendInt(nsISuiteProfileMigrator::ACCOUNT_SETTINGS);
  NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());
  NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());

  index.Truncate();
  index.AppendInt(nsISuiteProfileMigrator::NEWSDATA);
  NOTIFY_OBSERVERS(MIGRATION_ITEMBEFOREMIGRATE, index.get());
  NOTIFY_OBSERVERS(MIGRATION_ITEMAFTERMIGRATE, index.get());

  // copy junk mail training file
  COPY_DATA(CopyJunkTraining, aReplace, nsISuiteProfileMigrator::JUNKTRAINING);

  if (aReplace &&
      (aItems & nsISuiteProfileMigrator::SETTINGS ||
       aItems & nsISuiteProfileMigrator::COOKIES ||
       aItems & nsISuiteProfileMigrator::PASSWORDS ||
       !aItems)) {
    // Permissions (Images, Cookies, Popups)
    rv |= CopyFile(FILE_NAME_SITEPERM_NEW, FILE_NAME_SITEPERM_NEW);
    rv |= CopyFile(FILE_NAME_SITEPERM_OLD, FILE_NAME_SITEPERM_OLD);
  }

  // the last thing to do is to actually copy over any mail folders we have
  // marked for copying we want to do this last and it will be asynchronous
  // so the UI doesn't freeze up while we perform this potentially very long
  // operation.
  CopyMailFolders();

  return rv;
}

NS_IMETHODIMP
nsSeamonkeyProfileMigrator::GetMigrateData(const PRUnichar* aProfile,
                                           PRBool aReplace,
                                           PRUint16* aResult)
{
  *aResult = 0;

  if (!mSourceProfile) {
    GetSourceProfile(aProfile);
    if (!mSourceProfile)
      return NS_ERROR_FILE_NOT_FOUND;
  }

  // migration fields for things we always migrate
  *aResult =
    nsISuiteProfileMigrator::ACCOUNT_SETTINGS |
    nsISuiteProfileMigrator::MAILDATA |
    nsISuiteProfileMigrator::NEWSDATA |
    nsISuiteProfileMigrator::ADDRESSBOOK_DATA;

  MigrationData data[] = { { FILE_NAME_PREFS,
                             nsISuiteProfileMigrator::SETTINGS,
                             PR_TRUE },
                           { FILE_NAME_USER_PREFS,
                             nsISuiteProfileMigrator::SETTINGS,
                             PR_TRUE },
                           { FILE_NAME_COOKIES,
                             nsISuiteProfileMigrator::COOKIES,
                             PR_FALSE },
                           { FILE_NAME_HISTORY,
                             nsISuiteProfileMigrator::HISTORY,
                             PR_TRUE },
                           { FILE_NAME_BOOKMARKS,
                             nsISuiteProfileMigrator::BOOKMARKS,
                             PR_FALSE },
                           { FILE_NAME_DOWNLOADS,
                             nsISuiteProfileMigrator::OTHERDATA,
                             PR_TRUE },
                           { FILE_NAME_MIMETYPES,
                             nsISuiteProfileMigrator::OTHERDATA,
                             PR_TRUE },
                           { FILE_NAME_JUNKTRAINING,
                             nsISuiteProfileMigrator::JUNKTRAINING,
                             PR_TRUE } };

  GetMigrateDataFromArray(data, sizeof(data)/sizeof(MigrationData),
                          aReplace, mSourceProfile, aResult);

  // Now locate passwords
  nsCString signonsFileName;
  GetSignonFileName(aReplace, getter_Copies(signonsFileName));

  if (!signonsFileName.IsEmpty()) {
    nsCOMPtr<nsIFile> sourcePasswordsFile;
    mSourceProfile->Clone(getter_AddRefs(sourcePasswordsFile));
    sourcePasswordsFile->AppendNative(signonsFileName);

    PRBool exists;
    sourcePasswordsFile->Exists(&exists);
    if (exists)
      *aResult |= nsISuiteProfileMigrator::PASSWORDS;
  }

  // Now see if the homepages have anything to migrate.
  if (GetSourceHasHomePageURL())
    *aResult |= nsISuiteProfileMigrator::HOMEPAGEDATA;

  return NS_OK;
}

NS_IMETHODIMP
nsSeamonkeyProfileMigrator::GetSupportedItems(PRUint16 *aSupportedItems)
{
  NS_ENSURE_ARG_POINTER(aSupportedItems);

  *aSupportedItems = nsISuiteProfileMigrator::ALL;

  return NS_OK;
}

nsresult
nsSeamonkeyProfileMigrator::FillProfileDataFromRegistry()
{
  // Find the Seamonkey Registry
  nsCOMPtr<nsIProperties> fileLocator(
    do_GetService("@mozilla.org/file/directory_service;1"));
  nsCOMPtr<nsILocalFile> seamonkeyRegistry;
#ifdef XP_WIN
  fileLocator->Get(NS_WIN_APPDATA_DIR, NS_GET_IID(nsILocalFile),
                   getter_AddRefs(seamonkeyRegistry));

  seamonkeyRegistry->Append(NS_LITERAL_STRING("Mozilla"));
  seamonkeyRegistry->Append(NS_LITERAL_STRING("registry.dat"));
#elif defined(XP_MACOSX)
  fileLocator->Get(NS_MAC_USER_LIB_DIR, NS_GET_IID(nsILocalFile),
                   getter_AddRefs(seamonkeyRegistry));

  seamonkeyRegistry->Append(NS_LITERAL_STRING("Mozilla"));
  seamonkeyRegistry->Append(NS_LITERAL_STRING("Application Registry"));
#elif defined(XP_UNIX)
  fileLocator->Get(NS_UNIX_HOME_DIR, NS_GET_IID(nsILocalFile),
                   getter_AddRefs(seamonkeyRegistry));

  seamonkeyRegistry->Append(NS_LITERAL_STRING(".mozilla"));
  seamonkeyRegistry->Append(NS_LITERAL_STRING("appreg"));
#elif defined(XP_BEOS)
   fileLocator->Get(NS_BEOS_SETTINGS_DIR, NS_GET_IID(nsILocalFile),
                    getter_AddRefs(seamonkeyRegistry));

   seamonkeyRegistry->Append(NS_LITERAL_STRING("Mozilla"));
   seamonkeyRegistry->Append(NS_LITERAL_STRING("appreg"));
#elif defined(XP_OS2)
  fileLocator->Get(NS_OS2_HOME_DIR, NS_GET_IID(nsILocalFile),
                   getter_AddRefs(seamonkeyRegistry));

  seamonkeyRegistry->Append(NS_LITERAL_STRING("Mozilla"));
  seamonkeyRegistry->Append(NS_LITERAL_STRING("registry.dat"));
#endif

  return GetProfileDataFromRegistry(seamonkeyRegistry, mProfileNames,
                                    mProfileLocations);
}

static
nsSeamonkeyProfileMigrator::PrefTransform gTransforms[] = {
  MAKESAMETYPEPREFTRANSFORM("addressbook.throbber.url",                String),
  MAKESAMETYPEPREFTRANSFORM("advanced.mailftp",                        Bool),
  MAKESAMETYPEPREFTRANSFORM("application.use_ns_plugin_finder",        Bool),

  MAKESAMETYPEPREFTRANSFORM("alerts.slideIncrement",                   Int),
  MAKESAMETYPEPREFTRANSFORM("alerts.slideIncrementTime",               Int),
  MAKESAMETYPEPREFTRANSFORM("alerts.totalOpenTime",                    Int),

  MAKESAMETYPEPREFTRANSFORM("browser.anchor_color",                    String),
  MAKESAMETYPEPREFTRANSFORM("browser.active_color",                    String),
  MAKESAMETYPEPREFTRANSFORM("browser.backspace_action",                Int),
  MAKESAMETYPEPREFTRANSFORM("browser.blink_allowed",                   Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.cache.disk.capacity",             Int),
  MAKESAMETYPEPREFTRANSFORM("browser.cache.check_doc_frequency",       Int),

  // Note browser.download.* prefs are covered below.
  MAKESAMETYPEPREFTRANSFORM("browser.downloadmanager.behavior",        Int),

  MAKESAMETYPEPREFTRANSFORM("browser.enable_automatic_image_resizing", Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.fixup.alternate.enabled",         Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.fixup.alternate.prefix",          String),
  MAKESAMETYPEPREFTRANSFORM("browser.fixup.alternate.suffix",          String),
  MAKESAMETYPEPREFTRANSFORM("browser.fixup.hide_user_pass",            Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.frames.enabled",                  Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.history.grouping",                String),
  MAKESAMETYPEPREFTRANSFORM("browser.history_expire_days",             Int),
  MAKESAMETYPEPREFTRANSFORM("browser.link.open_external",              Int),
  MAKESAMETYPEPREFTRANSFORM("browser.link.open_newwindow",             Int),
  MAKESAMETYPEPREFTRANSFORM("browser.open.dir",                        String),
  MAKESAMETYPEPREFTRANSFORM("browser.related.disableForDomains",       String),
  MAKESAMETYPEPREFTRANSFORM("browser.related.provider",                String),
  MAKESAMETYPEPREFTRANSFORM("browser.send_pings",                      Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.sessionhistory.max_entries",      Int),
  MAKESAMETYPEPREFTRANSFORM("browser.sessionhistory.max_total_viewers",Int),
  MAKESAMETYPEPREFTRANSFORM("browser.startup.page",                    Int),
  MAKESAMETYPEPREFTRANSFORM("browser.throbber.url",                    String),
  MAKESAMETYPEPREFTRANSFORM("browser.toolbars.showbutton.bookmarks",   Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.toolbars.showbutton.go",          Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.toolbars.showbutton.home",        Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.toolbars.showbutton.print",       Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.toolbars.showbutton.search",      Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.triple_click_selects_paragraph",  Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.underline_anchors",               Bool),
  MAKESAMETYPEPREFTRANSFORM("browser.visited_color",                   String),
  MAKESAMETYPEPREFTRANSFORM("browser.windows.loadOnNewWindow",         Int),

  MAKESAMETYPEPREFTRANSFORM("compose.throbber.url",                    String),
  MAKESAMETYPEPREFTRANSFORM("config.use_system_prefs",                 Bool),
  MAKESAMETYPEPREFTRANSFORM("config.use_system_prefs.accessibility",   Bool),

  MAKESAMETYPEPREFTRANSFORM("custtoolbar.personal_toolbar_folder",     String),

  MAKESAMETYPEPREFTRANSFORM("dom.disable_open_during_load",            Bool),
  MAKESAMETYPEPREFTRANSFORM("dom.disable_image_src_set",               Bool),
  MAKESAMETYPEPREFTRANSFORM("dom.disable_window_flip",                 Bool),
  MAKESAMETYPEPREFTRANSFORM("dom.disable_window_move_resize",          Bool),
  MAKESAMETYPEPREFTRANSFORM("dom.disable_window_open_feature.status",  Bool),
  MAKESAMETYPEPREFTRANSFORM("dom.disable_window_status_change",        Bool),

  MAKESAMETYPEPREFTRANSFORM("extensions.spellcheck.inline.max-misspellings",Int),

  MAKESAMETYPEPREFTRANSFORM("general.autoScroll",                      Bool),
  MAKESAMETYPEPREFTRANSFORM("general.open_location.last_url",          String),
  MAKESAMETYPEPREFTRANSFORM("general.open_location.last_window_choice",Int),
  MAKESAMETYPEPREFTRANSFORM("general.smoothScroll",                    Bool),
  MAKESAMETYPEPREFTRANSFORM("general.warnOnAboutConfig",               Bool),

  MAKESAMETYPEPREFTRANSFORM("image.animation_mode",                    String),

  MAKESAMETYPEPREFTRANSFORM("intl.accept_charsets",                    String),
  MAKESAMETYPEPREFTRANSFORM("intl.accept_languages",                   String),
  MAKESAMETYPEPREFTRANSFORM("intl.charset.default",                    String),
  MAKESAMETYPEPREFTRANSFORM("intl.charsetmenu.browser.static",         String),

  MAKESAMETYPEPREFTRANSFORM("javascript.enabled",                      Bool),
  MAKESAMETYPEPREFTRANSFORM("javascript.options.relimit",              Bool),
  MAKESAMETYPEPREFTRANSFORM("javascript.options.showInConsole",        Bool),
  MAKESAMETYPEPREFTRANSFORM("javascript.options.strict",               Bool),

  MAKESAMETYPEPREFTRANSFORM("keyword.URL",                             String),
  MAKESAMETYPEPREFTRANSFORM("keyword.enabled",                         Bool),

  MAKESAMETYPEPREFTRANSFORM("layout.css.dpi",                          Int),
  MAKESAMETYPEPREFTRANSFORM("layout.spellcheckDefault",                Int),

  MAKESAMETYPEPREFTRANSFORM("mail.accountmanager.accounts",            String),
  MAKESAMETYPEPREFTRANSFORM("mail.accountmanager.defaultaccount",      String),
  MAKESAMETYPEPREFTRANSFORM("mail.accountmanager.localfoldersserver",  String),
  MAKESAMETYPEPREFTRANSFORM("mail.accountwizard.deferstorage",         Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.adaptivefilters.junk_threshold",     Int),
  MAKESAMETYPEPREFTRANSFORM("mail.autoComplete.highlightNonMatches",   Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.biff.animate_doc_icon",              Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.biff.play_sound",                    Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.biff.play_sound.type",               Int),
  MAKEPREFTRANSFORM("mail.biff.play_sound.url", 0, String,             File),
  MAKESAMETYPEPREFTRANSFORM("mail.biff.show_alert",                    Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.biff.show_tray_icon",                Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.check_all_imap_folders_for_new",     Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.citation_color",                     String),
  MAKESAMETYPEPREFTRANSFORM("mail.collect_addressbook",                String),
  MAKESAMETYPEPREFTRANSFORM("mail.collect_email_address_incoming",     Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.collect_email_address_newsgroup",    Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.collect_email_address_outgoing",     Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.add_undisclosed_recipients", Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.attach.dir",                 String),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.autosave",                   Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.autosaveinterval",           Int),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.dont_attach_source_of_local_network_links", Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.dontWarnMail2Newsgroup",     Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.max_recycled_windows",       Int),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.other.header",               String),
  MAKESAMETYPEPREFTRANSFORM("mail.compose.wrap_to_window_width",       Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.content_disposition_type",           Int),

  MAKESAMETYPEPREFTRANSFORM("mail.default_html_action",                Int),
  MAKESAMETYPEPREFTRANSFORM("mail.default_sendlater_uri",              String),
  MAKESAMETYPEPREFTRANSFORM("mail.delete_matches_sort_order",          Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.display_glyph",                      Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.display_struct",                     Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.enable_autocomplete",                Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.fcc_folder",                         String),
  MAKESAMETYPEPREFTRANSFORM("mail.file_attach_binary",                 Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.fixed_width_messages",               Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.forward_message_mode",               Int),

  MAKESAMETYPEPREFTRANSFORM("mail.incorporate.return_receipt",         Int),
  MAKESAMETYPEPREFTRANSFORM("mail.inline_attachments",                 Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.label_ascii_only_mail_as_us_ascii",  Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.notification.sound",                 String),

  MAKEPREFTRANSFORM("mail.pane_config", "mail.pane_config.dynamic", Int, Int),
  MAKESAMETYPEPREFTRANSFORM("mail.pane_config.dynamic",                Int),
  MAKESAMETYPEPREFTRANSFORM("mail.password_protect_local_cache",       Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.phishing.detection.enabled",         Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.pop3.deleteFromServerOnMove",        Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.prompt_purge_threshhold",            Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.purge_threshhold",                   Int),
  MAKESAMETYPEPREFTRANSFORM("mail.purge.ask",                          Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.purge.min_delay",                    Int),
  MAKESAMETYPEPREFTRANSFORM("mail.purge.timer_interval",               Int),

  MAKESAMETYPEPREFTRANSFORM("mail.quoteasblock",                       Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.quoted_graphical",                   Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.quoted_size",                        Int),
  MAKESAMETYPEPREFTRANSFORM("mail.quoted_style",                       Int),

  MAKESAMETYPEPREFTRANSFORM("mail.receipt.request_header_type",        Int),
  MAKESAMETYPEPREFTRANSFORM("mail.receipt.request_return_receipt_on",  Bool),

  MAKESAMETYPEPREFTRANSFORM("mail.send_struct",                        Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.show_headers",                       Int),
  MAKESAMETYPEPREFTRANSFORM("mail.showPreviewText",                    Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.signature_date",                     Int),
  MAKESAMETYPEPREFTRANSFORM("mail.smtp.useMatchingDomainServer",       Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.smtp.useMatchingHostNameServer",     Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.smtp.defaultserver",                 String),
  MAKESAMETYPEPREFTRANSFORM("mail.smtpservers",                        String),
  MAKESAMETYPEPREFTRANSFORM("mail.spellcheck.inline",                  Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.SpellCheckBeforeSend",               Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.startup.enabledMailCheckOnce",       Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.strict_threading",                   Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.strictly_mime",                      Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.strictly_mime_headers",              Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.strictly_mime.parm_folding",         Bool),

  MAKESAMETYPEPREFTRANSFORM("mail.thread_without_re",                  Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.trusteddomains",                     String),
  MAKESAMETYPEPREFTRANSFORM("mail.warn_on_send_accel_key",             Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.warn_filter_changed",                Bool),
  MAKESAMETYPEPREFTRANSFORM("mail.wrap_long_lines",                    Bool),

  MAKESAMETYPEPREFTRANSFORM("mailnews.account_central_page.url",       String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.confirm.moveFoldersToTrash",     Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.customDBHeaders",                String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.customHeaders",                  String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.default_sort_order",             Int),
  MAKESAMETYPEPREFTRANSFORM("mailnews.default_sort_type",              Int),
  MAKESAMETYPEPREFTRANSFORM("mailnews.default_news_sort_order",        Int),
  MAKESAMETYPEPREFTRANSFORM("mailnews.default_news_sort_type",         Int),
  MAKESAMETYPEPREFTRANSFORM("mailnews.display.disable_format_flowed_support", Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.display.disallow_mime_handlers", Int),
  MAKESAMETYPEPREFTRANSFORM("mailnews.display.html_as",                Int),
  MAKESAMETYPEPREFTRANSFORM("mailnews.display_html_sanitzer.allowed_tags", String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.display.original_date",          Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.display.prefer_plaintext",       Bool),

  MAKESAMETYPEPREFTRANSFORM("mailnews.force_ascii_search",             Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.force_charset_override",         Bool),

  MAKESAMETYPEPREFTRANSFORM("mailnews.headers.showOrganization",       Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.headers.showUserAgent",          Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.headers.extraExpandedHeaders",   String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.html_domains",                   String),

  MAKESAMETYPEPREFTRANSFORM("mailnews.mark_message_read.delay",        Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.mark_message_read.delay.interval", Int),

  MAKESAMETYPEPREFTRANSFORM("mailnews.message_display.allow.plugins",  Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.message_display.disable_remote_image", Bool),

  MAKESAMETYPEPREFTRANSFORM("mailnews.nav_crosses_folders",            Int),

  MAKESAMETYPEPREFTRANSFORM("mailnews.offline_sync_mail",              Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.offline_sych_news",              Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.offline_sync_send_unsent",       Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.offline_sync_work_offline",      Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.open_window_warning",            Int),
  MAKESAMETYPEPREFTRANSFORM("mailnews.plaintext_domains",              String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.remember_selected_message",      Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.reply_in_default_charset",       Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.reuse_message_window",           Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.scroll_to_new_message",          Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.search_date_format",             String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.search_date_leading_zeros",      String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.search_date_separator",          String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.send_default_charset",           String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.send_plaintext_flowed",          Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.show_send_progress",             String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.start_page.enabled",             Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.start_page.url",                 String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.tcptimeout",                     Int),
  MAKESAMETYPEPREFTRANSFORM("mailnews.thread_pane_column_unthreads",   Bool),
  MAKESAMETYPEPREFTRANSFORM("mailnews.view_default_charset",           String),
  MAKESAMETYPEPREFTRANSFORM("mailnews.wraplength",                     Int),

  MAKESAMETYPEPREFTRANSFORM("messenger.save.dir",                      String),
  MAKESAMETYPEPREFTRANSFORM("messenger.throbber.url",                  String),

  MAKESAMETYPEPREFTRANSFORM("msgcompose.background_color",             String),
  MAKESAMETYPEPREFTRANSFORM("msgcompose.font_face",                    String),
  MAKESAMETYPEPREFTRANSFORM("msgcompose.font_size",                    String),
  MAKESAMETYPEPREFTRANSFORM("msgcompose.text_color",                   String),

  MAKESAMETYPEPREFTRANSFORM("news.get_messages_on_select",             Bool),
  MAKESAMETYPEPREFTRANSFORM("news.show_first_unread",                  Bool),
  MAKESAMETYPEPREFTRANSFORM("news.show_size_in_lines",                 Bool),
  MAKESAMETYPEPREFTRANSFORM("news.update_unread_on_expand",            Bool),
  MAKESAMETYPEPREFTRANSFORM("news.wrap_long_lines",                    Bool),

  // pdi is the new preference, but nii is the old one - so do nii first, and
  // then do pdi to account for both situations
  MAKEPREFTRANSFORM("network.image.imageBehavior", 0, Int,             Image),
  MAKESAMETYPEPREFTRANSFORM("permissions.default.image",               Int),

  MAKESAMETYPEPREFTRANSFORM("network.cookie.alwaysAcceptSessionCookies",Bool),
  MAKEPREFTRANSFORM("network.cookie.cookieBehavior", 0, Int,           Cookie),
  MAKESAMETYPEPREFTRANSFORM("network.cookie.lifetime.behavior",        Int),
  MAKESAMETYPEPREFTRANSFORM("network.cookie.lifetime.days",            Int),
  MAKESAMETYPEPREFTRANSFORM("network.cookie.lifetime.enabled",         Bool),
  MAKESAMETYPEPREFTRANSFORM("network.cookie.lifetimePolicy",           Int),
  MAKESAMETYPEPREFTRANSFORM("network.cookie.warnAboutCookies",         Bool),
  MAKESAMETYPEPREFTRANSFORM("network.ftp.anonymous_password",          String),
  MAKESAMETYPEPREFTRANSFORM("network.prefetch-next",                   Bool),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.autoconfig_url",            String),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.ftp",                       String),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.ftp_port",                  Int),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.gopher",                    String),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.gopher_port",               Int),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.http",                      String),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.http_port",                 Int),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.no_proxies_on",             String),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.socks",                     String),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.socks_port",                Int),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.ssl",                       String),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.ssl_port",                  Int),
  MAKESAMETYPEPREFTRANSFORM("network.proxy.type",                      Int),
  MAKESAMETYPEPREFTRANSFORM("nglayout.enable_drag_images",             Bool),

  MAKESAMETYPEPREFTRANSFORM("offline.autodetect",                      Bool),
  MAKESAMETYPEPREFTRANSFORM("offline.download.download_messages",      Int),
  MAKESAMETYPEPREFTRANSFORM("offline.send.unsent_messages",            Int),
  MAKESAMETYPEPREFTRANSFORM("offline.startup_state",                   Int),

  MAKESAMETYPEPREFTRANSFORM("permissions.default.image",               Int),
  MAKESAMETYPEPREFTRANSFORM("plugin.override_internal_types",          Bool),
  MAKESAMETYPEPREFTRANSFORM("plugin.expose_full_path",                 Bool),

  MAKESAMETYPEPREFTRANSFORM("privacy.popups.disable_from_plugins",     Int),
  MAKESAMETYPEPREFTRANSFORM("privacy.popups.prefill_whitelist",        Bool),
  MAKESAMETYPEPREFTRANSFORM("privacy.popups.remove_blacklist",         Bool),
  MAKESAMETYPEPREFTRANSFORM("privacy.popups.showBrowserMessage",       Bool),
  MAKESAMETYPEPREFTRANSFORM("privacy.popups.sound_enabled",            Bool),
  MAKEPREFTRANSFORM("privacy.popups.sound_url", "privacy.popups.sound_type", String, File),
  MAKESAMETYPEPREFTRANSFORM("privacy.popups.statusbar_icon_enabled",   Bool),

  MAKESAMETYPEPREFTRANSFORM("security.default_personal_cert",          String),
  MAKESAMETYPEPREFTRANSFORM("security.enable_ssl2",                    Bool),
  MAKESAMETYPEPREFTRANSFORM("security.enable_ssl3",                    Bool),
  MAKESAMETYPEPREFTRANSFORM("security.enable_tls",                     Bool),
  MAKESAMETYPEPREFTRANSFORM("security.enable_java",                    Bool),
  MAKESAMETYPEPREFTRANSFORM("security.password_lifetime",              Int),
  MAKESAMETYPEPREFTRANSFORM("security.warn_entering_secure",           Bool),
  MAKESAMETYPEPREFTRANSFORM("security.warn_entering_weak",             Bool),
  MAKESAMETYPEPREFTRANSFORM("security.warn_leaving_secure",            Bool),
  MAKESAMETYPEPREFTRANSFORM("security.warn_submit_insecure",           Bool),
  MAKESAMETYPEPREFTRANSFORM("security.warn_viewing_mixed",             Bool),

  MAKESAMETYPEPREFTRANSFORM("signon.SignonFileName",                   String),
  MAKESAMETYPEPREFTRANSFORM("signon.rememberSignons",                  Bool),

  MAKESAMETYPEPREFTRANSFORM("slider.snapMultiplier",                   Int),

#ifndef XP_MACOSX
#ifdef XP_UNIX
  MAKESAMETYPEPREFTRANSFORM("ui.allow_platform_file_picker",           Bool),
#endif
#endif
  MAKESAMETYPEPREFTRANSFORM("ui.click_hold_context_menus",             Bool),

  MAKESAMETYPEPREFTRANSFORM("view_source.syntax_highlight",            Bool),
  MAKESAMETYPEPREFTRANSFORM("view_source.wrap_long_lines",             Bool),

  // XXX Because SeaMonkey's default pref for wallet.captureForms is now the
  // opposite sense, we can't actually migrate this preference. Therefore,
  // disable it for now, and re-enable/fix once bug 390025 is fixed.
  //  MAKEPREFTRANSFORM("wallet.captureForms", "browser.formfill.enabled", Bool, Bool),
  MAKESAMETYPEPREFTRANSFORM("wallet.enabled",                          Bool),
  MAKESAMETYPEPREFTRANSFORM("wallet.crypto",                           Bool),
  MAKESAMETYPEPREFTRANSFORM("wallet.crypto.autocompleteoverride",      Bool)
};

nsresult
nsSeamonkeyProfileMigrator::TransformPreferences(const char* aSourcePrefFileName,
                                                 const char* aTargetPrefFileName)
{
  PrefTransform* transform;
  PrefTransform* end = gTransforms + sizeof(gTransforms)/sizeof(PrefTransform);

  // Load the source pref file
  nsCOMPtr<nsIPrefService> psvc(do_GetService(NS_PREFSERVICE_CONTRACTID));
  psvc->ResetPrefs();

  nsCOMPtr<nsIFile> sourcePrefsFile;
  mSourceProfile->Clone(getter_AddRefs(sourcePrefsFile));
  sourcePrefsFile->AppendNative(nsDependentCString(aSourcePrefFileName));
  psvc->ReadUserPrefs(sourcePrefsFile);

  nsCOMPtr<nsIPrefBranch> branch(do_QueryInterface(psvc));
  for (transform = gTransforms; transform < end; ++transform)
    transform->prefGetterFunc(transform, branch);

  // read in the various pref branch trees for accounts, identities, servers,
  // etc.
  static const char* branchNames[] =
  {
    // Keep the three below first, or change the indexes below
    "mail.identity.",
    "mail.server.",
    "ldap_2.",
    "accessibility.",
    "applications.",
    "bidi.",
    "browser.chrome.",
    "browser.display.",
    "browser.download.",
    "browser.search.",
    "browser.tabs.",
    "browser.urlbar.",
    "dom.",
    "editor.",
    "extensions.irc.",
    "extensions.venkman.",
    "font.",
    "general.startup.",
    "helpers.",
    "inspector.",
    "mail.account.",
    "mail.addr_book.",
    "mail.imap.",
    "mail.mdn.",
    "mail.smtpserver.",
    "mail.spam.",
    "mail.toolbars.",
    "mailnews.labels.",
    "mailnews.reply_",
    "mailnews.tags.",
    "middlemouse.",
    "mousewheel.",
    "network.http.",
    "print.",
    "privacy.item.",
    "privacy.sanitize.",
    "security.OSCP.",
    "security.crl.",
    "ui.key."
  };

  PBStructArray branches[NS_ARRAY_LENGTH(branchNames)];
  PRUint32 i;
  for (i = 0; i < NS_ARRAY_LENGTH(branchNames); ++i)
    ReadBranch(branchNames[i], psvc, branches[i]);

  // the signature file prefs may be paths to files in the seamonkey profile
  // path so we need to copy them over and fix these paths up before we write
  // them out to the new prefs.js
  CopySignatureFiles(branches[0], psvc);

  // certain mail prefs may actually be absolute paths instead of profile
  // relative paths we need to fix these paths up before we write them out to
  // the new prefs.js
  CopyMailFolderPrefs(branches[1], psvc);

  CopyAddressBookDirectories(branches[2], psvc);

  // Now that we have all the pref data in memory, load the target pref file,
  // and write it back out
  psvc->ResetPrefs();

  nsCOMPtr<nsIFile> targetPrefsFile;
  mTargetProfile->Clone(getter_AddRefs(targetPrefsFile));
  targetPrefsFile->AppendNative(nsDependentCString(aTargetPrefFileName));

  // Don't use nsnull here as we're too early in the cycle for the prefs
  // service to get its default file (because the NS_GetDirectoryService items
  // aren't fully set up yet).
  psvc->ReadUserPrefs(targetPrefsFile);

  for (transform = gTransforms; transform < end; ++transform)
    transform->prefSetterFunc(transform, branch);

  for (i = 0; i < NS_ARRAY_LENGTH(branchNames); ++i)
    WriteBranch(branchNames[i], psvc, branches[i]);

  psvc->SavePrefFile(targetPrefsFile);

  return NS_OK;
}

nsresult
nsSeamonkeyProfileMigrator::CopyPreferences(PRBool aReplace)
{
  nsresult rv = NS_OK;
  if (!aReplace)
    return rv;

  rv |= TransformPreferences(FILE_NAME_PREFS, FILE_NAME_PREFS);
  rv |= CopyFile(FILE_NAME_USER_PREFS, FILE_NAME_USER_PREFS);

  // Security Stuff
  rv |= CopyFile(FILE_NAME_CERT8DB, FILE_NAME_CERT8DB);
  rv |= CopyFile(FILE_NAME_KEY3DB, FILE_NAME_KEY3DB);
  rv |= CopyFile(FILE_NAME_SECMODDB, FILE_NAME_SECMODDB);

  // User MIME Type overrides
  rv |= CopyFile(FILE_NAME_MIMETYPES, FILE_NAME_MIMETYPES);
  rv |= CopyFile(FILE_NAME_PERSONALDICTIONARY, FILE_NAME_PERSONALDICTIONARY);
  rv |= CopyFile(FILE_NAME_MAILVIEWS, FILE_NAME_MAILVIEWS);

  // User sheets
  rv |= CopyUserSheet(FILE_NAME_USERCHROME);
  return rv | CopyUserSheet(FILE_NAME_USERCONTENT);
}

nsresult
nsSeamonkeyProfileMigrator::CopyHistory(PRBool aReplace)
{
  return aReplace ? CopyFile(FILE_NAME_HISTORY, FILE_NAME_HISTORY) : NS_OK;
}
