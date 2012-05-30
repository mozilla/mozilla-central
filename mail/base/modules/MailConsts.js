/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This is a place to store constants and enumerations that are needed only by
 * JavaScript code, especially component/module code.
 */

var EXPORTED_SYMBOLS = ["MailConsts"];

var MailConsts =
{
  /**
   * Determine how to open a message when it is double-clicked or selected and
   * Enter pressed. The preference to set this is mail.openMessageBehavior.
   */
  OpenMessageBehavior: {
    /**
     * Open the message in a new window. If multiple messages are selected, all
     * of them are opened in separate windows.
     */
    NEW_WINDOW: 0,

    /**
     * Open the message in an existing window. If multiple messages are
     * selected, the fallback is to "new window" behavior. If no standalone
     * windows are open, the message is opened in a new standalone window.
     */
    EXISTING_WINDOW: 1,

    /**
     * Open the message in a new tab. If multiple messages are selected, all of
     * them are opened as tabs, with the last tab in the foreground and all the
     * rest in the background. If no 3-pane window is open, the message is
     * opened in a new standalone window.
     */
    NEW_TAB: 2
  }
};
