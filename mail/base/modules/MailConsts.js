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
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
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
