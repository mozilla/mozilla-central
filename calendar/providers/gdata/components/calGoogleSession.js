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
 * The Original Code is Google Calendar Provider code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2006
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

// This constant is an arbitrary large number. It is used to tell google to get
// many events, the exact number is not important.
const kMANY_EVENTS = 0x7FFFFFFF;

function calGoogleSessionManager() {
    this.wrappedJSObject = this;

}

calGoogleSessionManager.prototype = {
    mSessionMap: {},

    QueryInterface: function cGSM_QueryInterface(aIID) {
        return doQueryInterface(this,
                                calGoogleSessionManager.prototype,
                                aIID,
                                null,
                                g_classInfo["calGoogleSessionManager"]);
    },

    /**
     * getSessionByUsername
     * Get a Session object for the specified username. If aCreate is false,
     * null will be returned if the session doesn't exist. Otherwise, the
     * session will be created.
     *
     * @param aUsername The username to get the session for
     * @param aCreate   If true, the session will be created prior to returning
     */
    getSessionByUsername: function cGSM_getSessionByUsername(aUsername, aCreate) {
        // If the username contains no @, assume @gmail.com
        // XXX Maybe use accountType=GOOGLE and just pass the raw username?
        if (aUsername.indexOf('@') == -1) {
            aUsername += "@gmail.com";
        }

        // Check if the session exists
        if (!this.mSessionMap.hasOwnProperty(aUsername)) {
            if (!aCreate) {
                return null;
            }
            LOG("Creating session for: " + aUsername);
            this.mSessionMap[aUsername] = new calGoogleSession(aUsername);
        } else {
            LOG("Reusing session for: " + aUsername);
        }

        // XXX What happens if the username is "toSource" :)
        return this.mSessionMap[aUsername];
    }
};

/**
 * calGoogleSession
 * This Implements a Session object to communicate with google
 *
 * @constructor
 * @class
 */
function calGoogleSession(aUsername) {

    this.mItemQueue = new Array();
    this.mGoogleUser = aUsername;
    this.wrappedJSObject = this;

    var username = { value: aUsername };
    var password = { value: null };

    // Try to get the password from the password manager
    if (aUsername && passwordManagerGet(aUsername, password)) {
        this.mGooglePass = password.value;
        this.mPersistPassword = true;
        LOG("Retrieved Password for " + aUsername + " in constructor");
    }
}

calGoogleSession.prototype = {

    QueryInterface: function cGS_QueryInterface(aIID) {
        return doQueryInterface(this,
                                calGoogleSessionManager.prototype,
                                aIID,
                                null,
                                g_classInfo["calGoogleSession"]);
    },

    /* Member Variables */
    mGoogleUser: null,
    mGooglePass: null,
    mGoogleFullName: null,
    mAuthToken: null,
    mSessionID: null,

    mLoggingIn: false,
    mPersistPassword: false,
    mItemQueue: null,

    mCalendarName: null,

    /**
     * readonly attribute authToken
     *
     * The auth token returned from Google Accounts
     */
    get authToken cGS_getAuthToken() {
        return this.mAuthToken;
    },

    /**
     * readonly attribute userName
     *
     * The username for this session. To get a session with a different
     * username, use calIGoogleSessionManager.
     */
    get userName cGS_getUserName() {
        return this.mGoogleUser;
    },

    /**
     * attribute persist
     *
     * If set, the password will persist across restarts.
     */
    get persist cGS_getPersist() {
        return this.mPersistPassword;
    },
    set persist cGS_setPersist(v) {
        return this.mPersistPassword = v;
    },

    /**
     * attribute AUTF8String fullName
     *
     * The user's full name, usually retrieved from the XML <author> fields. If
     * unset, this will return the userName attribute.
     */
    get fullName cGS_getFullName() {
        return (this.mGoogleFullName ? this.mGoogleFullName :
                this.userName);
    },
    set fullName cGS_setFullName(v) {
        return this.mGoogleFullName = v;
    },

    /**
     * attribute AUTF8String password
     *
     * The password used to authenticate. It is only important to implement the
     * setter here, since the password is only used internally.
     */
    get password cGS_getPassword() {
        return this.mGooglePass;
    },
    set password cGS_setPassword(v) {
        return this.mGooglePass = v;
    },

    /**
     * invalidate
     * Resets the Auth token and password.
     */
    invalidate: function cGS_invalidate() {
        this.mAuthToken = null;
        this.mGooglePass = null;
        this.persist = false;

        passwordManagerRemove(this.mGoogleUser);
    },

    getCalendars: function cGS_getCalendars(aListener) {
        throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
    },

    /**
     * failQueue
     * Fails all requests in this session's queue. Optionally only fail requests
     * for a certain calendar
     *
     * @param aCode     Failure Code
     * @param aCalendar The calendar to fail for. Can be null.
     */
    failQueue: function cGS_failQueue(aCode, aCalendar) {
        function cGS_failQueue_failInQueue(element, index, arr) {
            if (!aCalendar || (aCalendar && element.calendar == aCalendar)) {
                element.fail(aCode, null);
                return false;

            }
            return true;
        }

        this.mItemQueue = this.mItemQueue.filter(cGS_failQueue_failInQueue);
    },

    /**
     * loginAndContinue
     * Prepares a login request, then requests via #asyncRawRequest
     *
     *
     * @param     aRequest      The request that initiated the login
     */
    loginAndContinue: function cGS_loginAndContinue(aRequest) {

        if (this.mLoggingIn) {
            LOG("loginAndContinue called while logging in");
            return;
        }
        try {
            LOG("Logging in to " + this.mGoogleUser);

            // We need to have a user and should not be logging in
            ASSERT(!this.mLoggingIn);
            ASSERT(this.mGoogleUser);

            // Check if we have a password. If not, authentication may have
            // failed.
            if (!this.mGooglePass) {
                var username= { value: this.mGoogleUser };
                var password = { value: null };
                var persist = { value: false };

                // Try getting a new password, potentially switching sesssions.
                var calendarName = (aRequest.calendar ?
                                    aRequest.calendar.googleCalendarName :
                                    this.mGoogleUser);

                if (getCalendarCredentials(calendarName,
                                           username,
                                           password,
                                           persist)) {

                    LOG("Got the pw from the calendar credentials: " +
                        calendarName);

                    // If a different username was entered, switch sessions

                    if (aRequest.calendar &&
                        username.value != this.mGoogleUser) {

                        var newSession = getGoogleSessionManager()
                                         .getSessionByUsername(username.value,
                                                               true);
                        newSession.googlePassword = password.value;
                        newSession.persist = persist.value;
                        setCalendarPref(aRequest.calendar,
                                        "googleUser",
                                        "CHAR",
                                        username.value);

                        // Set the new session for the calendar
                        aRequest.calendar.session = newSession;
                        LOG("Setting " + aRequest.calendar.name +
                            "'s Session to " + newSession.userName);

                        // Move all requests by this calendar to its new session
                        function cGS_login_moveToSession(element, index, arr) {
                            if (element.calendar == aRequest.calendar) {
                                LOG("Moving " + element.uri + " to " +
                                    newSession.userName);
                                newSession.asyncItemRequest(element);
                                return false;
                            }
                            return true;
                        }
                        this.mItemQueue = this.mItemQueue
                                          .filter(cGS_login_moveToSession);

                        // Do not complete the request here, since it has been
                        // moved. This is not an error though, so nothing is
                        // thrown.
                        return;
                    }

                    // If we arrive at this point, then the session was not
                    // changed. Just adapt the password from the dialog and
                    // continue.
                    this.mGooglePass = password.value;
                    this.persist = persist.value;
                } else {
                    LOG("Could not get any credentials for " +
                        calendarName + " (" +
                        this.mGoogleUser + ")");

                    // The User even canceled the login prompt asking for
                    // the user. This means we have to fail all requests
                    // that belong to that calendar and are in the queue. This
                    // will also include the request that initiated the login
                    // request, so that dosent need to be handled extra.
                    this.failQueue(Components.results.NS_ERROR_NOT_AVAILABLE,
                                   aRequest.calendar);

                    // Unset the session in the requesting calendar, if the user
                    // canceled the login dialog that also asks for the
                    // username, then the session is not valid. This also
                    // prevents multiple login windows.
                    if (aRequest.calendar)
                        aRequest.calendar.session = null;

                    return;
                }
            }

            // Now we should have a password
            ASSERT(this.mGooglePass);

            // Start logging in
            this.mLoggingIn = true;

            // Get Version info
            var appInfo = Components.classes["@mozilla.org/xre/app-info;1"].
                          getService(Components.interfaces.nsIXULAppInfo);
            var source = appInfo.vendor + "-" +
                         appInfo.name + "-" +
                         appInfo.version;

            // Request Login
            var request = new calGoogleRequest(this);

            request.type = request.LOGIN;
            request.extraData = aRequest;
            request.responseListener = this;

            request.setUploadData("application/x-www-form-urlencoded",
                                  "Email=" + encodeURIComponent(this.mGoogleUser) +
                                  "&Passwd=" + encodeURIComponent(this.mGooglePass) +
                                  "&accountType=HOSTED_OR_GOOGLE" +
                                  "&source=" + encodeURIComponent(source) +
                                  "&service=cl");
            this.asyncRawRequest(request);
        } catch (e) {
            // If something went wrong, reset the login state just in case
            this.mLoggingIn = false;
            LOG({action:"Error Logging In",
                 result: e.result,
                 message: e.message});

            // If something went wrong, then this.loginComplete should handle
            // the error. We don't need to take care of aRequest, since it is
            // also in this.mItemQueue.
            this.onResult({ status: e.result}, e.message);
        }
    },

    /**
     * onResult (loginComplete)
     * Callback function that is called when the login request to Google
     * Accounts has finished
     *  - Retrieves the Authentication Token
     *  - Saves the Password in the Password Manager
     *  - Processes the Item Queue
     *
     * @private
     * @param aOperation    The calIOperation that initiated the login
     * @param aData         The (String) Result of the Request
     *                      (or an Error Message)
     */
     onResult: function cGS_onResult(aOperation, aData) {
        // About mLoggingIn: this should only be set to false when either
        // something went wrong or mAuthToken is set. This avoids redundant
        // logins to Google. Hence mLoggingIn is set three times in the course
        // of this function

        if (!aData || !Components.isSuccessCode(aOperation.status)) {
            this.mLoggingIn = false;
            LOG("Login failed. Status: " + aOperation.status);

            if (aOperation.status == kGOOGLE_LOGIN_FAILED) {
                // If the login failed, then retry the login. This is not an
                // error that should trigger failing the calICalendar's request.
                // The login request's extraData contains the request object
                // that triggered the login initially
                this.loginAndContinue(aRequest.extraData);
            } else {
                LOG("Failing queue with " + aOperation.status);
                this.failQueue(aOperation.status);
            }
        } else {
            var start = aData.indexOf("Auth=");
            if (start == -1) {
                // The Auth token could not be extracted
                this.mLoggingIn = false;
                this.invalidate();

                // Retry login
                this.loginAndContinue(aRequest.extraData);
            } else {
                this.mAuthToken = aData.substring(start + 5, aData.length - 1);

                this.mLoggingIn = false;

                if (this.persist) {
                    try {
                        passwordManagerSave(this.mGoogleUser,
                                            this.mGooglePass);
                    } catch (e) {
                        // This error is non-fatal, but would constrict
                        // functionality
                        LOG("Error adding password to manager");
                    }
                }

                // Process Items that were requested while logging in
                var request;
                // Extra parentheses to avoid js strict warning.
                while ((request = this.mItemQueue.shift())) {
                    LOG("Processing Queue Item: " + request.uri);
                    request.commit(this);
                }
            }
        }
    },

    /**
     * asyncItemRequest
     * get or post an Item from or to Google using the Queue.
     *
     * @param aRequest          The Request Object. This is an instance of
     *                          calGoogleRequest
     */
    asyncItemRequest: function cGS_asyncItemRequest(aRequest) {

        if (!this.mLoggingIn && this.mAuthToken) {
            // We are not currently logging in and we have an auth token, so
            // directly try the login request
            this.asyncRawRequest(aRequest);
        } else {
            // Push the request in the queue to be executed later
            this.mItemQueue.push(aRequest);

            LOG("Adding item " + aRequest.uri + " to queue");

            // If we are logging in, then we are done since the passed request
            // will be processed when the login is complete. Otherwise start
            // logging in.
            if (!this.mLoggingIn && this.mAuthToken == null) {
                this.loginAndContinue(aRequest);
            }
        }
    },

    /**
     * asyncRawRequest
     * get or post an Item from or to Google without the Queue.
     *
     * @param aRequest          The Request Object. This is an instance of
     *                          calGoogleRequest
     */
    asyncRawRequest: function cGS_asyncRawRequest(aRequest) {
        // Request is handled by an instance of the calGoogleRequest
        // We don't need to keep track of these requests, they
        // pass to a listener or just die

        ASSERT(aRequest);
        aRequest.commit(this);
    }
};
