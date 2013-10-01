/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://calendar/modules/calUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");

/*
 * Authentication helper code
 */

EXPORTED_SYMBOLS = ["cal"]; // even though it's defined in calUtils.jsm, import needs this
cal.auth = {
    /**
     * Auth prompt implementation - Uses password manager if at all possible.
     */
    Prompt: function calPrompt(aProvider) {
        this.mProvider = aProvider;
        this.mReturnedLogins = {};
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

        let prompter = Services.ww.getNewPrompter(null);

        // Only show the save password box if we are supposed to.
        let savepassword = null;
        if (cal.getPrefSafe("signon.rememberSignons", true)) {
            savepassword = cal.calGetString("passwordmgr", "rememberPassword", null, "passwordmgr");
        }

        let aText;
        if (aFixedUsername) {
            aText = cal.calGetString("commonDialogs", "EnterPasswordFor", [aUsername.value, aCalendarName], "global");
            return prompter.promptPassword(aTitle,
                                           aText,
                                           aPassword,
                                           savepassword,
                                           aSavePassword);
        } else {
            aText = cal.calGetString("commonDialogs", "EnterUserPasswordFor", [aCalendarName], "global");
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
            let logins = Services.logins.findLogins({}, aHostName, null, aRealm);

            let newLoginInfo = Components.classes["@mozilla.org/login-manager/loginInfo;1"]
                                         .createInstance(Components.interfaces.nsILoginInfo);
            newLoginInfo.init(aHostName, null, aRealm, aUsername, aPassword, "", "");
            if (logins.length > 0) {
                Services.logins.modifyLogin(logins[0], newLoginInfo);
            } else {
                Services.logins.addLogin(newLoginInfo);
            }
        } catch (exc) {
            // Only show the message if its not an abort, which can happen if
            // the user canceled the master password dialog
            cal.ASSERT(exc.result == Components.results.NS_ERROR_ABORT, exc);
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
            if (!Services.logins.getLoginSavingEnabled(aUsername)) {
                return false;
            }

            let logins = Services.logins.findLogins({}, aHostName, null, aRealm);
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
            let logins = Services.logins.findLogins({}, aHostName, null, aRealm);
            for each (let loginInfo in logins) {
                if (loginInfo.username == aUsername) {
                    Services.logins.removeLogin(loginInfo);
                    return true;
                }
            }
        } catch (exc) {
        }
        return false;
    }
};

/**
 * Calendar Auth prompt implementation. This instance of the auth prompt should
 * be used by providers and other components that handle authentication using
 * nsIAuthPrompt2 and friends.
 *
 * This implementation guarantees there are no request loops when an invalid
 * password is stored in the login-manager.
 *
 * There is one instance of that object per calendar provider.
 */
cal.auth.Prompt.prototype = {
    mProvider: null,

    getPasswordInfo: function capGPI(aPasswordRealm) {
        let username;
        let password;
        let found = false;

        let logins = Services.logins.findLogins({}, aPasswordRealm.prePath, null, aPasswordRealm.realm);
        if (logins.length) {
            username = logins[0].username;
            password = logins[0].password;
            found = true;
        }
        if (found) {
            let keyStr = aPasswordRealm.prePath +":" + aPasswordRealm.realm;
            let now = new Date();
            // Remove the saved password if it was already returned less
            // than 60 seconds ago. The reason for the timestamp check is that
            // nsIHttpChannel can call the nsIAuthPrompt2 interface
            // again in some situation. ie: When using Digest auth token
            // expires.
            if (this.mReturnedLogins[keyStr] &&
                now.getTime() - this.mReturnedLogins[keyStr].getTime() < 60000) {
                cal.LOG("Credentials removed for: user=" + username + ", host="+aPasswordRealm.prePath+", realm="+aPasswordRealm.realm);
                delete this.mReturnedLogins[keyStr];
                cal.auth.passwordManagerRemove(username,
                                               aPasswordRealm.prePath,
                                               aPasswordRealm.realm);
                return {found: false, username: username};
            }
            else {
                this.mReturnedLogins[keyStr] = now;
            }
        }
        return {found: found, username: username, password: password};
    },

    /**
     * Requests a username and a password. Implementations will commonly show a
     * dialog with a username and password field, depending on flags also a
     * domain field.
     *
     * @param aChannel
     *        The channel that requires authentication.
     * @param level
     *        One of the level constants NONE, PW_ENCRYPTED, SECURE.
     * @param authInfo
     *        Authentication information object. The implementation should fill in
     *        this object with the information entered by the user before
     *        returning.
     *
     * @retval true
     *         Authentication can proceed using the values in the authInfo
     *         object.
     * @retval false
     *         Authentication should be cancelled, usually because the user did
     *         not provide username/password.
     *
     * @note   Exceptions thrown from this function will be treated like a
     *         return value of false.
     */
    promptAuth: function capPA(aChannel, aLevel, aAuthInfo) {
        let hostRealm = {};
        hostRealm.prePath = aChannel.URI.prePath;
        hostRealm.realm = aAuthInfo.realm;
        let port = aChannel.URI.port;
        if (port == -1) {
            let handler = Services.io.getProtocolHandler(aChannel.URI.scheme)
                                     .QueryInterface(Components.interfaces.nsIProtocolHandler);
            port = handler.defaultPort;
        }
        hostRealm.passwordRealm = aChannel.URI.host + ":" + port + " (" + aAuthInfo.realm + ")";

        let pw = this.getPasswordInfo(hostRealm);
        aAuthInfo.username = pw.username;
        if (pw && pw.found) {
            aAuthInfo.password = pw.password;
            return true;
        } else {
            let prompter2 = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                                      .getService(Components.interfaces.nsIPromptFactory)
                                      .getPrompt(this.mProvider, Components.interfaces.nsIAuthPrompt2);
            return prompter2.promptAuth(aChannel, aLevel, aAuthInfo);
        }
    },

    /**
     * Asynchronously prompt the user for a username and password.
     * This has largely the same semantics as promptAuth(),
     * but must return immediately after calling and return the entered
     * data in a callback.
     *
     * If the user closes the dialog using a cancel button or similar,
     * the callback's nsIAuthPromptCallback::onAuthCancelled method must be
     * called.
     * Calling nsICancelable::cancel on the returned object SHOULD close the
     * dialog and MUST call nsIAuthPromptCallback::onAuthCancelled on the provided
     * callback.
     *
     * @throw NS_ERROR_NOT_IMPLEMENTED
     *        Asynchronous authentication prompts are not supported;
     *        the caller should fall back to promptUsernameAndPassword().
     */
    asyncPromptAuth : function capAPA(aChannel,   // nsIChannel
                                      aCallback,  // nsIAuthPromptCallback
                                      aContext,   // nsISupports
                                      aLevel,     // PRUint32
                                      aAuthInfo   // nsIAuthInformation
                                ) {
        var self = this;
        let promptlistener = {

            onPromptStart: function() {
                res=self.promptAuth(aChannel, aLevel, aAuthInfo);

                if (res) {
                    this.onPromptAuthAvailable();
                    return true;
                }

                this.onPromptCanceled();
                return false;
            },

            onPromptAuthAvailable : function() {
                aCallback.onAuthAvailable(aContext, aAuthInfo);
            },

            onPromptCanceled : function() {
                aCallback.onAuthCancelled(aContext, true);
            }
        };

        var asyncprompter = Components.classes["@mozilla.org/messenger/msgAsyncPrompter;1"]
                                      .getService(Components.interfaces.nsIMsgAsyncPrompter);
        asyncprompter.queueAsyncAuthPrompt(aChannel.URI.spec, false, promptlistener);
    }
};
