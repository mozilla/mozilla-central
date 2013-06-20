/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This file implements the nsIMsgCloudFileProvider interface.
 *
 * This component handles the UbuntuOne implementation of the
 * nsIMsgCloudFileProvider interface.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Http.jsm");
Cu.import("resource:///modules/oauth.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource:///modules/cloudFileAccounts.js");

const kBadAccessToken = 401;
const kAuthSecretRealm = "Ubuntu One Auth Secret";
const kConsumerKeyRealm = "Ubuntu One Consumer Key";
const kConsumerSecretRealm = "Ubuntu One Consumer Secret";
const kAttachmentsVolume = "/~/Thunderbird Attachments";
const kVolumesPath = "/volumes";

var gServerUrl = "https://one.ubuntu.com/api/file_storage/v1";
var gContentUrl = "https://files.one.ubuntu.com/content";
var gSsoUrl = "https://login.ubuntu.com/api/1.0/authentications";
var gSsoPingUrl = "https://one.ubuntu.com/oauth/sso-finished-so-get-tokens/";


function encodePathForURI(aStr) {
  return encodeURIComponent(aStr).replace(/%2F/g, '/');
}


function nsUbuntuOne() {
  this.log = Log4Moz.getConfiguredLogger("UbuntuOne");
}

nsUbuntuOne.prototype = {
  /* nsISupports */
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgCloudFileProvider]),

  classID: Components.ID("{9a44742b-a7b1-4f44-919e-6f3b28902c1a}"),

  get type() "UbuntuOne",
  get displayName() "Ubuntu One",
  get serviceURL() "https://one.ubuntu.com/referrals/referee/2149434/?next=/",
  get iconClass() "chrome://messenger/skin/icons/ubuntuone.png",
  get accountKey() this._accountKey,
  get lastError() this._lastErrorText,
  get settingsURL() "chrome://messenger/content/cloudfile/UbuntuOne/settings.xhtml",
  get managementURL() "chrome://messenger/content/cloudfile/UbuntuOne/management.xhtml",

  _accountKey: false,
  _prefBranch: null,
  _emailAddress: "",
  _loggedIn: false,
  _userInfo: null,
  _connection: null,
  _uploadingFile : null,
  _uploader : null,
  _availableStorage : -1,
  _fileSpaceUsed : -1,
  _uploads: [],
  _urlsForFiles : {},
  _uploadInfo : {}, // upload info keyed on aFiles.

  /**
   * Initialize this instance of nsUbuntuOne, setting the accountKey.
   *
   * @param aAccountKey the account key to initialize this provider with
   */
  init: function nsUbuntuOne_init(aAccountKey) {
    this._accountKey = aAccountKey;
    this._prefBranch = Services.prefs.getBranch("mail.cloud_files.accounts." + 
                                                aAccountKey + ".");
    this._emailAddress = this._prefBranch.getCharPref("emailaddress")
  },

  /**
   * The callback passed to an nsUbuntuOneFileUploader, which is fired when
   * nsUbuntuOneFileUploader exits.
   *
   * @param aRequestObserver the request observer originally passed to
   *                         uploadFile for the file associated with the
   *                         nsUbuntuOneFileUploader
   * @param aStatus the result of the upload
   */
  _uploaderCallback : function nsUbuntuOne__uploaderCallback(aRequestObserver,
                                                             aStatus) {
    aRequestObserver.onStopRequest(null, null, aStatus);
    this._uploadingFile = null;
    this._uploads.shift();
    if (this._uploads.length > 0) {
      let nextUpload = this._uploads[0];
      this.log.info("chaining upload, file = " + nextUpload.file.leafName);
      this._uploadingFile = nextUpload.file;
      this._uploader = nextUpload;
      try {
        this.uploadFile(nextUpload.file, nextUpload.callback);
      }
      catch (ex) {
        // I'd like to pass ex.result, but that doesn't seem to be defined.
        nextUpload.callback(nextUpload.requestObserver, Cr.NS_ERROR_FAILURE);
      }
    }
    else
      this._uploader = null;
  },

  /** 
   * Attempts to upload a file to UbuntuOne.
   *
   * @param aFile the nsILocalFile to be uploaded
   * @param aCallback an nsIRequestObserver for listening for the starting
   *                  and ending states of the upload.
   */
  uploadFile: function nsUbuntuOne_uploadFile(aFile, aCallback) {
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    this.log.info("uploading " + aFile.leafName);

    // Some ugliness here - we stash requestObserver here, because we might
    // use it again in _getUserInfo.
    this.requestObserver = aCallback;

    // if we're uploading a file, queue this request.
    if (this._uploadingFile && !this._uploadingFile.equals(aFile)) {
      let uploader = new nsUbuntuOneFileUploader(this, aFile,
                                                 this._uploaderCallback
                                                   .bind(this),
                                                 aCallback);
      this._uploads.push(uploader);
      return;
    }
    this._uploadingFile = aFile;

    let successCallback = this._finishUpload.bind(this, aFile, aCallback);
    if (!this._loggedIn)
      return this._logonAndGetUserInfo(successCallback, null, true);
    this.log.info("getting user info");
    if (!this._userInfo)
      return this._getUserInfo(successCallback);
    successCallback();
  },

  /**
   * A private function used to ensure that we can actually upload the file
   * (we haven't exceeded file size or quota limitations), and then attempts
   * to kick-off the upload.
   *
   * @param aFile the nsILocalFile to upload
   * @param aCallback an nsIRequestObserver for monitoring the starting and
   *                  ending states of the upload.
   */
  _finishUpload: function nsUbuntuOne__finishUpload(aFile, aCallback) {
    let exceedsFileLimit = Ci.nsIMsgCloudFileProvider.uploadExceedsFileLimit;
    let exceedsQuota = Ci.nsIMsgCloudFileProvider.uploadWouldExceedQuota;
    if (aFile.fileSize > this._availableStorage)
      return aCallback.onStopRequest(null, null, exceedsQuota);

    delete this._userInfo; // force us to update userInfo on every upload.

    if (!this._uploader) {
      this._uploader = new nsUbuntuOneFileUploader(this, aFile,
                                                   this._uploaderCallback
                                                     .bind(this),
                                                   aCallback);
      this._uploads.unshift(this._uploader);
    }

    this._uploadingFile = aFile;
    this._uploader.uploadFile();
  },

  /**
   * Attempts to cancel a file upload.
   *
   * @param aFile the nsILocalFile to cancel the upload for.
   */
  cancelFileUpload: function nsUbuntuOne_cancelFileUpload(aFile) {
    this.log.info("Cancelling upload of file " + aFile.leafName);
    if (this._uploadingFile.equals(aFile)) {
      this._uploader.cancel();
    }
    else {
      for (let i = 0; i < this._uploads.length; i++)
        if (this._uploads[i].file.equals(aFile)) {
          // We bypass the cancel() method here so that
          // _uploaderCallback doesn't get called and chain to the
          // next upload.
          this._uploads[i].requestObserver.onStopRequest(
            null, null, Ci.nsIMsgCloudFileProvider.uploadCanceled);
          this._uploads.splice(i, 1);
          return;
        }
    }
  },

  /**
   * A private function used to retrieve the profile information for the
   * user account associated with the accountKey.
   *
   * @param successCallback the function called if information retrieval
   *                        is successful
   * @param failureCallback the function called if information retrieval fails
   */
  _getUserInfo: function nsUbuntuOne__getUserInfo(successCallback,
                                                  failureCallback) {
    if (!successCallback)
      successCallback = function() {
        this.requestObserver
            .onStopRequest(null, null,
                           this._loggedIn ? Cr.NS_OK : Ci.nsIMsgCloudFileProvider.authErr);
      }.bind(this);

    if (!failureCallback)
      failureCallback = function () {
        this.requestObserver
            .onStopRequest(null, null, Ci.nsIMsgCloudFileProvider.authErr);
      }.bind(this);

    let requestFailed = function(aException, aResponseText, aRequest) {
      // Treat bad token specially, and fallback to
      // going through the uploadFiles process
      // again, and getting new tokens.
      if (aRequest.status == kBadAccessToken) {
        this.log.info("got bad token");
        this._loggedIn = false;
        this._cachedAuthToken = "";
        this._cachedAuthSecret = "";
        successCallback();
        return;
      }
      this.log.error("user info failed, status = " + aRequest.status);
      this.log.error("response text = " + aResponseText);
      this.log.error("exception = " + aException);
      failureCallback();
    }.bind(this)

    this.log.info("Getting user info")
    this._connection.signAndSend(
      gServerUrl, [], "GET", "",
      function(aResponseText, aRequest) {
        this.log.info("user info = " + aResponseText);
        this._userInfo = JSON.parse(aResponseText);
        this._fileSpaceUsed = this._userInfo.used_bytes;
        this._availableStorage = this._userInfo.max_bytes - this._fileSpaceUsed;
        this.log.info("avail storage = " + this._availableStorage);

        // Ensure that the volume where we will store attachments exists.
        if (this._userInfo.user_node_paths.indexOf(kAttachmentsVolume) < 0) {
          this.log.info("Creating attachments volume");
          let volumeUrl = (gServerUrl + kVolumesPath +
                           encodePathForURI(kAttachmentsVolume));
          this._connection.signAndSend(
            volumeUrl, [], "PUT", "",
            function(aResponseText, aRequest) {
              this.log.info("Created new volume " + kAttachmentsVolume);
              successCallback();
            }.bind(this),
            requestFailed, this);
        }
        else {
          successCallback();
        }
      }.bind(this),
      requestFailed, this);
  },

  /**
   * A private function that first ensures that the user is logged in, and then
   * retrieves the user's profile information.
   *
   * @param aSuccessCallback the function called on successful information
   *                         retrieval
   * @param aFailureCallback the function called on failed information retrieval
   * @param aWithUI a boolean for whether or not we should display authorization
   *                UI if we don't have a valid token anymore, or just fail out.
   */
  _logonAndGetUserInfo: function nsUbuntuOne_logonAndGetUserInfo(aSuccessCallback,
                                                                 aFailureCallback,
                                                                 aWithUI) {
    if (!aFailureCallback)
      aFailureCallback = function () {
        this.requestObserver
            .onStopRequest(null, null, Ci.nsIMsgCloudFileProvider.authErr);
      }.bind(this);

    return this.logon(function() {
      this._getUserInfo(aSuccessCallback, aFailureCallback);
    }.bind(this), aFailureCallback, aWithUI);
  },

  /**
   * For some nsILocalFile, return the associated sharing URL.
   *
   * @param aFile the nsILocalFile to retrieve the URL for
   */
  urlForFile: function nsUbuntuOne_urlForFile(aFile) {
    return this._urlsForFiles[aFile.path];
  },

  /**
   * Updates the profile information for the account associated with the
   * account key.
   *
   * @param aWithUI a boolean for whether or not we should display authorization
   *                UI if we don't have a valid token anymore, or just fail out.
   * @param aCallback an nsIRequestObserver for observing the starting and
   *                  ending states of the request.
   */
  refreshUserInfo: function nsUbuntuOne_refreshUserInfo(aWithUI, aCallback) {
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;
    this.requestObserver = aCallback;
    aCallback.onStartRequest(null, null);
    if (!this._loggedIn)
      return this._logonAndGetUserInfo(null, null, aWithUI);
    if (!this._userInfo)
      return this._getUserInfo();
    return this._userInfo;
  },


  /**
   * Our UbuntuOne implementation does not implement the createNewAccount
   * function defined in nsIMsgCloudFileProvider.idl.
   */
  createNewAccount: function nsUbuntuOne_createNewAccount(aEmailAddress,
                                                          aPassword, aFirstName,
                                                          aLastName) {
    return Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  /**
   * If the user already has an account, we can get the user to just login
   * to it via OAuth.
   *
   * This function does not appear to be called from the BigFiles UI, and
   * might be excisable.
   */
  createExistingAccount: function nsUbuntuOne_createExistingAccount(aRequestObserver) {
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
   * If the provider doesn't have an API for creating an account, perhaps
   * there's a url we can load in a content tab that will allow the user
   * to create an account.
   */
  get createNewAccountUrl() "",

  /**
   * For a particular error, return a URL if UbuntuOne has a page for handling
   * that particular error.
   *
   * @param aError the error to get the URL for
   */
  providerUrlForError: function nsUbuntuOne_providerUrlForError(aError) {
    if (aError == Ci.nsIMsgCloudFileProvider.uploadWouldExceedQuota)
      return "https://one.ubuntu.com/referrals/referee/2149434/?next=/services/add-storage/";
    return "";
  },

  /**
   * If we don't know the limit, this will return -1.
   */
  get fileUploadSizeLimit() -1,
  get remainingFileSpace() this._availableStorage,
  get fileSpaceUsed() this._fileSpaceUsed,

  /**
   * Attempt to delete an upload file if we've uploaded it.
   *
   * @param aFile the file that was originall uploaded
   * @param aCallback an nsIRequestObserver for monitoring the starting and
   *                  ending states of the deletion request.
   */
  deleteFile: function nsUbuntuOne_deleteFile(aFile, aCallback) {
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    let uploadInfo = this._uploadInfo[aFile.path];
    if (!uploadInfo)
      throw Cr.NS_ERROR_FAILURE;

    this.requestObserver = aCallback;
    let url = gServerUrl + encodePathForURI(uploadInfo.resource_path);
    this.log.info("Sending delete request to " + url);
    this._connection.signAndSend(url, [], "DELETE", null,
      function(aResponseText, aRequest) {
        this.log.info("success deleting file; response = " + aResponseText);
        aCallback.onStopRequest(null, null, Cr.NS_OK);
      }.bind(this),
      function(aException, aResponseText, aRequest) {
        this.log.error("failed deleting file; response = " + aResponseText);
        aCallback.onStopRequest(null, null, Ci.nsIMsgCloudFileProvider.uploadErr);
      }.bind(this), this);
  },

  /**
   * This function is used by our testing framework to override the default
   * URL's that nsUbuntuOne connects to.
   */
  overrideUrls : function nsUbuntuOne_overrideUrls(aNumUrls, aUrls) {
    gServerUrl = aUrls[0];
    gContentUrl = aUrls[1];
    gSsoUrl = aUrls[2];
    gSsoPingUrl = aUrls[3];
  },

  _getPassword: function nsUbuntuOne__getPassword(aEmailAddress) {
    this.log.info("Getting password for user: " + aEmailAddress);

    // OK, let's prompt for it.
    let win = Services.wm.getMostRecentWindow(null);
    let authPrompter = Services.ww.getNewAuthPrompter(win);
    var password = { value: "" };
    let userPos = gSsoUrl.indexOf("//") + 2;
    let userNamePart = encodeURIComponent(this._emailAddress) + "@";
    let ssoUrl = (gSsoUrl.substr(0, userPos) + userNamePart +
                  gSsoUrl.substring(userPos));
    let messengerBundle = Services.strings.createBundle(
      "chrome://messenger/locale/messenger.properties");
    let promptString = messengerBundle.formatStringFromName("passwordPrompt",
                                                            [this._emailAddress,
                                                             this.displayName],
                                                            2);
    if (authPrompter.promptPassword(this.displayName, promptString, ssoUrl,
                                    authPrompter.SAVE_PASSWORD_NEVER,
                                    password))
      return password.value;

    return "";
  },

  _acquireToken: function nsUbuntuOne__acquireToken(successCallback,
                                                    failureCallback) {
    this.log.info("Acquiring a token");
    let password = this._getPassword(this._emailAddress);

    if (!password) {
      this.log.info("No password provided");
      failureCallback();
    }

    let userPos = gSsoUrl.indexOf("//") + 2;
    let credentials = "Basic " + btoa(this._emailAddress + ":" + password);
    let dnsService = Cc["@mozilla.org/network/dns-service;1"]
      .getService(Components.interfaces.nsIDNSService);
    let tokenName = "Ubuntu One @ " + dnsService.myHostName + " [thunderbird]";
    let newTokenUrl = gSsoUrl + "?ws.op=authenticate&token_name=" +
      encodeURIComponent(tokenName);

    this.log.info("Requesting Authentication token");
    httpRequest(newTokenUrl, {
        headers: [["Authorization", credentials]],
        onLoad: function(aResponseText, aRequest) {
          this.log.info("Retrieved a new token from SSO");
          let tokenInfo = JSON.parse(aResponseText);

          // We need to tell Ubuntu One to pull the token from the SSO
          // service now.
          this._connection = new OAuth(this.displayName, null, null,
                                       tokenInfo.token, tokenInfo.token_secret,
                                       tokenInfo.consumer_key,
                                       tokenInfo.consumer_secret,
                                       "PLAINTEXT");
          this._connection.signAndSend(
            gSsoPingUrl, [], "POST", "",
            function(aResponseText, aRequest) {
              this.log.info("Token transferred to Ubuntu One: " + aResponseText);
              // Now that the token has successfully been transferred,
              // save it locally.
              this._cachedAuthToken = tokenInfo.token;
              this._cachedAuthSecret = tokenInfo.token_secret;
              this._cachedConsumerKey = tokenInfo.consumer_key;
              this._cachedConsumerSecret = tokenInfo.consumer_secret;
              successCallback();
            }.bind(this),
            function(aException, aResponseText, aRequest) {
              this.log.info("Failed to transfer access token to Ubuntu One:" +
                            aResponseText);
              failureCallback();
            }.bind(this), this);
        }.bind(this),
        onError: function(aException, aResponseText, aRequest) {
          this.log.info("Failed to acquire an access token:" + aResponseText);
          failureCallback();
        }.bind(this),
        method: "GET"
      });
  },

  /**
   * logon to the Ubuntu One account.
   *
   * @param successCallback - called if logon is successful
   * @param failureCallback - called back on error.
   * @param aWithUI if false, logon fails if it would have needed to put up UI.
   *                This is used for things like displaying account settings,
   *                where we don't want to pop up the oauth ui.
   */
  logon: function nsUbuntuOne_logon(successCallback, failureCallback, aWithUI) {
    let authToken = this._cachedAuthToken;
    let authSecret = this._cachedAuthSecret;
    let consumerKey = this._cachedConsumerKey;
    let consumerSecret = this._cachedConsumerSecret;
    if (!aWithUI && (!authToken.length || !authSecret.length ||
                     !consumerKey.length || !consumerSecret.length)) {
      failureCallback();
      return;
    }

    let haveTokenCb = function() {
      // Should probably perform a verification step to ensure that
      // the token is still valid.
      this._loggedIn = true;
      successCallback();
    }.bind(this);

    if (authToken.length && authSecret.length &&
        consumerKey.length && consumerSecret.length) {
      this._connection = new OAuth(this.displayName, null, null,
                                   authToken, authSecret,
                                   consumerKey, consumerSecret,
                                   "PLAINTEXT");
      haveTokenCb();
    }
    else {
      if (!aWithUI) {
        failureCallback();
        return;
      }
      this._acquireToken(haveTokenCb, failureCallback);
    }
  },

  /**
   * Retrieves the cached auth token for this account.
   */
  get _cachedAuthToken() {
    let authToken = cloudFileAccounts.getSecretValue(this.accountKey,
                                                     cloudFileAccounts.kTokenRealm);
    if (!authToken)
      return "";

    return authToken;
  },

  /**
   * Sets the cached auth token for this account.
   *
   * @param aAuthToken the auth token to cache.
   */
  set _cachedAuthToken(aAuthToken) {
    cloudFileAccounts.setSecretValue(this.accountKey,
                                     cloudFileAccounts.kTokenRealm,
                                     aAuthToken);
  },

  /**
   * Retrieves the cached auth secret for this account.
   */
  get _cachedAuthSecret() {
    let authSecret = cloudFileAccounts.getSecretValue(this.accountKey,
                                                      kAuthSecretRealm);

    if (!authSecret)
      return "";

    return authSecret;
  },

  /**
   * Sets the cached auth secret for this account.
   *
   * @param aAuthSecret the auth secret to cache.
   */
  set _cachedAuthSecret(aAuthSecret) {
    cloudFileAccounts.setSecretValue(this.accountKey,
                                     kAuthSecretRealm,
                                     aAuthSecret);
  },

  /**
   * Retrieves the cached consumer key for this account.
   */
  get _cachedConsumerKey() {
    let consumerKey = cloudFileAccounts.getSecretValue(this.accountKey,
                                                       kConsumerKeyRealm);

    if (!consumerKey)
      return "";

    return consumerKey;
  },

  /**
   * Sets the cached consumer key for this account.
   *
   * @param aConsumerKey the consumer key to cache.
   */
  set _cachedConsumerKey(aConsumerKey) {
    cloudFileAccounts.setSecretValue(this.accountKey,
                                     kConsumerKeyRealm,
                                     aConsumerKey);
  },

  /**
   * Retrieves the cached consumer secret for this account.
   */
  get _cachedConsumerSecret() {
    let consumerSecret = cloudFileAccounts.getSecretValue(this.accountKey,
                                                          kConsumerSecretRealm);

    if (!consumerSecret)
      return "";

    return consumerSecret;
  },

  /**
   * Sets the cached consumer secret for this account.
   *
   * @param aConsumerSecret the auth secret to cache.
   */
  set _cachedConsumerSecret(aConsumerSecret) {
    cloudFileAccounts.setSecretValue(this.accountKey,
                                     kConsumerSecretRealm,
                                     aConsumerSecret);
  },

};

function nsUbuntuOneFileUploader(aUbuntuOne, aFile, aCallback,
                                 aRequestObserver) {
  this.ubuntuone = aUbuntuOne;
  this.log = this.ubuntuone.log;
  this.log.info("new nsUbuntuOneFileUploader file = " + aFile.leafName);
  this.file = aFile;
  this.callback = aCallback;
  this.requestObserver = aRequestObserver;
}

nsUbuntuOneFileUploader.prototype = {
  ubuntuone: null,
  file: null,
  callback: null,
  request: null,

  /**
   * Kicks off the upload request for the file associated with this Uploader.
   */
  uploadFile: function nsU1FU_uploadFile() {
    this.requestObserver.onStartRequest(null, null);
    // XXX: should check to see if there is another file by this name
    // in the folder.  Perhaps put attachments in date oriented
    // directories?
    let path = kAttachmentsVolume + "/" + this.file.leafName;
    this.log.info("ready to upload file " + path);
    let url = gContentUrl + encodePathForURI(path);
    let mimeService = Cc["@mozilla.org/mime;1"].getService(Ci.nsIMIMEService);
    let contentType;
    try {
      contentType = mimeService.getTypeFromFile(this.file);
    }
    catch (ex) {
      contentType = "application/octet-stream";
    }
    let headers = [["Content-Type", contentType]];
    let fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                     .createInstance(Ci.nsIFileInputStream);
    fstream.init(this.file, -1, 0, 0);
    let bufStream = Cc["@mozilla.org/network/buffered-input-stream;1"].
      createInstance(Ci.nsIBufferedInputStream);
    bufStream.init(fstream, 4096);
    bufStream = bufStream.QueryInterface(Ci.nsIInputStream);
    this.request = this.ubuntuone._connection.signAndSend(
      url, headers, "PUT", bufStream,
      function(aResponseText, aRequest) {
        this.request = null;
        this.log.info("success putting file " + aResponseText);
        let nodeInfo = JSON.parse(aResponseText);
        this._getShareUrl(nodeInfo);
      }.bind(this),
      function(aException, aResponseText, aRequest) {
        this.request = null;
        this.log.info("failed putting file response = " + aException);
        if (this.callback)
          this.callback(this.requestObserver,
                        Ci.nsIMsgCloudFileProvider.uploadErr);
      }.bind(this), this);
  },

  /**
   * Cancels the upload request for the file associated with this Uploader.
   */
  cancel: function nsU1FU_cancel() {
    this.log.info("Cancelling upload of " + this.file.leafName);
    this.callback(this.requestObserver, Ci.nsIMsgCloudFileProvider.uploadCanceled);
    this.callback = null;
    if (this.request) {
      let req = this.request;
      if (req.channel) {
        this.log.info("canceling channel upload");
        req.channel.cancel(Cr.NS_BINDING_ABORTED);
      }
      this.request = null;
    }
  },

  /**
   * Private function that attempts to retrieve the sharing URL for the file
   * uploaded with this Uploader.
   *
   * @param aNodeInfo the node info for the file on the server.
   */
  _getShareUrl: function nsU1FU__getShareUrl(aNodeInfo) {
    this.log.info("Making file " + aNodeInfo.resource_path + " public");
    let url = gServerUrl + encodePathForURI(aNodeInfo.resource_path);
    let headers = [["Content-Type", "application/json"]];
    let body = JSON.stringify({is_public: true});
    this.request = this.ubuntuone._connection.signAndSend(
      url, headers, "PUT", body,
      function(aResponseText, aRequest) {
        this.request = null;
        this.log.info("Successfully made node public with response text: "
                      + aResponseText);
        let nodeInfo = JSON.parse(aResponseText);
        this.ubuntuone._uploadInfo[this.file.path] = nodeInfo;
        this.ubuntuone._urlsForFiles[this.file.path] = nodeInfo.public_url;
        this.callback(this.requestObserver, Cr.NS_OK);
      }.bind(this),
      function(aException, aResponseText, aRequest) {
        this.request = null;
        this.log.error("Getting share URL failed: " + aException);
        if (this.callback)
          this.callback(this.requestObserver, Cr.NS_ERROR_FAILURE);
      }.bind(this), this);
  },
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsUbuntuOne]);
