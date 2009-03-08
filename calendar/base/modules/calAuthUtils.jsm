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
 * The Original Code is Calendar component utils.
 *
 * The Initial Developer of the Original Code is
 *   Joey Minta <jminta@gmail.com>
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Philipp Kewisch <mozilla@kewis.ch>
 *   Daniel Boelzle <daniel.boelzle@sun.com>
 *   Martin Schroeder <mschroeder@mozilla.x-home.org>
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

Components.utils.import("resource://calendar/modules/calUtils.jsm");

/*
 * Authentication helper code
 */

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this
cal.auth = {
    /**
     * Auth prompt implementation - Uses password manager if at all possible.
     */
    Prompt: function calPrompt() {
        // use the window watcher service to get a nsIAuthPrompt impl
        this.mPrompter = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                   .getService(Components.interfaces.nsIWindowWatcher)
                                   .getNewAuthPrompter(null);
        this.mTriedStoredPassword = false;
    },

    /**
     * Tries to get the username/password combination of a specific calendar name
     * from the password manager or asks the user.
     *
     * @param   in aTitle           The dialog title.
     * @param   in aCalendarName    The calendar name or url to look up. Can be null.
     * @param   inout aUsername     The username that belongs to the calendar.
     * @param   inout aPassword     The password that belongs to the calendar.
     * @param   inout aSavePassword Should the password be saved?
     * @param   in aFixedUsername   Whether the user name is fixed or editable
     * @return  Could a password be retrieved?
     */
    getCredentials: function calGetCredentials(aTitle,
                                               aCalendarName,
                                               aUsername,
                                               aPassword,
                                               aSavePassword,
                                               aFixedUsername) {

        if (typeof aUsername != "object" ||
            typeof aPassword != "object" ||
            typeof aSavePassword != "object") {
            throw new Components.Exception("", Components.results.NS_ERROR_XPC_NEED_OUT_OBJECT);
        }

        let watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                .getService(Components.interfaces.nsIWindowWatcher);
        let prompter = watcher.getNewPrompter(null);

        // Only show the save password box if we are supposed to.
        let savepassword = null;
        if (cal.getPrefSafe("signon.rememberSignons", true)) {
            savepassword = cal.calGetString("passwordmgr", "rememberPassword", null, "passwordmgr");
        }

        let aText;
        if (aFixedUsername) {
            aText = cal.calGetString("prompts", "EnterPasswordFor", [aUsername.value, aCalendarName], "global");
            return prompter.promptPassword(aTitle,
                                           aText,
                                           aPassword,
                                           savepassword,
                                           aSavePassword);
        } else {
            aText = cal.calGetString("prompts", "EnterUserPasswordFor", [aCalendarName], "global");
            return prompter.promptUsernameAndPassword(aTitle,
                                                      aText,
                                                      aUsername,
                                                      aPassword,
                                                      savepassword,
                                                      aSavePassword);
        }
    },

    /**
     * Helper to insert/update an entry to the password manager.
     *
     * @param aUserName     The username
     * @param aPassword     The corresponding password
     * @param aHostName     The corresponding hostname
     * @param aRealm        The password realm (unused on branch)
     */
    passwordManagerSave: function calPasswordManagerSave(aUsername, aPassword, aHostName, aRealm) {
        cal.ASSERT(aUsername);
        cal.ASSERT(aPassword);

        try {
            let loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                         .getService(Components.interfaces.nsILoginManager);
            let logins = loginManager.findLogins({}, aHostName, null, aRealm);

            let newLoginInfo = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                                         .createInstance(Components.interfaces.nsILoginInfo);
            newLoginInfo.init(aHostName, null, aRealm, aUsername, aPassword, "", "");
            if (logins.length > 0) {
                loginManager.modifyLogin(logins[0], newLoginInfo);
            } else {
                loginManager.addLogin(newLoginInfo);
            }
        } catch (exc) {
            cal.ASSERT(false, exc);
        }
    },

    /**
     * Helper to retrieve an entry from the password manager.
     *
     * @param in  aUsername     The username to search
     * @param out aPassword     The corresponding password
     * @param aHostName         The corresponding hostname
     * @param aRealm            The password realm (unused on branch)
     * @return                  Does an entry exist in the password manager
     */
    passwordManagerGet: function calPasswordManagerGet(aUsername, aPassword, aHostName, aRealm) {
        cal.ASSERT(aUsername);

        if (typeof aPassword != "object") {
            throw new Components.Exception("", Components.results.NS_ERROR_XPC_NEED_OUT_OBJECT);
        }

        try {
            let loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                         .getService(Components.interfaces.nsILoginManager);
            if (!loginManager.getLoginSavingEnabled(aUsername)) {
                return false;
            }

            let logins = loginManager.findLogins({}, aHostName, null, aRealm);
            for each (let loginInfo in logins) {
                if (loginInfo.username == aUsername) {
                    aPassword.value = loginInfo.password;
                    return true;
                }
            }
        } catch (exc) {
            cal.ASSERT(false, exc);
        }
        return false;
    },

    /**
     * Helper to remove an entry from the password manager
     *
     * @param aUsername     The username to remove.
     * @param aHostName     The corresponding hostname
     * @param aRealm        The password realm (unused on branch)
     * @return              Could the user be removed?
     */
    passwordManagerRemove: function calPasswordManagerRemove(aUsername, aHostName, aRealm) {
        cal.ASSERT(aUsername);

        try {
            let loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                         .getService(Components.interfaces.nsILoginManager);
            let logins = loginManager.findLogins({}, aHostName, null, aRealm);
            for each (let loginInfo in logins) {
                if (loginInfo.username == aUsername) {
                    loginManager.removeLogin(loginInfo);
                    return true;
                }
            }
        } catch (exc) {
        }
        return false;
    }
};

cal.auth.Prompt.prototype = {
    prompt: function capP(aDialogTitle, aText, aPasswordRealm, aSavePassword, aDefaultText, aResult) {
        return this.mPrompter.prompt(aDialogTitle,
                                     aText,
                                     aPasswordRealm,
                                     aSavePassword,
                                     aDefaultText,
                                     aResult);
    },

    getPasswordInfo: function capGPI(aPasswordRealm) {
        let username;
        let password;
        let found = false;

        let loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                     .getService(Components.interfaces.nsILoginManager);
        let logins = loginManager.findLogins({}, aPasswordRealm.prePath, null, aPasswordRealm.realm);
        if (logins.length) {
            username = logins[0].username;
            password = logins[0].password;
            found = true;
        }

        return {found: found, username: username, password: password};
    },

    promptUsernameAndPassword: function capPUAP(aDialogTitle, aText,
                                                aPasswordRealm, aSavePassword,
                                                aUser, aPwd) {
        let pw;
        if (!this.mTriedStoredPassword) {
            pw = this.getPasswordInfo(aPasswordRealm);
        }

        if (pw && pw.found) {
            this.mTriedStoredPassword = true;
            aUser.value = pw.username;
            aPwd.value = pw.password;
            return true;
        } else {
            return this.mPrompter.promptUsernameAndPassword(aDialogTitle,
                                                            aText,
                                                            aPasswordRealm,
                                                            aSavePassword,
                                                            aUser,
                                                            aPwd);
        }
    },

    // promptAuth is needed/used on trunk only
    promptAuth: function capPA(aChannel, aLevel, aAuthInfo) {
        let hostRealm = {};
        hostRealm.prePath = aChannel.URI.prePath;
        hostRealm.realm = aAuthInfo.realm;
        let port = aChannel.URI.port;
        if (port == -1) {
            let handler = cal.getIOService().getProtocolHandler(aChannel.URI.scheme)
                                            .QueryInterface(Components.interfaces.nsIProtocolHandler);
            port = handler.defaultPort;
        }
        hostRealm.passwordRealm = aChannel.URI.host + ":" + port + " (" + aAuthInfo.realm + ")";

        let pw;
        if (!this.mTriedStoredPassword) {
            pw = this.getPasswordInfo(hostRealm);
        }
        if (pw && pw.found) {
            this.mTriedStoredPassword = true;
            aAuthInfo.username = pw.username;
            aAuthInfo.password = pw.password;
            return true;
        } else {
            let prompter2 = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                      .getService(Components.interfaces.nsIPromptFactory)
                                      .getPrompt(null, Components.interfaces.nsIAuthPrompt2);
            return prompter2.promptAuth(aChannel, aLevel, aAuthInfo);
        }
    },

    promptPassword: function capPP(aDialogTitle, aText, aPasswordRealm,
                             aSavePassword, aPwd) {
        let found = false;
        let pw;
        if (!this.mTriedStoredPassword) {
            pw = this.getPasswordInfo(aPasswordRealm);
        }

        if (pw && pw.found) {
            this.mTriedStoredPassword = true;
            aPwd.value = pw.password;
            return true;
        } else {
            return this.mPrompter.promptPassword(aDialogTitle,
                                                 aText,
                                                 aPasswordRealm,
                                                 aSavePassword,
                                                 aPwd);
        }
    }
};
