/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Joachim Herb <herb@leo.org>
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

#filter substitution

#ifdef XP_UNIX
#ifndef XP_MACOSX
#define UNIX_BUT_NOT_MAC
#endif
#endif

pref("general.useragent.extra.thunderbird", "@APP_UA_NAME@/@APP_VERSION@");

pref("general.useragent.locale", "@AB_CD@");
pref("general.skins.selectedSkin", "classic/1.0");

#ifdef XP_MACOSX
pref("browser.chromeURL", "chrome://messenger/content/messengercompose/messengercompose.xul");
pref("mail.biff.animate_dock_icon", false);
#endif

pref("mail.rights.version", 0);

// Don't show the about:rights notification in debug or non-official builds.
#ifdef DEBUG
pref("mail.rights.override", true);
#endif
#ifndef OFFICIAL_BUILD
pref("mail.rights.override", true);
#endif

// gtk2 (*nix) lacks transparent/translucent drag support (bug 376238), so we
// want to disable it so people can see where they are dragging things.
// (Stock gtk drag icons will be used instead.)
#ifdef MOZ_WIDGET_GTK2
pref("nglayout.enable_drag_images", false);
#endif

// App-specific update preferences

// Whether or not app updates are enabled
pref("app.update.enabled", true);               

// This preference turns on app.update.mode and allows automatic download and
// install to take place. We use a separate boolean toggle for this to make     
// the UI easier to construct.
pref("app.update.auto", true);

// Defines how the Application Update Service notifies the user about updates:
//
// AUM Set to:        Minor Releases:     Major Releases:
// 0                  download no prompt  download no prompt
// 1                  download no prompt  download no prompt if no incompatibilities
// 2                  download no prompt  prompt
//
// See chart in nsUpdateService.js.in for more details
//
pref("app.update.mode", 1);
// If set to true, the Update Service will present no UI for any event.
pref("app.update.silent", false);

// Update service URL:
pref("app.update.url", "https://aus2.mozillamessaging.com/update/3/%PRODUCT%/%VERSION%/%BUILD_ID%/%BUILD_TARGET%/%LOCALE%/%CHANNEL%/%OS_VERSION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/update.xml");

// URL user can browse to manually if for some reason all update installation
// attempts fail.  TODO: Change this URL
pref("app.update.url.manual", "http://www.mozillamessaging.com/%LOCALE%/%APP%/");
// A default value for the "More information about this update" link
// supplied in the "An update is available" page of the update wizard. 
pref("app.update.url.details", "http://www.mozillamessaging.com/%LOCALE%/%APP%/releases/");
// User-settable override to app.update.url for testing purposes.
//pref("app.update.url.override", "");

// Interval: Time before prompting the user again to restart to install the
//           latest download (in seconds) default=1 day
pref("app.update.nagTimer.restart", 86400);
// Interval: When all registered timers should be checked (in milliseconds)
//           default=10 minutes
pref("app.update.timer", 600000);
// Give the user x seconds to react before showing the big UI. default=12 hrs
pref("app.update.promptWaitTime", 43200);
// Show the Update Checking/Ready UI when the user was idle for x seconds
pref("app.update.idletime", 60);

// Whether or not we show a dialog box informing the user that the update was
// successfully applied. This is off in Firefox by default since we show a 
// upgrade start page instead! Other apps may wish to show this UI, and supply
// a whatsNewURL field in their brand.properties that contains a link to a page
// which tells users what's new in this new update.
pref("app.update.showInstalledUI", false);

// Release notes URL
pref("app.releaseNotesURL", "http://live.mozillamessaging.com/%APP%/releasenotes?locale=%LOCALE%&version=%VERSION%&os=%OS%&buildid=%APPBUILDID%");

// Base URL for web-based support pages.
pref("app.support.baseURL", "http://support.live.mozillamessaging.com/%LOCALE%/%APP%/%APPBUILDID%/");

// Controls enabling of the extension system logging (can reduce performance)
pref("extensions.logging.enabled", false);

pref("extensions.update.autoUpdateDefault", true);

// Preferences for AMO integration
pref("extensions.getAddons.cache.enabled", true);
pref("extensions.getAddons.maxResults", 15);
pref("extensions.getAddons.get.url", "https://services.addons.mozilla.org/%LOCALE%/%APP%/api/%API_VERSION%/search/guid:%IDS%?src=thunderbird");
pref("extensions.getAddons.search.browseURL", "https://addons.mozilla.org/%LOCALE%/%APP%/search?q=%TERMS%");
pref("extensions.getAddons.search.url", "https://services.addons.mozilla.org/%LOCALE%/%APP%/api/%API_VERSION%/search/%TERMS%/all/%MAX_RESULTS%/%OS%/%VERSION%?src=thunderbird");
pref("extensions.webservice.discoverURL", "https://services.addons.mozilla.org/%LOCALE%/%APP%/discovery/%VERSION%/%OS%");

// Blocklist preferences
pref("extensions.blocklist.enabled", true);
pref("extensions.blocklist.interval", 86400);
pref("extensions.blocklist.url", "https://addons.mozilla.org/blocklist/3/%APP_ID%/%APP_VERSION%/%PRODUCT%/%BUILD_ID%/%BUILD_TARGET%/%LOCALE%/%CHANNEL%/%OS_VERSION%/%DISTRIBUTION%/%DISTRIBUTION_VERSION%/%PING_COUNT%/");
pref("extensions.blocklist.detailsURL", "https://www.mozilla.com/%LOCALE%/blocklist/");

// Enables some extra Extension System Logging (can reduce performance) 
pref("extensions.logging.enabled", false); 

// Symmetric (can be overridden by individual extensions) update preferences.
// e.g.
//  extensions.{GUID}.update.enabled
//  extensions.{GUID}.update.url
//  extensions.{GUID}.update.interval
//  .. etc ..
//
pref("extensions.update.enabled", true);
pref("extensions.update.url", "https://versioncheck.addons.mozilla.org/update/VersionCheck.php?reqVersion=%REQ_VERSION%&id=%ITEM_ID%&version=%ITEM_VERSION%&maxAppVersion=%ITEM_MAXAPPVERSION%&status=%ITEM_STATUS%&appID=%APP_ID%&appVersion=%APP_VERSION%&appOS=%APP_OS%&appABI=%APP_ABI%&locale=%APP_LOCALE%&currentAppVersion=%CURRENT_APP_VERSION%&updateType=%UPDATE_TYPE%");

pref("extensions.update.interval", 86400);  // Check for updates to Extensions and 
                                            // Themes every day

pref("extensions.getMoreThemesURL", "https://addons.mozilla.org/%LOCALE%/%APP%/themes/");
pref("extensions.dss.enabled", false);          // Dynamic Skin Switching                                               
pref("extensions.dss.switchPending", false);    // Non-dynamic switch pending after next

pref("extensions.{972ce4c6-7e08-4474-a285-3208198ce6fd}.name", "chrome://messenger/locale/messenger.properties");
pref("extensions.{972ce4c6-7e08-4474-a285-3208198ce6fd}.description", "chrome://messenger/locale/messenger.properties");

pref("lightweightThemes.update.enabled", true);

pref("xpinstall.whitelist.add", "addons.mozilla.org");
pref("xpinstall.whitelist.add.36", "getpersonas.com");

pref("mail.shell.checkDefaultClient", true);
pref("mail.spellcheck.inline", true);

pref("mail.biff.alert.show_preview", true);
pref("mail.biff.alert.show_subject", true);
pref("mail.biff.alert.show_sender",  true);

pref("mail.folder.views.version", 0);

// target folder URI used for the last move or copy
pref("mail.last_msg_movecopy_target_uri", "");
// last move or copy operation was a move
pref("mail.last_msg_movecopy_was_move", true);

#ifdef XP_WIN
pref("browser.preferences.instantApply", false);
#else
pref("browser.preferences.instantApply", true);
#endif
#ifdef XP_MACOSX
pref("browser.preferences.animateFadeIn", true);
#else
pref("browser.preferences.animateFadeIn", false);
#endif

pref("browser.download.show_plugins_in_list", false);
pref("browser.download.hide_plugins_without_extensions", true);

pref("accessibility.typeaheadfind", false);
pref("accessibility.typeaheadfind.timeout", 5000);
pref("accessibility.typeaheadfind.linksonly", false);
pref("accessibility.typeaheadfind.flashBar", 1);

pref("mail.close_message_window.on_delete", false);

// Number of lines of To/CC/BCC address headers to show before "more"
// truncates the list.
pref("mailnews.headers.show_n_lines_before_more", 1);

// Thunderbird wants to show the migration assistant on upgrade by default.
pref("mail.ui.show.migration.on.upgrade", true);

/////////////////////////////////////////////////////////////////
// Overrides of the core mailnews.js prefs
/////////////////////////////////////////////////////////////////
pref("mail.showCondensedAddresses", true); // show the friendly display name for people I know

// hidden pref for changing how we present attachments in the message pane
pref("mailnews.attachments.display.largeView", false);
pref("mail.pane_config.dynamic",            0);
pref("mailnews.reuse_thread_window2",     true);
pref("editor.singleLine.pasteNewlines", 4);  // substitute commas for new lines in single line text boxes

// hidden pref to ensure a certain number of headers in the message pane
// to avoid the height of the header area from changing when headers are present / not present
pref("mailnews.headers.minNumHeaders", 0); // 0 means we ignore this pref

// 0=no header, 1="<author> wrote:", 2="On <date> <author> wrote:"
// 3="<author> wrote On <date>:", 4=user specified
pref("mailnews.reply_header_type", 2);

pref("mail.operate_on_msgs_in_collapsed_threads", true);
pref("mail.warn_on_collapsed_thread_operation", true);

// only affects cookies from RSS articles
// 0-Accept, 1-dontAcceptForeign, 2-dontUse
pref("network.cookie.cookieBehavior", 0);

// clear the SeaMonkey pref, so we don't hear about how we don't have a chrome
// package registered for editor-region while opening about:config
pref("editor.throbber.url", "");

// 0=as attachment 2=default forward as inline with attachments
pref("mail.forward_message_mode", 2);

// 0=ask, 1=plain, 2=html, 3=both
pref("mail.default_html_action", 3);

/////////////////////////////////////////////////////////////////
// End core mailnews.js pref overrides
///////////////////////////////////////////////////////////////// 

/////////////////////////////////////////////////////////////////
// Overrides for generic app behavior from the core all.js
/////////////////////////////////////////////////////////////////

pref("browser.hiddenWindowChromeURL", "chrome://messenger/content/hiddenWindow.xul");

pref("offline.startup_state",            2);
// 0 Ask before sending unsent messages when going online
// 1 Always send unsent messages when going online
// 2 Never send unsent messages when going online
pref("offline.send.unsent_messages",            0);

// 0 Ask before synchronizing the offline mail store when going offline
// 1 Always synchronize the offline store when going offline
// 2 Never synchronize the offline store when going offline
pref("offline.download.download_messages",  0);

#ifdef UNIX_BUT_NOT_MAC
pref("offline.autoDetect", false);
#else
// Windows and Mac can automatically move the user offline or online based on 
// the network connection.
pref("offline.autoDetect", true); 
#endif

// Expose only select protocol handlers. All others should go
// through the external protocol handler route.
// If you are changing this list, you may need to also consider changing the
// list in nsMsgContentPolicy::IsExposedProtocol.
pref("network.protocol-handler.expose-all", false);
pref("network.protocol-handler.expose.mailto", true);
pref("network.protocol-handler.expose.news", true);
pref("network.protocol-handler.expose.snews", true);
pref("network.protocol-handler.expose.nntp", true);
pref("network.protocol-handler.expose.imap", true);
pref("network.protocol-handler.expose.addbook", true);
pref("network.protocol-handler.expose.pop", true);
pref("network.protocol-handler.expose.mailbox", true);
// Although we allow these to be exposed internally, there are various places
// (e.g. message pane) where we may divert them out to external applications.
pref("network.protocol-handler.expose.about", true);
pref("network.protocol-handler.expose.http", true);
pref("network.protocol-handler.expose.https", true);

// suppress external-load warning for standard browser schemes
pref("network.protocol-handler.warn-external.http", false);
pref("network.protocol-handler.warn-external.https", false);
pref("network.protocol-handler.warn-external.ftp", false);

pref("network.hosts.smtp_server",           "mail");
pref("network.hosts.pop_server",            "mail");

pref("security.warn_entering_secure", false);
pref("security.warn_entering_weak", false);
pref("security.warn_leaving_secure", false);
pref("security.warn_viewing_mixed", false);

pref("general.config.obscure_value", 0); // for MCD .cfg files

pref("browser.display.auto_quality_min_font_size", 0);

pref("view_source.syntax_highlight", false);
/////////////////////////////////////////////////////////////////
// End core all.js pref overrides
///////////////////////////////////////////////////////////////// 

/////////////////////////////////////////////////////////////////
// Generic browser related prefs. 
/////////////////////////////////////////////////////////////////
pref("browser.cache.memory.capacity",       4096);
pref("browser.send_pings", false);
pref("browser.chrome.toolbar_tips",         true);
pref("browser.xul.error_pages.enabled", true);
pref("browser.xul.error_pages.expert_bad_cert", false);

// Attachment download manager settings
pref("mail.attachment.store.version", 0);
pref("browser.download.useDownloadDir", false);
pref("browser.download.folderList", 0);
pref("browser.download.manager.showAlertOnComplete", false);
pref("browser.download.manager.showAlertInterval", 2000);
pref("browser.download.manager.retention", 1);
pref("browser.download.manager.showWhenStarting", true);
pref("browser.download.manager.closeWhenDone", true);
pref("browser.download.manager.openDelay", 100);
pref("browser.download.manager.focusWhenStarting", false);
pref("browser.download.manager.flashCount", 0);
pref("browser.download.manager.addToRecentDocs", true);

pref("javascript.options.showInConsole",    true);

pref("spellchecker.dictionary", "");
// Dictionary download preference
pref("spellchecker.dictionaries.download.url", "https://addons.mozilla.org/%LOCALE%/%APP%/dictionaries/");

// profile.force.migration can be used to bypass the migration wizard, forcing migration from a particular
// mail application without any user intervention. Possible values are: 
// seamonkey (mozilla suite), eudora, oexpress, outlook.
pref("profile.force.migration", "");

// prefs to control the mail alert notification
pref("alerts.slideIncrementTime", 50);
pref("alerts.totalOpenTime", 3000);

// analyze urls in mail messages for scams
pref("mail.phishing.detection.enabled", true);
// If phishing detection is enabled, allow fine grained control
// of the local, static tests
pref("mail.phishing.detection.ipaddresses", true); 
pref("mail.phishing.detection.mismatched_hosts", true);

pref("browser.safebrowsing.enabled", false);

// Non-enhanced mode (local url lists) URL list to check for updates
pref("browser.safebrowsing.provider.0.updateURL", "");
pref("browser.safebrowsing.dataProvider", 0);

// Does the provider name need to be localizable?
pref("browser.safebrowsing.provider.0.name", "");
pref("browser.safebrowsing.provider.0.lookupURL", "");
pref("browser.safebrowsing.provider.0.keyURL", "");
pref("browser.safebrowsing.provider.0.reportURL", "");

// HTML report pages
pref("browser.safebrowsing.provider.0.reportGenericURL", "http://{moz:locale}.phish-generic.mozilla.com/?hl={moz:locale}");
pref("browser.safebrowsing.provider.0.reportErrorURL", "http://{moz:locale}.phish-error.mozilla.com/?hl={moz:locale}");
pref("browser.safebrowsing.provider.0.reportPhishURL", "http://{moz:locale}.phish-report.mozilla.com/?hl={moz:locale}");

// FAQ URL
// XXX Firefox is hard-coded because we haven't got our own version yet.
pref("browser.safebrowsing.warning.infoURL", "http://www.mozilla.com/%LOCALE%/firefox/phishing-protection/");

// prevent status-bar spoofing even if people are foolish enough to turn on JS
pref("dom.disable_window_status_change",          true);

// For the Empty Junk/Trash confirmation dialogs.
pref("mail.emptyJunk.dontAskAgain", false);
pref("mail.emptyTrash.dontAskAgain", false);

// If a message is opened using Enter or a double click, what should we do?
// 0 - open it in a new window
// 1 - open it in an existing window
// 2 - open it in a new tab
pref("mail.openMessageBehavior", 2);
pref("mail.openMessageBehavior.version", 0);
// If messages or folders are opened using the context menu or a middle click,
// should we open them in the foreground or in the background?
pref("mail.tabs.loadInBackground", true);

// Tabs
pref("mail.tabs.tabMinWidth", 100);
pref("mail.tabs.tabMaxWidth", 250);
pref("mail.tabs.tabClipWidth", 140);
pref("mail.tabs.autoHide", false);
pref("mail.tabs.closeWindowWithLastTab", true);

// Where to show tab close buttons:
// 0 - active tab only
// 1 - all tabs until tabClipWidth is reached, then active tab only
// 2 - no close buttons
// 3 - at the end of the tabstrip
pref("mail.tabs.closeButtons", 1);

// The breakpad report server to link to in about:crashes
pref("breakpad.reportURL", "http://crash-stats.mozilla.com/report/index/");

// OS Integrated Search and Indexing
#ifdef XP_WIN
pref("mail.winsearch.enable", false);
pref("mail.winsearch.firstRunDone", false);
#else
#ifdef XP_MACOSX
pref("mail.spotlight.enable", false);
pref("mail.spotlight.firstRunDone", false);
#endif
#endif

// -- Windows Search/Spotlight logging options
#ifdef XP_WIN
// Should we output warnings and errors to the "error console"?
pref("mail.winsearch.logging.console", false);
// Should we output all output levels to stdout via dump?
pref("mail.winsearch.logging.dump", false);
#else
#ifdef XP_MACOSX
// Should we output warnings and errors to the "error console"?
pref("mail.spotlight.logging.console", false);
// Should we output all output levels to stdout via dump?
pref("mail.spotlight.logging.dump", false);
#endif
#endif

// Whether to use a panel that looks like an OS X sheet for customization
#ifdef XP_MACOSX
pref("toolbar.customization.usesheet", true);
#else
pref("toolbar.customization.usesheet", false);
#endif

// Check for missing attachments?
pref("mail.compose.attachment_reminder", true);
// Words that should trigger a missing attachments warning.
pref("mail.compose.attachment_reminder_keywords", "chrome://messenger/locale/messengercompose/composeMsgs.properties");
// When no action is taken on the inline missing attachement notification,
// show an alert on send?
pref("mail.compose.attachment_reminder_aggressive", true);

pref("browser.formfill.enable", true);

// Disable autoplay as we don't handle audio elements in emails very well.
// See bug 515082.
pref("media.autoplay.enabled", false);

// whether to hide the timeline view by default in the faceted search display
pref("gloda.facetview.hidetimeline", true);

// Enable gloda by default!
pref("mailnews.database.global.indexer.enabled", true);
// Show gloda errors in the error console
pref("mailnews.database.global.logging.console", true);

// page to load to find good header add-ons
pref("mailnews.migration.header_addons_url","http://live.mozillamessaging.com/%APP%/addons/search?q=header&locale=%LOCALE%&lver=%VERSION%&hver=%VERSION%&os=%OS%");

// Serif fonts look dated.  Switching those language families to sans-serif
// where we think it makes sense.  Worth investigating for other font families
// as well, viz bug 520824.  See all.js for the rest of the font families
// preferences.
pref("font.default", "sans-serif");
pref("font.default.x-unicode", "sans-serif");
pref("font.default.x-western", "sans-serif");
pref("font.default.x-central-euro", "sans-serif");
pref("font.default.x-cyrillic", "sans-serif");
pref("font.default.x-baltic", "sans-serif");
pref("font.default.el", "sans-serif");
pref("font.default.tr", "sans-serif");

#ifdef XP_MACOSX
pref("font.name.sans-serif.x-unicode", "Lucida Grande");
pref("font.name.monospace.x-unicode", "Menlo");
pref("font.name-list.sans-serif.x-unicode", "Lucida Grande");
pref("font.name-list.monospace.x-unicode", "Menlo, Monaco");
pref("font.size.variable.x-unicode", 15);
pref("font.size.fixed.x-unicode", 12);

pref("font.name.sans-serif.x-western", "Lucida Grande");
pref("font.name.monospace.x-western", "Menlo");
pref("font.name-list.sans-serif.x-western", "Lucida Grande");
pref("font.name-list.monospace.x-western", "Menlo, Monaco");
pref("font.size.variable.x-western", 15);
pref("font.size.fixed.x-western", 12);

pref("font.name.sans-serif.x-central-euro", "Lucida Grande");
pref("font.name.monospace.x-central-euro", "Menlo");
pref("font.name-list.sans-serif.x-central-euro", "Lucida Grande");
pref("font.name-list.monospace.x-central-euro", "Menlo, Monaco");
pref("font.size.variable.x-central-euro", 15);
pref("font.size.fixed.x-central-euro", 12);

pref("font.name.sans-serif.x-cyrillic", "Lucida Grande");
pref("font.name.monospace.x-cyrillic", "Menlo");
pref("font.name-list.sans-serif.x-cyrillic", "Lucida Grande");
pref("font.name-list.monospace.x-cyrillic", "Menlo, Monaco");
pref("font.size.variable.x-cyrillic", 15);
pref("font.size.fixed.x-cyrillic", 12);

pref("font.name.sans-serif.x-baltic", "Lucida Grande");
pref("font.name.monospace.x-baltic", "Menlo");
pref("font.name-list.sans-serif.x-baltic", "Lucida Grande");
pref("font.name-list.monospace.x-baltic", "Menlo, Monaco");
pref("font.size.variable.x-baltic", 15);
pref("font.size.fixed.x-baltic", 12);

pref("font.name.sans-serif.el", "Lucida Grande");
pref("font.name.monospace.el", "Menlo");
pref("font.name-list.sans-serif.el", "Lucida Grande");
pref("font.name-list.monospace.el", "Menlo, Monaco");
pref("font.size.variable.el", 15);
pref("font.size.fixed.el", 12);

pref("font.name.sans-serif.tr", "Lucida Grande");
pref("font.name.monospace.tr", "Menlo");
pref("font.name-list.sans-serif.tr", "Lucida Grande");
pref("font.name-list.monospace.tr", "Menlo, Monaco");
pref("font.size.variable.tr", 15);
pref("font.size.fixed.tr", 12);
#endif

// Since different versions of Windows need different settings, we'll handle
// this in mailMigrator.js.

// Linux, in other words.  Other OSes may wish to override.
#ifdef UNIX_BUT_NOT_MAC
// The font.name-list fallback is defined in case font.name isn't
// present -- e.g. in case a profile that's been used on Windows Vista or above
// is used on Linux.
pref("font.name-list.serif.x-unicode", "serif");
pref("font.name-list.sans-serif.x-unicode", "sans-serif");
pref("font.name-list.monospace.x-unicode", "monospace");

pref("font.name-list.serif.x-western", "serif");
pref("font.name-list.sans-serif.x-western", "sans-serif");
pref("font.name-list.monospace.x-western", "monospace");

pref("font.name-list.serif.x-central-euro", "serif");
pref("font.name-list.sans-serif.x-central-euro", "sans-serif");
pref("font.name-list.monospace.x-central-euro", "monospace");

pref("font.name-list.serif.x-cyrillic", "serif");
pref("font.name-list.sans-serif.x-cyrillic", "sans-serif");
pref("font.name-list.monospace.x-cyrillic", "monospace");

pref("font.name-list.serif.x-baltic", "serif");
pref("font.name-list.sans-serif.x-baltic", "sans-serif");
pref("font.name-list.monospace.x-baltic", "monospace");

pref("font.name-list.serif.el", "serif");
pref("font.name-list.sans-serif.el", "sans-serif");
pref("font.name-list.monospace.el", "monospace");

pref("font.name-list.serif.tr", "serif");
pref("font.name-list.sans-serif.tr", "sans-serif");
pref("font.name-list.monospace.tr", "monospace");
#endif

pref("mail.font.windows.version", 0);

// What level of warning should we send to the error console?
pref("mail.wizard.logging.console", "None");
// What level of warning should we send to stdout via dump?
pref("mail.wizard.logging.dump", "None");

// Handle links targeting new windows (from within content tabs)
// These are the values that Firefox can be set to:
// 0=default window, 1=current window/tab, 2=new window,
// 3=new tab in most recent window
//
// Thunderbird only supports a value of 3. Other values can be set, but are
// not implemented or supported.
pref("browser.link.open_newwindow", 3);

// These are the values that Firefox can be set to:
// 0: no restrictions - divert everything
// 1: don't divert window.open at all
// 2: don't divert window.open with features
//
// Thunderbird only supports a value of 0. Other values can be set, but are
// not implemented or supported.
pref("browser.link.open_newwindow.restriction", 0);

pref("browser.tabs.loadDivertedInBackground", false);

// Disable places by default as we don't want to store global history
// Below we define reasonable defaults as copied from Firefox so that we have
// something sensible should an extension wish to enable this.
pref("places.history.enabled", false);

// The percentage of system memory that the Places database can use.  Out of the
// allowed cache size it will at most use the size of the database file.
// Changes to this value are effective after an application restart.
// Acceptable values are between 0 and 50.
pref("places.database.cache_to_memory_percentage", 6);

// the (maximum) number of the recent visits to sample
// when calculating frecency
pref("places.frecency.numVisits", 10);

// buckets (in days) for frecency calculation
pref("places.frecency.firstBucketCutoff", 4);
pref("places.frecency.secondBucketCutoff", 14);
pref("places.frecency.thirdBucketCutoff", 31);
pref("places.frecency.fourthBucketCutoff", 90);

// weights for buckets for frecency calculations
pref("places.frecency.firstBucketWeight", 100);
pref("places.frecency.secondBucketWeight", 70);
pref("places.frecency.thirdBucketWeight", 50);
pref("places.frecency.fourthBucketWeight", 30);
pref("places.frecency.defaultBucketWeight", 10);

// bonus (in percent) for visit transition types for frecency calculations
pref("places.frecency.embedVisitBonus", 0);
pref("places.frecency.framedLinkVisitBonus", 0);
pref("places.frecency.linkVisitBonus", 100);
pref("places.frecency.typedVisitBonus", 2000);
pref("places.frecency.bookmarkVisitBonus", 75);
pref("places.frecency.downloadVisitBonus", 0);
pref("places.frecency.permRedirectVisitBonus", 0);
pref("places.frecency.tempRedirectVisitBonus", 0);
pref("places.frecency.defaultVisitBonus", 0);

// bonus (in percent) for place types for frecency calculations
pref("places.frecency.unvisitedBookmarkBonus", 140);
pref("places.frecency.unvisitedTypedBonus", 200);

pref("browser.urlbar.restrict.openpage", "%");
