/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// What to do when starting up
//  0 = do not connect / show the account manager
//  1 = connect automatically
//  Other values will be added later, for example to start minimized
pref("messenger.startup.action", 1);

pref("messenger.accounts", "");

// Should the accounts service stored in the password manager the
// passwords that are currently stored in the preferences?
pref("messenger.accounts.convertOldPasswords", false);

// The intervals in seconds between automatic reconnection attempts.
// The last value will be reused for the rest of the reconnection attempts.
// A value of 0 means that there will be no more reconnection attempts.
pref("messenger.accounts.reconnectTimer", "1,5,30,60,90,300,600,1200,3600");

// List of tags ids whose contacts should be shown in the special
// "Other contacts" group.
pref("messenger.buddies.hiddenTags", "");

//  1 accepts invitations automatically,
//  0 ignores the invitations,
// -1 rejects the invitations.
pref("messenger.conversations.autoAcceptChatInvitations", 1);

// Indicates whether the core should always close conversations closed
// by the UI or if they can be put on hold instead.
pref("messenger.conversations.alwaysClose", false);

pref("messenger.conversations.selections.magicCopyEnabled", true);
pref("messenger.conversations.selections.ellipsis", "chrome://chat/locale/conversations.properties");
pref("messenger.conversations.selections.systemMessagesTemplate", "chrome://chat/locale/conversations.properties");
pref("messenger.conversations.selections.contentMessagesTemplate", "chrome://chat/locale/conversations.properties");
pref("messenger.conversations.selections.actionMessagesTemplate", "chrome://chat/locale/conversations.properties");

pref("messenger.conversations.textbox.autoResize", true);
pref("messenger.conversations.textbox.defaultMaxLines", 5);

pref("messenger.conversations.sendFormat", true);

// this preference changes how we filter incoming messages
// 0 = no formattings
// 1 = basic formattings (bold, italic, underlined)
// 2 = permissive mode (colors, font face, font size, ...)
pref("messenger.options.filterMode", 2);

// use "none" to disable
pref("messenger.options.emoticonsTheme", "default");
pref("messenger.options.messagesStyle.theme", "bubbles");
pref("messenger.options.messagesStyle.variant", "default");
pref("messenger.options.messagesStyle.showHeader", false);
pref("messenger.options.messagesStyle.combineConsecutive", true);
// if the time interval in seconds between two messages is longer than
// this value, the messages will not be combined
pref("messenger.options.messagesStyle.combineConsecutiveInterval", 300); // 5 minutes

pref("messenger.status.reportIdle", true);
pref("messenger.status.timeBeforeIdle", 300); // 5 minutes
pref("messenger.status.awayWhenIdle", true);
pref("messenger.status.defaultIdleAwayMessage", "chrome://chat/locale/status.properties");
pref("messenger.status.userIconFileName", "");
pref("messenger.status.userDisplayName", "");

// Default message used when quitting IRC. This is overridable per account.
pref("chat.irc.defaultQuitMessage", "");

// loglevel is the minimum severity level that a libpurple message
// must have to be reported in the Error Console.
//
// The possible values are:
//   0  Show all libpurple messages (PURPLE_DEBUG_ALL)
//   1  Very verbose (PURPLE_DEBUG_MISC)
//   2  Verbose (PURPLE_DEBUG_INFO)
//   3  Show warnings (PURPLE_DEBUG_WARNING)
//   4  Show errors (PURPLE_DEBUG_ERROR)
//   5  Show only fatal errors (PURPLE_DEBUG_FATAL)

// Setting the loglevel to a value smaller than 2 will cause messages
// with an INFO or MISC severity to be displayed as warnings so that
// their file URL is clickable
#ifndef DEBUG
// By default, show only warning and errors
pref("purple.debug.loglevel", 3);
#else
// On debug builds, show warning, errors and debug information.
pref("purple.debug.loglevel", 2);
#endif

pref("purple.logging.format", "json");
pref("purple.logging.log_chats", true);
pref("purple.logging.log_ims", true);
pref("purple.logging.log_system", true);
