/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This file implements the nsIMsgCloudFileProvider interface.
 *
 * This component handles the Dropbox implementation of the
 * nsIMsgCloudFileProvider interface.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
const Cr = Components.results;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/oauth.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource:///modules/cloudFileAccounts.js");

const kBadAccessToken = 401;
const kAuthSecretRealm = "Dropbox Auth Secret";
// According to Dropbox, the kMaxFileSize is a fixed limit.
const kMaxFileSize = 157286400;
const kUserInfoPath = "account/info";
const kDeletePath = "fileops/delete/?root=sandbox";
const kAppKey = "7xkhuze09iqkghm";
const kAppSecret = "3i5kwjkt74rkkjc";
const kSharesPath = "shares/sandbox/";
const kFilesPutPath = "files_put/sandbox/";

var gServerUrl = "https://api.dropbox.com/1/";
var gContentUrl = "https://api-content.dropbox.com/1/";
var gAuthUrl = "https://www.dropbox.com/1/";
var gLogoutUrl = "https://www.dropbox.com/logout";

function wwwFormUrlEncode(aStr) {
  return encodeURIComponent(aStr).replace(/!/g, '%21')
                                 .replace(/'/g, '%27')
                                 .replace(/\(/g, '%28')
                                 .replace(/\)/g, '%29')
                                 .replace(/\*/g, '%2A');
}


function nsDropbox() {
  this.log = Log4Moz.getConfiguredLogger("Dropbox");
}

nsDropbox.prototype = {
  /* nsISupports */
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgCloudFileProvider]),

  classID: Components.ID("{2fd8a64a-a496-4cf4-9d6b-d3f9800c6322}"),

  get type() "Dropbox",
  get displayName() "Dropbox",
  get serviceURL() "https://www.dropbox.com/",
  get iconClass() "chrome://messenger/skin/icons/dropbox.png",
  get accountKey() this._accountKey,
  get lastError() this._lastErrorText,
  get settingsURL() "chrome://messenger/content/cloudfile/Dropbox/settings.xhtml",
  get managementURL() "chrome://messenger/content/cloudfile/Dropbox/management.xhtml",

  _accountKey: false,
  _prefBranch: null,
  _loggedIn: false,
  _authToken: "",
  _userInfo: null,
  _file : null,
  _requestDate: null,
  _successCallback: null,
  _connection: null,
  _request: null,
  _uploadingFile : null,
  _uploader : null,
  _lastErrorStatus : 0,
  _lastErrorText : "",
  _maxFileSize : kMaxFileSize,
  _totalStorage: -1,
  _fileSpaceUsed : -1,
  _uploads: [],
  _urlsForFiles : {},
  _uploadInfo : {}, // upload info keyed on aFiles.

  /**
   * Initialize this instance of nsDropbox, setting the accountKey.
   *
   * @param aAccountKey the account key to initialize this provider with
   */
  init: function nsDropbox_init(aAccountKey) {
    this._accountKey = aAccountKey;
    this._prefBranch = Services.prefs.getBranch("mail.cloud_files.accounts." + 
                                                aAccountKey + ".");
  },

  /**
   * The callback passed to an nsDropboxFileUploader, which is fired when
   * nsDropboxFileUploader exits.
   *
   * @param aRequestObserver the request observer originally passed to
   *                         uploadFile for the file associated with the
   *                         nsDropboxFileUploader
   * @param aStatus the result of the upload
   */
  _uploaderCallback : function nsDropbox__uploaderCallback(aRequestObserver,
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
        nextUpload.callback(nextUpload.requestObserver, Cr.NS_ERROR_FAILURE);
      }
    }
    else
      this._uploader = null;
  },

  /** 
   * Attempts to upload a file to Dropbox.
   *
   * @param aFile the nsILocalFile to be uploaded
   * @param aCallback an nsIRequestObserver for listening for the starting
   *                  and ending states of the upload.
   */
  uploadFile: function nsDropbox_uploadFile(aFile, aCallback) {
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    this.log.info("uploading " + aFile.leafName);

    // Some ugliness here - we stash requestObserver here, because we might
    // use it again in _getUserInfo.
    this.requestObserver = aCallback;

    // if we're uploading a file, queue this request.
    if (this._uploadingFile && this._uploadingFile != aFile) {
      let uploader = new nsDropboxFileUploader(this, aFile,
                                               this._uploaderCallback
                                                   .bind(this),
                                               aCallback);
      this._uploads.push(uploader);
      return;
    }
    this._file = aFile;
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
  _finishUpload: function nsDropbox__finishUpload(aFile, aCallback) {
    let exceedsFileLimit = Ci.nsIMsgCloudFileProvider.uploadExceedsFileLimit;
    let exceedsQuota = Ci.nsIMsgCloudFileProvider.uploadWouldExceedQuota;
    if (aFile.fileSize > this._maxFileSize)
      return aCallback.onStopRequest(null, null, exceedsFileLimit);
    if (aFile.fileSize > this.remainingFileSpace)
      return aCallback.onStopRequest(null, null, exceedsQuota);

    delete this._userInfo; // force us to update userInfo on every upload.

    if (!this._uploader) {
      this._uploader = new nsDropboxFileUploader(this, aFile,
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
  cancelFileUpload: function nsDropbox_cancelFileUpload(aFile) {
    if (this._uploadingFile.equals(aFile)) {
      this._uploader.cancel();
    }
    else {
      for (let i = 0; i < this._uploads.length; i++)
        if (this._uploads[i].file.equals(aFile)) {
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
  _getUserInfo: function nsDropbox__getUserInfo(successCallback,
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

    this._connection.signAndSend(
      gServerUrl + kUserInfoPath, "", "GET", [],
      function(aResponseText, aRequest) {
        this.log.info("user info = " + aResponseText);
        this._userInfo = JSON.parse(aResponseText);
        let quota = this._userInfo.quota_info;
        this._totalStorage = quota.quota;
        this._fileSpaceUsed = quota.normal + quota.shared;
        this.log.info("storage total = " + this._totalStorage);
        this.log.info("storage used = " + this._fileSpaceUsed);
        successCallback();
      }.bind(this),
      function(aException, aResponseText, aRequest) {
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
      }.bind(this), this);
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
  _logonAndGetUserInfo: function nsDropbox_logonAndGetUserInfo(aSuccessCallback,
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
  urlForFile: function nsDropbox_urlForFile(aFile) {
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
  refreshUserInfo: function nsDropbox_refreshUserInfo(aWithUI, aCallback) {
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
   * Our Dropbox implementation does not implement the createNewAccount
   * function defined in nsIMsgCloudFileProvider.idl.
   */
  createNewAccount: function nsDropbox_createNewAccount(aEmailAddress,
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
  createExistingAccount: function nsDropbox_createExistingAccount(aRequestObserver) {
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
   * For a particular error, return a URL if Dropbox has a page for handling
   * that particular error.
   *
   * @param aError the error to get the URL for
   */
  providerUrlForError: function nsDropbox_providerUrlForError(aError) {
    if (aError == Ci.nsIMsgCloudFileProvider.uploadWouldExceedQuota)
      return "https://www.dropbox.com/plans";
    return "";
  },

  /**
   * If we don't know the limit, this will return -1.
   */
  get fileUploadSizeLimit() this._maxFileSize,
  get remainingFileSpace() this._totalStorage - this._fileSpaceUsed,
  get fileSpaceUsed() this._fileSpaceUsed,

  /**
   * Attempt to delete an upload file if we've uploaded it.
   *
   * @param aFile the file that was originall uploaded
   * @param aCallback an nsIRequestObserver for monitoring the starting and
   *                  ending states of the deletion request.
   */
  deleteFile: function nsDropbox_deleteFile(aFile, aCallback) {
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    let uploadInfo = this._uploadInfo[aFile.path];
    if (!uploadInfo)
      throw Cr.NS_ERROR_FAILURE;

    this.requestObserver = aCallback;
    let path = wwwFormUrlEncode(uploadInfo.path);
    let url = gServerUrl + kDeletePath + "&path=" + uploadInfo.path;
    this.log.info("Sending delete request to " + url);
    let oauthParams =
      [["root", "sandbox"], ["path", path]];
    this._connection.signAndSend(url, "", "POST", null,
      function(aResponseText, aRequest) {
        this.log.info("success deleting file; response = " + aResponseText);
        aCallback.onStopRequest(null, null, Cr.NS_OK);
      }.bind(this),
      function(aException, aResponseText, aRequest) {
        this.log.error("failed deleting file; response = " + aResponseText);
        aCallback.onStopRequest(null, null, Ci.nsIMsgCloudFileProvider.uploadErr);
      }.bind(this), this, null);
  },

  /**
   * This function is used by our testing framework to override the default
   * URL's that nsDropbox connects to.
   */
  overrideUrls : function nsDropbox_overrideUrls(aNumUrls, aUrls) {
    gServerUrl = aUrls[0];
    gContentUrl = aUrls[1];
    gAuthUrl = aUrls[2];
    gLogoutUrl = aUrls[3];
  },

  /**
   * logon to the dropbox account.
   *
   * @param successCallback - called if logon is successful
   * @param failureCallback - called back on error.
   * @param aWithUI if false, logon fails if it would have needed to put up UI.
   *                This is used for things like displaying account settings,
   *                where we don't want to pop up the oauth ui.
   */
  logon: function nsDropbox_logon(successCallback, failureCallback, aWithUI) {
    let authToken = this._cachedAuthToken;
    let authSecret = this._cachedAuthSecret;
    if (!aWithUI && (!authToken.length || !authSecret.length)) {
      failureCallback();
      return;
    }

    this._connection = new OAuth(this.displayName, gServerUrl, gAuthUrl,
                                 authToken, authSecret, kAppKey, kAppSecret);
    this._connection.connect(
      function () {
        this.log.info("success connecting");
        this._loggedIn = true;
        this._cachedAuthToken = this._connection.token;
        this._cachedAuthSecret = this._connection.tokenSecret;

        // Attempt to end the session we just opened to get these tokens...
        let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                    .createInstance(Ci.nsIXMLHttpRequest);
        xhr.mozBackgroundRequest = true;
        xhr.open("GET", gLogoutUrl);
        xhr.onerror = function(aProgressEvent) {
          this.log.error("Could not end authorization session!");
          this.log.error("Status was: " + aProgressEvent.target.status);
          this.log.error("Message was: " + aProgressEvent.target.statusText);
        }.bind(this);

        xhr.onload = function(aRequest) {
          if (aRequest.target.status == 200)
            this.log.info("Successfully ended authorization session.");
          else {
            this.log.error("Could not end authorization session!");
            this.log.error("Status was: " + aRequest.target.status);
            this.log.error("Message was: " + aRequest.target.statusText);
          }
        }.bind(this);

        this.log.info("Sending logout request to: " + gLogoutUrl);
        xhr.send();

        successCallback();
      }.bind(this),
      function () {
        this.log.info("failed connecting");
        failureCallback();
      }.bind(this),
      true);
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
};

function nsDropboxFileUploader(aDropbox, aFile, aCallback, aRequestObserver) {
  this.dropbox = aDropbox;
  this.log = this.dropbox.log;
  this.log.info("new nsDropboxFileUploader file = " + aFile.leafName);
  this.file = aFile;
  this.callback = aCallback;
  this.requestObserver = aRequestObserver;
}

nsDropboxFileUploader.prototype = {
  dropbox : null,
  file : null,
  callback : null,
  request : null,

  /**
   * Kicks off the upload request for the file associated with this Uploader.
   */
  uploadFile: function nsDFU_uploadFile() {
    this.requestObserver.onStartRequest(null, null);
    this.log.info("ready to upload file " + wwwFormUrlEncode(this.file.leafName));
    let url = gContentUrl + kFilesPutPath + 
              wwwFormUrlEncode(this.file.leafName) + "?overwrite=false";
    let fileContents = "";
    let fstream = Cc["@mozilla.org/network/file-input-stream;1"]
                     .createInstance(Ci.nsIFileInputStream);
    fstream.init(this.file, -1, 0, 0);
    let bufStream = Cc["@mozilla.org/network/buffered-input-stream;1"].
      createInstance(Ci.nsIBufferedInputStream);
    bufStream.init(fstream, this.file.fileSize);
    bufStream = bufStream.QueryInterface(Ci.nsIInputStream);
    let contentLength = fstream.available();
    let oauthParams =
      [["Content-Length", contentLength]];
    this.request = this.dropbox._connection.signAndSend(url, "", "PUT", bufStream,
      function(aResponseText, aRequest) {
        this.request = null;
        this.log.info("success putting file " + aResponseText);
        let putInfo = JSON.parse(aResponseText);
        this.dropbox._uploadInfo[this.file.path] = putInfo;
        this._getShareUrl(this.file, this.callback);
      }.bind(this),
      function(aException, aResponseText, aRequest) {
        this.request = null;
        this.log.info("failed putting file response = " + aResponseText);
        if (this.callback)
          this.callback(this.requestObserver,
                        Ci.nsIMsgCloudFileProvider.uploadErr);
      }.bind(this), this, oauthParams);
  },

  /**
   * Cancels the upload request for the file associated with this Uploader.
   */
  cancel: function nsDFU_cancel() {
    this.callback(this.requestObserver, Ci.nsIMsgCloudFileProvider.uploadCanceled);
    if (this.request) {
      let req = this.request;
      if (req.channel) {
        this.log.info("canceling channel upload");
        delete this.callback;
        req.channel.cancel(Cr.NS_BINDING_ABORTED);
      }
      this.request = null;
    }
  },

  /**
   * Private function that attempts to retrieve the sharing URL for the file
   * uploaded with this Uploader.
   *
   * @param aFile ...
   * @param aCallback an nsIRequestObserver for monitoring the starting and
   *                  ending states of the URL retrieval request.
   */
  _getShareUrl: function nsDFU__getShareUrl(aFile, aCallback) {
    let url = gServerUrl + kSharesPath + wwwFormUrlEncode(aFile.leafName);
    this.file = aFile;
    this.dropbox._connection.signAndSend(
      url, "", "POST", null,
      function(aResponseText, aRequest) {
        this.log.info("Getting share URL successful with response text: "
                      + aResponseText);
        let shareInfo = JSON.parse(aResponseText);
        this.dropbox._urlsForFiles[this.file.path] = shareInfo.url;
        aCallback(this.requestObserver, Cr.NS_OK);
      }.bind(this),
      function(aException, aResponseText, aRequest) {
        this.log.error("Getting share URL failed with response text: "
                       + aResponseText);
        aCallback(this.requestObserver, Cr.NS_ERROR_FAILURE);
      }.bind(this), this);
  },
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsDropbox]);
