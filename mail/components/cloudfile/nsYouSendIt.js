/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This file implements the nsIMsgCloudFileProvider interface.
 *
 * This component handles the YouSendIt implementation of the
 * nsIMsgCloudFileProvider interface.
 */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource:///modules/cloudFileAccounts.js");

// Production url: var gServerUrl = "https://dpi.yousendit.com";
var gServerUrl = "https://test2-api.yousendit.com";

const kApiKey = "9kkwmbvzschzxrermh6s4hkz";
const kAuthPath = "/dpi/v1/auth";
const kUserInfoPath = "/dpi/v1/user";
const kItemPath = "/dpi/v1/item/";
const kItemSendPath = kItemPath + "send";
const kItemCommitPath = kItemPath + "commit";

function nsYouSendIt() {
  this.log = Log4Moz.getConfiguredLogger("YouSendIt");
}

nsYouSendIt.prototype = {
  /* nsISupports */
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgCloudFileProvider]),

  classID: Components.ID("{32fd439f-9eb6-4907-ac0b-2c88eb14d98d}"),

  get type() "YouSendIt",
  get displayName() "YouSendIt",
  get serviceURL() "https://www.yousendit.com",
  get iconClass() "chrome://messenger/skin/icons/yousendit.png",
  get accountKey() this._accountKey,
  get lastError() this._lastErrorText,
  get settingsURL() "chrome://messenger/content/cloudfile/YouSendIt/settings.xhtml",
  get managementURL() "chrome://messenger/content/cloudfile/YouSendIt/management.xhtml",

  _accountKey: false,
  _prefBranch: null,
  _userName: "",
  _password: "",
  _loggedIn: false,
  _userInfo: null,
  _file : null,
  _requestDate: null,
  _successCallback: null,
  _request: null,
  _maxFileSize : -1,
  _fileSpaceUsed : -1,
  _availableStorage : -1,
  _lastErrorStatus : 0,
  _lastErrorText : "",
  _uploadingFile : null,
  _uploader : null,
  _urlsForFiles : {},
  _uploadInfo : {},
  _uploads: [],

  /**
   * Used by our testing framework to override the URLs that this component
   * communicates to.
   */
  overrideUrls: function nsYouSendIt_overrideUrls(aNumUrls, aUrls) {
    gServerUrl = aUrls[0];
  },

  /**
   * Initializes an instance of this nsIMsgCloudFileProvider for an account
   * with key aAccountKey.
   *
   * @param aAccountKey the account key to initialize this
   *                    nsIMsgCloudFileProvider with.
   */
  init: function nsYouSendIt_init(aAccountKey) {
    this._accountKey = aAccountKey;
    this._prefBranch = Services.prefs.getBranch("mail.cloud_files.accounts." +
                                                aAccountKey + ".");
    this._userName = this._prefBranch.getCharPref("username");
    this._loggedIn = this._cachedAuthToken != "";
  },

  /**
   * Private callback function passed to, and called from
   * nsYouSendItFileUploader.
   *
   * @param aRequestObserver a request observer for monitoring the start and
   *                         stop states of a request.
   * @param aStatus the status of the request.
   */
  _uploaderCallback: function nsYouSendIt__uploaderCallback(aRequestObserver,
                                                            aStatus) {
    aRequestObserver.onStopRequest(null, null, aStatus);

    this._uploadingFile = null;
    this._uploads.shift();
    if (this._uploads.length > 0) {
      let nextUpload = this._uploads[0];
      this.log.info("chaining upload, file = " + nextUpload.file.leafName);
      this._uploadingFile = nextUpload.file;
      this._uploader = nextUpload;
      this.uploadFile(nextUpload.file, nextUpload.requestObserver);
    }
    else
      this._uploader = null;
  },

  /**
   * Attempt to upload a file to YouSendIt's servers.
   *
   * @param aFile an nsILocalFile for uploading.
   * @param aCallback an nsIRequestObserver for monitoring the start and
   *                  stop states of the upload procedure.
   */
  uploadFile: function nsYouSendIt_uploadFile(aFile, aCallback) {
    if (Services.io.offline)
      return Ci.nsIMsgCloudFileProvider.offlineErr;

    this.log.info("Preparing to upload a file");

    // if we're uploading a file, queue this request.
    if (this._uploadingFile && this._uploadingFile != aFile) {
      let uploader = new nsYouSendItFileUploader(this, aFile,
                                                 this._uploaderCallback
                                                     .bind(this),
                                                 aCallback);
      this._uploads.push(uploader);
      return;
    }

    this._uploadingFile = aFile;
    this._urlListener = aCallback;

    this.log.info("Checking to see if we're logged in");

    let onGetUserInfoSuccess = function() {
      this._finishUpload(aFile, aCallback);
    }.bind(this);

    let onAuthFailure = function() {
      this._urlListener.onStopRequest(null, null,
                                      Ci.nsIMsgCloudFileProvider.authErr);
    }.bind(this);

    if (!this._loggedIn) {
      let onLoginSuccess = function() {
        this._getUserInfo(onGetUserInfoSuccess, onAuthFailure);
      }.bind(this);

      return this.logon(onLoginSuccess, onAuthFailure, true);
    }

    if (!this._userInfo)
      return this._getUserInfo(onGetUserInfoSuccess, onAuthFailure);

    this._finishUpload(aFile, aCallback);
  },

  /**
   * A private function called when we're almost ready to kick off the upload
   * for a file. First, ensures that the file size is not too large, and that
   * we won't exceed our storage quota, and then kicks off the upload.
   *
   * @param aFile the nsILocalFile to upload
   * @param aCallback the nsIRequestObserver for monitoring the start and stop
   *                  states of the upload procedure.
   */
  _finishUpload: function nsYouSendIt__finishUpload(aFile, aCallback) {
    let exceedsLimit = Ci.nsIMsgCloudFileProvider.uploadExceedsFileLimit;
    let exceedsQuota = Ci.nsIMsgCloudFileProvider.uploadWouldExceedQuota;

    if (aFile.fileSize > this._maxFileSize)
      return aCallback.onStopRequest(null, null, exceedsLimit);
    if (aFile.fileSize > this._availableStorage)
      return aCallback.onStopRequest(null, null, exceedsQuota);

    delete this._userInfo; // force us to update userInfo on every upload.

    if (!this._uploader) {
      this._uploader = new nsYouSendItFileUploader(this, aFile,
                                                   this._uploaderCallback
                                                       .bind(this),
                                                   aCallback);
      this._uploads.unshift(this._uploader);
    }

    this._uploadingFile = aFile;
    this._uploader.startUpload();
  },

  /**
   * Cancels an in-progress file upload.
   *
   * @param aFile the nsILocalFile being uploaded.
   */
  cancelFileUpload: function nsYouSendIt_cancelFileUpload(aFile) {
    if (this._uploadingFile == aFile)
      this._uploader.cancel();
    else {
      for (let i = 0; i < this._uploads.length; i++)
        if (this._uploads[i].file == aFile) {
          this._uploads.splice(i, 1);
          return;
        }
    }
  },

  /**
   * A private function for dealing with stale tokens.  Attempts to refresh
   * the token without prompting for the password.
   *
   * @param aSuccessCallback called if token refresh is successful.
   * @param aFailureCallback called if token refresh fails.
   */
  _handleStaleToken: function nsYouSendIt__handleStaleToken(aSuccessCallback,
                                                            aFailureCallback) {
    this._loggedIn = false;
    if (this.getPassword(this._userName, true) != "") {
      this.log.info("Attempting to reauth with saved password");
      // We had a stored password - let's try logging in with that now.
      this.logon(aSuccessCallback, aFailureCallback,
                 false);
    } else {
      aFailureCallback();
    }
  },

  /**
   * A private function for retrieving profile information about a user.
   *
   * @param successCallback a callback fired if retrieving profile information
   *                        is successful.
   * @param failureCallback a callback fired if retrieving profile information
   *                        fails.
   */
  _getUserInfo: function nsYouSendIt_userInfo(successCallback, failureCallback) {
    this.log.info("getting user info");
    let args = "?email=" + this._userName;

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    req.open("GET", gServerUrl + kUserInfoPath + args, true);

    req.onload = function() {
      if (req.status >= 200 && req.status < 400) {
        this.log.info("request status = " + req.status +
                      " response = " + req.responseText);
        let docResponse = JSON.parse(req.responseText);
        this.log.info("user info response parsed = " + docResponse);
        if (docResponse.errorStatus)
          this.log.info("error status = " + docResponse.errorStatus.code);

        if (docResponse.errorStatus && docResponse.errorStatus.code > 200) {
          if (docResponse.errorStatus.code == 500) {
            // Our token has gone stale

            let retryGetUserInfo = function() {
              this._getUserInfo(successCallback, failureCallback);
            }.bind(this);

            this._handleStaleToken(retryGetUserInfo, failureCallback);
            return;
          }

          failureCallback();
          return;
        }
        this._userInfo = docResponse;
        let account = docResponse.account;
        this._availableStorage = account.availableStorage;
        this._maxFileSize = account.maxFileSize;
        successCallback();
      }
      else {
        failureCallback();
      }
    }.bind(this);

    req.onerror = function() {
      this.log.info("getUserInfo failed - status = " + req.status);
      failureCallback();
    }.bind(this);
    // Add a space at the end because http logging looks for two
    // spaces in the X-Auth-Token header to avoid putting passwords
    // in the log, and crashes if there aren't two spaces.
    req.setRequestHeader("X-Auth-Token", this._cachedAuthToken + " ");
    req.setRequestHeader("X-Api-Key", kApiKey);
    req.setRequestHeader("Accept", "application/json");
    req.send();
  },

  /**
   * Returns the sharing URL for some uploaded file.
   *
   * @param aFile the nsILocalFile to get the URL for.
   */
  urlForFile: function nsYouSendIt_urlForFile(aFile) {
    return this._urlsForFiles[aFile.path];
  },

  /**
   * Attempts to refresh cached profile information for the account associated
   * with this instance's account key.
   *
   * @param aWithUI a boolean for whether or not we should prompt the user for
   *                a password if we don't have a proper token.
   * @param aListener an nsIRequestObserver for monitoring the start and stop
   *                  states of fetching profile information.
   */
  refreshUserInfo: function nsYouSendIt_refreshUserInfo(aWithUI, aListener) {
    if (Services.io.offline)
      return Ci.nsIMsgCloudFileProvider.offlineErr;

    aListener.onStartRequest(null, null);

    // Let's define some reusable callback functions...
    let onGetUserInfoSuccess = function() {
      aListener.onStopRequest(null, null, Cr.NS_OK);
    }

    let onAuthFailure = function() {
      aListener.onStopRequest(null, null,
                              Ci.nsIMsgCloudFileProvider.authErr);
    }

    // If we're not logged in, attempt to login, and then attempt to
    // get user info if logging in is successful.
    this.log.info("Checking to see if we're logged in");
    if (!this._loggedIn) {
      let onLoginSuccess = function() {
        this._getUserInfo(onGetUserInfoSuccess, onAuthFailure);
      }.bind(this);

      return this.logon(onLoginSuccess, onAuthFailure, aWithUI);
    }

    // If we're logged in, attempt to get user info.
    if (!this._userInfo)
      return this._getUserInfo(onGetUserInfoSuccess, onAuthFailure);

  },

  /**
   * Creates an account for a user.  Note that, currently, this function is
   * not being used by the UI.
   */
  createNewAccount: function nsYouSendIt_createNewAccount(aEmailAddress, aPassword,
                                                          aFirstName, aLastName,
                                                          aRequestObserver) {
    if (Services.io.offline)
      return Ci.nsIMsgCloudFileProvider.offlineErr;

    let args = "?email=" + aEmailAddress + "&password=" + aPassword + "&firstname="
               + aFirstName + "&lastname=" + aLastName;

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    req.open("POST", gServerUrl + kUserInfoPath + args, true);

    req.onload = function() {
      if (req.status >= 200 &&
          req.status < 400) {
        this.log.info("request status = " + req + " response = " +
                      req.responseText);
        aRequestObserver.onStopRequest(null, null, Cr.NS_OK);
      }
      else {
        let docResponse = JSON.parse(req.responseText);
        this._lastErrorText = docResponse.errorStatus.message;
        this._lastErrorStatus = docResponse.errorStatus.code;
        aRequestObserver.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
      }
    }.bind(this);

    req.onerror = function() {
      this.log.info("getUserInfo failed - status = " + req.status);
      aRequestObserver.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
    }.bind(this);
    // Add a space at the end because http logging looks for two
    // spaces in the X-Auth-Token header to avoid putting passwords
    // in the log, and crashes if there aren't two spaces.
    req.setRequestHeader("X-Auth-Token", this._cachedAuthToken + " ");
    req.setRequestHeader("X-Api-Key", kApiKey);
    req.setRequestHeader("Accept", "application/json");
    req.send();
  },

  /**
   * If a the user associated with this account key already has an account,
   * allows them to log in.
   *
   * @param aRequestObserver an nsIRequestObserver for monitoring the start and
   *                         stop states of the login procedure.
   */
  createExistingAccount: function nsYouSendIt_createExistingAccount(aRequestObserver) {
     // XXX: replace this with a better function
    let successCb = function(aResponseText, aRequest) {
      aRequestObserver.onStopRequest(null, this, Cr.NS_OK);
    }.bind(this);

    let failureCb = function(aResponseText, aRequest) {
      aRequestObserver.onStopRequest(null, this,
                                     Ci.nsIMsgCloudFileProvider.authErr);
    }.bind(this);

    this.logon(successCb, failureCb, true);
  },

  /**
   * Returns an appropriate provider-specific URL for dealing with a particular
   * error type.
   *
   * @param aError an error to get the URL for.
   */
  providerUrlForError: function nsYouSendIt_providerUrlForError(aError) {
    if (aError == Ci.nsIMsgCloudFileProvider.uploadExceedsFileLimit)
      return "http://www.yousendit.com";
    return "";
  },

  /**
   * If the provider doesn't have an API for creating an account, perhaps
   * there's a url we can load in a content tab that will allow the user
   * to create an account.
   */
  get createNewAccountUrl() "",

  /**
   * If we don't know the limit, this will return -1.
   */
  get fileUploadSizeLimit() this._maxFileSize,

  get remainingFileSpace() this._availableStorage,

  get fileSpaceUsed() this._fileSpaceUsed,

  /**
   * Attempts to delete an uploaded file.
   *
   * @param aFile the nsILocalFile to delete.
   * @param aCallback an nsIRequestObserver for monitoring the start and stop
   *                  states of the delete procedure.
   */
  deleteFile: function nsYouSendIt_deleteFile(aFile, aCallback) {
    this.log.info("Deleting a file");

    if (Services.io.offline) {
      this.log.error("We're offline - we can't delete the file.");
      return Ci.nsIMsgCloudFileProvider.offlineErr;
    }

    let uploadInfo = this._uploadInfo[aFile.path];
    if (!uploadInfo) {
      this.log.error("Could not find a record for the file to be deleted.");
      throw Cr.NS_ERROR_FAILURE;
    }

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    let resource = kItemPath + uploadInfo.itemId;

    req.open("DELETE", gServerUrl + resource, true);

    this.log.info("Sending request to: " + gServerUrl + resource);

    req.onerror = function() {
      this._lastErrorStatus = req.status;
      this._lastErrorText = req.responseText;
      this.log.error("There was a problem deleting: " + this._lastErrorText);
      aCallback.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
    }.bind(this);

    req.onload = function() {
      let response = req.responseText.replace(/<\?xml[^>]*\?>/, "");

      if (req.status >= 200 && req.status < 400) {
        this.log.info("Got back deletion response: " + response);
        let docResponse = new XML(response);
        this.log.info("docResponse = " + docResponse);

        if ("errorStatus" in docResponse) {
          // Argh - for some reason, on deletion, the error code for a stale
          // token is 401 instead of 500.
          if (docResponse.errorStatus.code == 401) {

            this.log.warn("Token has gone stale! Will attempt to reauth.");
            // Our token has gone stale
            let onTokenRefresh = function() {
              this.deleteFile(aFile, aCallback);
            }.bind(this);

            let onTokenRefreshFailure = function() {
              aCallback.onStopRequest(null, null,
                                      Ci.nsIMsgCloudFileProvider.authErr);
            }
            this._handleStaleToken(onTokenRefresh, onTokenRefreshFailure);
            return;
          }

          this.log.error("Server has returned a failure on our delete request.");
          this.log.error("Error code: " + docResponse.errorStatus.code);
          this.log.error("Error message: " + docResponse.errorStatus.message);
          aCallback.onStopRequest(null, null,
                                  Ci.nsIMsgCloudFileProvider.uploadErr);
          return;
        }

        this.log.info("Delete was successful!");
        // Success!
        aCallback.onStopRequest(null, null, Cr.NS_OK);
      }
      else {
        this._lastErrorText = response;
        this.log.error("Delete was not successful: " + this._lastErrorText);
        this._lastErrorStatus = req.status;
        aCallback.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
      }
    }.bind(this);

    this.log.info("Sending delete request...");
    req.setRequestHeader("X-Auth-Token", this._cachedAuthToken + " ");
    req.setRequestHeader("X-Api-Key", kApiKey);
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.send();
  },

  /**
   * Returns the saved password for this account if one exists, or prompts
   * the user for a password. Returns the empty string on failure.
   *
   * @param aUsername the username associated with the account / password.
   * @param aNoPrompt a boolean for whether or not we should suppress
   *                  the password prompt if no password exists.  If so,
   *                  returns the empty string if no password exists.
   */
  getPassword: function nsYouSendIt_getPassword(aUsername, aNoPrompt) {
    this.log.info("Getting password for user: " + aUsername);

    if (aNoPrompt)
      this.log.info("Suppressing password prompt");

    let passwordURI = gServerUrl;
    let loginManager = Cc["@mozilla.org/login-manager;1"].getService(Ci.nsILoginManager);
    let logins = loginManager.findLogins({}, passwordURI, null, passwordURI);
    for each (let loginInfo in logins) {
      if (loginInfo.username == aUsername)
        return loginInfo.password;
    }
    if (aNoPrompt)
      return "";

    // OK, let's prompt for it.
    let win = Services.wm.getMostRecentWindow("msgcompose");

    let authPrompter = Services.ww.getNewAuthPrompter(win);
    var password = { value: "" };
    // Use the service name in the prompt text
    let serverUrl = gServerUrl;
    let userPos = gServerUrl.indexOf("//") + 2;
    let userNamePart = encodeURIComponent(this._userName) + '@';
    serverUrl = gServerUrl.substr(0, userPos) + userNamePart + gServerUrl.substr(userPos);
    let messengerBundle = Services.strings.createBundle(
      "chrome://messenger/locale/messenger.properties");
    let promptString = messengerBundle.formatStringFromName("passwordPrompt",
                                                            [this._userName,
                                                             this.displayName],
                                                            2);

    if (authPrompter.promptPassword(this.displayName, promptString, serverUrl,
                                    authPrompter.SAVE_PASSWORD_PERMANENTLY,
                                    password))
      return password.value;

    return "";
  },

  /**
   * Attempt to log on and get the auth token for this YouSendIt account.
   *
   * @param successCallback the callback to be fired if logging on is successful
   * @param failureCallback the callback to be fired if loggong on fails
   * @aparam aWithUI a boolean for whether or not we should prompt for a password
   *                 if no auth token is currently stored.
   */
  logon: function nsYouSendIt_login(successCallback, failureCallback, aWithUI) {
    this.log.info("Logging in, aWithUI = " + aWithUI);
    if (this._password == undefined || !this._password)
      this._password = this.getPassword(this._userName, !aWithUI);
    let args = "?email=" + this._userName + "&password=" + this._password;
    this.log.info("Sending login information...");
    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    let curDate = Date.now().toString();

    req.open("POST", gServerUrl + kAuthPath + args, true);
    req.onerror = function() {
      this.log.info("logon failure");
      failureCallback();
    }.bind(this);

    req.onload = function() {
      if (req.status >= 200 && req.status < 400) {
        this.log.info("auth token response = " + req.responseText);
        let docResponse = JSON.parse(req.responseText);
        this.log.info("login response parsed = " + docResponse);
        this._cachedAuthToken = docResponse.authToken;
        this.log.info("authToken = " + this._cachedAuthToken);
        if (this._cachedAuthToken) {
          this._loggedIn = true;
          successCallback();
        }
        else {
          this._loggedIn = false;
          this._lastErrorText = docResponse.errorStatus.message;
          this._lastErrorStatus = docResponse.errorStatus.code;
          failureCallback();
        }
      }
      else {
        failureCallback();
      }
    }.bind(this);
    req.setRequestHeader("X-Api-Key", kApiKey);
    req.setRequestHeader("Date", curDate);
    req.setRequestHeader("Accept", "application/json");
    req.send();
    this.log.info("Login information sent!");
  },

  get _cachedAuthToken() {
    let authToken = cloudFileAccounts.getSecretValue(this.accountKey,
                                                     cloudFileAccounts.kTokenRealm);

    if (!authToken)
      return "";

    return authToken;
  },

  set _cachedAuthToken(aVal) {
    if (!aVal)
      aVal = "";

    cloudFileAccounts.setSecretValue(this.accountKey,
                                     cloudFileAccounts.kTokenRealm,
                                     aVal);
  },
};

function nsYouSendItFileUploader(aYouSendIt, aFile, aCallback,
                                 aRequestObserver) {
  this.youSendIt = aYouSendIt;
  this.log = this.youSendIt.log;
  this.log.info("new nsYouSendItFileUploader file = " + aFile.leafName);
  this.file = aFile;
  this.callback = aCallback;
  this.requestObserver = aRequestObserver;
}

nsYouSendItFileUploader.prototype = {
  youSendIt : null,
  file : null,
  callback : null,
  _request : null,

  /**
   * Kicks off the upload procedure for this uploader.
   */
  startUpload: function nsYSIFU_startUpload() {
    let curDate = Date.now().toString();
    this.requestObserver.onStartRequest(null, null);

    let onSuccess = function() {
      this._uploadFile();
    }.bind(this);

    let onFailure = function() {
      this.callback(this.requestObserver, Ci.nsIMsgCloudFileProvider.uploadErr);
    }.bind(this);

    return this._prepareToSend(onSuccess, onFailure);
  },

  /**
   * Communicates with YSI to get the URL that we will send the upload
   * request to.
   *
   * @param successCallback the callback fired if getting the URL is successful
   * @param failureCallback the callback fired if getting the URL fails
   */
  _prepareToSend: function nsYSIFU__prepareToSend(successCallback,
                                                  failureCallback) {
    let args = "?email=" + this.youSendIt._userName + "&recipients=" +
               encodeURIComponent(this.youSendIt._userName) +
               "&secureUrl=true";

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    req.open("POST", gServerUrl + kItemSendPath + args, true);

    req.onerror = failureCallback;

    req.onload = function() {
      let response = req.responseText;
      if (req.status >= 200 && req.status < 400) {
        this._urlInfo = JSON.parse(response);
        this.youSendIt._uploadInfo[this.file.path] = this._urlInfo;
        this.log.info("in prepare to send response = " + response);
        this.log.info("urlInfo = " + this._urlInfo);
        this.log.info("upload url = " + this._urlInfo.uploadUrl);
        successCallback();
      }
      else {
        this.log.error("Preparing to send failed!");
        this.log.error("Response was: " + response);
        this.youSendIt._lastErrorText = req.responseText;
        this.youSendIt._lastErrorStatus = req.status;
        failureCallback();
      }
    }.bind(this);

    // Add a space at the end because http logging looks for two
    // spaces in the X-Auth-Token header to avoid putting passwords
    // in the log, and crashes if there aren't two spaces.
    req.setRequestHeader("X-Auth-Token", this.youSendIt._cachedAuthToken + " ");
    req.setRequestHeader("X-Api-Key", kApiKey);
    req.setRequestHeader("Accept", "application/json");
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    this.log.info("Sending prepare request with args: " + args);
    req.send();
  },

  /**
   * Once we've got the URL to upload the file to, this function actually does
   * the upload of the file to YouSendIt.
   */
  _uploadFile: function nsYSIFU__uploadFile() {
    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    let curDate = Date.now().toString();
    this.log.info("upload url = " + this._urlInfo.uploadUrl);

    req.open("POST", this._urlInfo.uploadUrl, true);
    req.onload = function() {
      this.cleanupTempFile();
      if (req.status >= 200 && req.status < 400) {
        try {
          let response = req.responseText.replace(/<\?xml[^>]*\?>/, "");
          this.log.info("upload response = " + response);
          let docResponse = new XML(response);
          this.log.info("docResponse = " + docResponse);
          this._uploadResponse = docResponse;
          let ysiError = docResponse['ysi-error'];
          let uploadStatus = docResponse['upload-status'];
          this.log.info("upload status = " + uploadStatus);
          this.log.info("ysi error = " + ysiError);
          let errorCode = docResponse['error-code'];
          this.log.info("error code = " + errorCode);
          this._commitSend();
        } catch (ex) {
          this.log.error(ex);
        }
      }
      else {
        this.callback(this.requestObserver,
                      Ci.nsIMsgCloudFileProvider.uploadErr);
      }
    }.bind(this);

    req.onerror = function () {
      this.cleanupTempFile();
      this.callback(this.requestObserver,
                    Ci.nsIMsgCloudFileProvider.uploadErr);
    }.bind(this);

    req.setRequestHeader("Date", curDate);
    let boundary = "------" + curDate;
    let contentType = "multipart/form-data; boundary="+ boundary;
    req.setRequestHeader("Content-Type", contentType);

    let fileContents = "--" + boundary +
      "\r\nContent-Disposition: form-data; name=\"bid\"\r\n\r\n" +
       this._urlInfo.itemId;

    fileContents += "\r\n--" + boundary +
      "\r\nContent-Disposition: form-data; name=\"fname\"; filename=\"" +
      this.file.leafName + "\"\r\nContent-Type: application/octet-stream" +
      "\r\n\r\n";

    // Since js doesn't like binary data in strings, we're going to create
    // a temp file consisting of the message preamble, the file contents, and
    // the post script, and pass a stream based on that file to
    // nsIXMLHttpRequest.send().

    try {
      this._tempFile = this.getTempFile(this.file.leafName);
      let ostream = Cc["@mozilla.org/network/file-output-stream;1"]
                     .createInstance(Ci.nsIFileOutputStream);
      ostream.init(this._tempFile, -1, -1, 0);
      ostream.write(fileContents, fileContents.length);

      this._fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                       .createInstance(Ci.nsIFileInputStream);
      let sstream = Cc["@mozilla.org/scriptableinputstream;1"]
                       .createInstance(Ci.nsIScriptableInputStream);
      this._fstream.init(this.file, -1, 0, 0);
      sstream.init(this._fstream);

      // This blocks the UI which is less than ideal. But it's a local
      // file operations so probably not the end of the world.
      while (sstream.available() > 0) {
        let bytes = sstream.readBytes(sstream.available());
        ostream.write(bytes, bytes.length);
      }

      fileContents = "\r\n--" + boundary + "--\r\n";
      ostream.write(fileContents, fileContents.length);

      ostream.close();
      this._fstream.close();
      sstream.close();

      // defeat fstat caching
      this._tempFile = this._tempFile.clone();
      this._fstream.init(this._tempFile, -1, 0, 0);
      this._fstream.close();
      // I don't trust re-using the old fstream.
      this._fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                     .createInstance(Ci.nsIFileInputStream);
      this._fstream.init(this._tempFile, -1, 0, 0);
      this._bufStream = Cc["@mozilla.org/network/buffered-input-stream;1"]
                        .createInstance(Ci.nsIBufferedInputStream);
      this._bufStream.init(this._fstream, this._tempFile.fileSize);
      // nsIXMLHttpRequest's nsIVariant handling requires that we QI
      // to nsIInputStream.
      req.send(this._bufStream.QueryInterface(Ci.nsIInputStream));
    } catch (ex) {
      this.cleanupTempFile();
      this.log.error(ex);
      throw ex;
    }
  },

  /**
   * Once the file is uploaded, if we want to get a sharing URL back, we have
   * to send a "commit" request - which this function does.
   */
  _commitSend: function nsYSIFU__commitSend() {
    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    let resource = kItemCommitPath + "/" + this._urlInfo.itemId;
    // Not quite sure how we're going to not have expiration.
    let args = "?sendEmailNotifications=false";  // &expiration=4000000
    let curDate = Date.now().toString();

    this.log.info("in commit send resource = " + resource);

    req.open("POST", gServerUrl + resource + args, true);

    req.onerror = function() {
      this.log.info("error in commit send");
      this.callback(this.requestObserver,
                    Ci.nsIMsgCloudFileProvider.uploadErr);
    }.bind(this);

    req.onload = function() {
      // Response is the URL.
      let response = req.responseText;
      this.log.info("commit response = " + response);
      let uploadInfo = JSON.parse(response);

      if (uploadInfo.downloadUrl != null) {
        this.youSendIt._urlsForFiles[this.file.path] = uploadInfo.downloadUrl;
        // Success!
        this.callback(this.requestObserver, Cr.NS_OK);
        return;
      }
      this.youSendIt._lastErrorText = uploadInfo.errorStatus.message;
      this.youSendIt._lastErrorStatus = uploadInfo.errorStatus.code;
      this.callback(this.requestObserver, Ci.nsIMsgCloudFileProvider.uploadErr);
    }.bind(this);

    req.setRequestHeader("X-Auth-Token", this.youSendIt._cachedAuthToken + " ");
    req.setRequestHeader("X-Api-Key", kApiKey);
    req.setRequestHeader("Accept", "application/json");
    req.send();
  },

  /**
   * Creates and returns a temporary file on the local file system.
   */
  getTempFile: function nsYSIFU_getTempFile(leafName) {
    let tempfile = Cc["@mozilla.org/file/directory_service;1"]
      .getService(Ci.nsIProperties).get("TmpD", Ci.nsIFile);
    tempfile.append(leafName)
    tempfile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
    // do whatever you need to the created file
    return tempfile.clone()
  },

  /**
   * Cleans up any temporary files that this nsYouSendItFileUploader may have
   * created.
   */
  cleanupTempFile: function nsYSIFU_cleanupTempFile() {
    if (this._bufStream)
      this._bufStream.close();
    if (this._fstream)
      this._fstream.close();
    if (this._tempFile)
      this._tempFile.remove(false);
  },
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsYouSendIt]);
