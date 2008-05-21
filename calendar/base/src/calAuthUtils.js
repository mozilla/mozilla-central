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
 * Auth prompt implementation - Uses password manager if at all possible.
 */
function calAuthPrompt() {
    // use the window watcher service to get a nsIAuthPrompt impl
    this.mPrompter = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                               .getService(Components.interfaces.nsIWindowWatcher)
                               .getNewAuthPrompter(null);
    this.mTriedStoredPassword = false;
}

calAuthPrompt.prototype = {
    prompt: function capP(aDialogTitle, aText, aPasswordRealm, aSavePassword,
                          aDefaultText, aResult) {
        return this.mPrompter.prompt(aDialogTitle,
                                     aText,
                                     aPasswordRealm,
                                     aSavePassword,
                                     aDefaultText,
                                     aResult);
    },

    getPasswordInfo: function capGPI(aPasswordRealm) {
        var username;
        var password;
        var found = false;

        if ("@mozilla.org/passwordmanager;1" in Components.classes) {
            var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                            .getService(Components.interfaces.nsIPasswordManager);
            var passwordRealm = aPasswordRealm.passwordRealm || aPasswordRealm;
            var pwenum = passwordManager.enumerator;
            // step through each password in the password manager until we find the one we want:
            while (pwenum.hasMoreElements()) {
                try {
                    var pass = pwenum.getNext().QueryInterface(Components.interfaces.nsIPassword);
                    if (pass.host == passwordRealm) {
                         // found it!
                         username = pass.user;
                         password = pass.password;
                         found = true;
                    }
                } catch (ex) {
                    // don't do anything here, ignore the password that could not be read
                }
            }
        } else {
            var loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                         .getService(Components.interfaces
                                         .nsILoginManager);
            var logins = loginManager.findLogins({}, aPasswordRealm.prePath, null,
                                                 aPasswordRealm.realm);
            if (logins.length) {
                username = logins[0].username;
                password = logins[0].password;
                found = true;
            }
        }
        return {found: found, username: username, password: password};
    },

    promptUsernameAndPassword: function capPUAP(aDialogTitle, aText,
                                                aPasswordRealm, aSavePassword,
                                                aUser, aPwd) {
        var pw;
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
        var hostRealm = {};
        hostRealm.prePath = aChannel.URI.prePath;
        hostRealm.realm = aAuthInfo.realm;
        hostRealm.passwordRealm = aChannel.URI.host + ":" + aChannel.URI.port +
                                          " (" + aAuthInfo.realm + ")";

        var pw;
        if (!this.mTriedStoredPassword) {
            pw = this.getPasswordInfo(hostRealm);
        }
        if (pw && pw.found) {
            this.mTriedStoredPassword = true;
            aAuthInfo.username = pw.username;
            aAuthInfo.password = pw.password;
            return true;
        } else {
            var prompter2 = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                      .getService(Components.interfaces.nsIPromptFactory)
                                      .getPrompt(null, Components.interfaces.nsIAuthPrompt2);
            return prompter2.promptAuth(aChannel, aLevel, aAuthInfo);
        }
    },

    promptPassword: function capPP(aDialogTitle, aText, aPasswordRealm,
                             aSavePassword, aPwd) {
        var found = false;
        var pw;
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
function calGetCredentials(aTitle,
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

    var watcher = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                            .getService(Components.interfaces.nsIWindowWatcher);
    var prompter = watcher.getNewPrompter(null);

    // Only show the save password box if we are supposed to.
    var savepassword = null;
    if (getPrefSafe("signon.rememberSignons", true)) {
        savepassword = calGetString("passwordmgr", "rememberPassword", null, "passwordmgr");
    }

    var aText;
    if (aFixedUsername) {
        try {
            // Branch uses chrome://necko/locale/necko.properties
            aText = calGetString("necko", "EnterPasswordFor", [aUsername.value, aCalendarName], "necko");
        } catch (exc) {
            // Trunk uses chrome://global/locale/prompts.properties
            aText = calGetString("prompts", "EnterPasswordFor", [aUsername.value, aCalendarName], "global");
        }
        return prompter.promptPassword(aTitle,
                                       aText,
                                       aPassword,
                                       savepassword,
                                       aSavePassword);
    } else {
        try {
            // Branch uses chrome://necko/locale/necko.properties
            aText = calGetString("necko", "EnterUserPasswordFor", [aCalendarName], "necko");
        } catch (exc) {
            // Trunk uses chrome://global/locale/prompts.properties
            aText = calGetString("prompts", "EnterUserPasswordFor", [aCalendarName], "global");
        }
        return prompter.promptUsernameAndPassword(aTitle,
                                                  aText,
                                                  aUsername,
                                                  aPassword,
                                                  savepassword,
                                                  aSavePassword);
    }
}

/**
 * Helper to insert/update an entry to the password manager.
 *
 * @param aUserName     The username
 * @param aPassword     The corresponding password
 * @param aHostName     The corresponding hostname
 * @param aRealm        The password realm (unused on branch)
 */
function calPasswordManagerSave(aUsername, aPassword, aHostName, aRealm) {
    ASSERT(aUsername);
    ASSERT(aPassword);

    try {
        if (Components.classes["@mozilla.org/passwordmanager;1"]) {
            calPasswordManagerRemove(aUsername, aHostName, aRealm);
            var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                            .getService(Components.interfaces.nsIPasswordManager);
            if (aHostName && aHostName[aHostName.length - 1] == '/') {
                // strip trailing slash on branch:
                aHostName = aHostName.substr(0, aHostName.length - 1);
            }
            passwordManager.addUser(aHostName, aUsername, aPassword);
        } else if (Components.classes["@mozilla.org/login-manager;1"]) {
            // Trunk uses LoginManager
            var loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                         .getService(Components.interfaces.nsILoginManager);
            var logins = loginManager.findLogins({}, aHostName, null, aRealm);
            if (logins.length > 0) {
                var loginInfo = logins[0].clone();
                loginInfo.password = aPassword;
                loginManager.modifyLogin(logins[0], loginInfo);
            } else {
                var loginInfo = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                                          .createInstance(Components.interfaces.nsILoginInfo);
                loginInfo.init(aHostName,
                               null, aRealm,
                               aUsername, aPassword,
                               null, null);
                loginManager.addLogin(loginInfo);
            }
        }
    } catch (exc) {
        ASSERT(false, exc);
    }
}

/**
 * Helper to retrieve an entry from the password manager.
 *
 * @param in  aUsername     The username to search
 * @param out aPassword     The corresponding password
 * @param aHostName         The corresponding hostname
 * @param aRealm            The password realm (unused on branch)
 * @return                  Does an entry exist in the password manager
 */
function calPasswordManagerGet(aUsername, aPassword, aHostName, aRealm) {
    ASSERT(aUsername);

    if (typeof aPassword != "object") {
        throw new Components.Exception("", Components.results.NS_ERROR_XPC_NEED_OUT_OBJECT);
    }

    try {
        if (Components.classes["@mozilla.org/passwordmanager;1"]) {
            // Branch uses PasswordManager
            var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                            .getService(Components.interfaces.nsIPasswordManager);

            if (aHostName && aHostName[aHostName.length - 1] == '/') {
                // strip trailing slash on branch:
                aHostName = aHostName.substr(0, aHostName.length - 1);
            }

            var enumerator = passwordManager.enumerator;
            while (enumerator.hasMoreElements()) {
                var entry = enumerator.getNext().QueryInterface(Components.interfaces.nsIPassword);
                if ((entry.host == aHostName) &&
                    (entry.user == aUsername)) {
                    aPassword.value = entry.password;
                    return true;
                }
            }
        } else if (Components.classes["@mozilla.org/login-manager;1"]) {
            // Trunk uses LoginManager
            var loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                         .getService(Components.interfaces.nsILoginManager);
            if (!loginManager.getLoginSavingEnabled(aUsername)) {
                return false;
            }

            var logins = loginManager.findLogins({}, aHostName, null, aRealm);
            for each (var loginInfo in logins) {
                if (loginInfo.username == aUsername) {
                    aPassword.value = loginInfo.password;
                    return true;
                }
            }
        }
    } catch (exc) {
        ASSERT(false, exc);
    }
    return false;
}

/**
 * Helper to remove an entry from the password manager
 *
 * @param aUsername     The username to remove.
 * @param aHostName     The corresponding hostname
 * @param aRealm        The password realm (unused on branch)
 * @return              Could the user be removed?
 */
function calPasswordManagerRemove(aUsername, aHostName, aRealm) {
    ASSERT(aUsername);

    try {
        if (Components.classes["@mozilla.org/passwordmanager;1"]) {
            // Branch uses PasswordManager
            var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"]
                                            .getService(Components.interfaces.nsIPasswordManager);
            if (aHostName && aHostName[aHostName.length - 1] == '/') {
                // strip trailing slash on branch:
                aHostName = aHostName.substr(0, aHostName.length - 1);
            }
            passwordManager.removeUser(aHostName, aUsername);
            return true;
        } else if (Components.classes["@mozilla.org/login-manager;1"]) {
            // Trunk uses LoginManager
            var loginManager = Components.classes["@mozilla.org/login-manager;1"]
                                         .getService(Components.interfaces.nsILoginManager);
            var logins = loginManager.findLogins({}, aHostName, null, aRealm);
            for each (var loginInfo in logins) {
                if (loginInfo.username == aUsername) {
                    loginManager.removeLogin(loginInfo);
                    return true;
                }
            }
        }
    } catch (exc) {
    }
    return false;
}
