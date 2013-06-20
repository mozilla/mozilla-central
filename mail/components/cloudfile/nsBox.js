/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* This file implements the nsIMsgCloudFileProvider interface.
 *
 * This component handles the Box implementation of the
 * nsIMsgCloudFileProvider interface.
 */

const {classes: Cc, interfaces: Ci, utils: Cu, results: Cr} = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource:///modules/gloda/log4moz.js");
Cu.import("resource:///modules/cloudFileAccounts.js");
Cu.import("resource://gre/modules/Http.jsm");

var gServerUrl = "https://www.box.com/api/1.0/rest";
var gUploadUrl = "https://upload.box.net/api/1.0/upload/";
var gSharingUrl = "https://www.box.com/shared/";

const kApiKey = "exs8m0agj1fa5728lxvn288ymz01dnzn";

XPCOMUtils.defineLazyServiceGetter(this, "gProtocolService",
                                   "@mozilla.org/uriloader/external-protocol-service;1",
                                   "nsIExternalProtocolService");

function nsBox() {
  this.log = Log4Moz.getConfiguredLogger("BoxService");
}

nsBox.prototype = {
  /* nsISupports */
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIMsgCloudFileProvider]),

  classID: Components.ID("{c06a8707-7463-416c-8b39-e85044a4ff6e}"),

  get type() "Box",
  get displayName() "Box",
  get serviceURL() "https://www.box.com/thunderbird",
  get iconClass() "chrome://messenger/skin/icons/box-logo.png",
  get accountKey() this._accountKey,
  get lastError() this._lastErrorText,
  get settingsURL() "chrome://messenger/content/cloudfile/Box/settings.xhtml",
  get managementURL() "chrome://messenger/content/cloudfile/Box/management.xhtml",

  completionURI: "http://boxauthcallback.local/",

  _accountKey: false,
  _prefBranch: null,
  _folderId: "",
  _loggedIn: false,
  _userInfo: null,
  _file : null,
  _maxFileSize : -1,
  _fileSpaceUsed : -1,
  _totalStorage : -1,
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
  overrideUrls: function nsBox_overrideUrls(aNumUrls, aUrls) {
    gServerUrl = aUrls[0];
  },

  /**
   * Initializes an instance of this nsIMsgCloudFileProvider for an account
   * with key aAccountKey.
   *
   * @param aAccountKey the account key to initialize this
   *                    nsIMsgCloudFileProvider with.
   */
  init: function nsBox_init(aAccountKey) {
    this._accountKey = aAccountKey;
    this._prefBranch = Services.prefs.getBranch("mail.cloud_files.accounts." +
                                                aAccountKey + ".");
    this._loggedIn = this._cachedAuthToken != "";
  },

  /**
   * Private function for assigning the folder id from a cached version
   * If the folder doesn't exist, set in motion the creation
   *
   * @param aCallback called if folder is ready.
   */
  _initFolder: function nsBox__initFolder(aCallback) {
    this.log.info('_initFolder, cached folder id  = ' + this._cachedFolderId);

    let saveFolderId = function(aFolderId) {
      this.log.info('saveFolderId : ' + aFolderId);
      this._cachedFolderId = this._folderId = aFolderId;
      if (aCallback)
        aCallback();
    }.bind(this);

    let createThunderbirdFolder = function() {
      this._createFolder("Thunderbird", saveFolderId);
    }.bind(this);

    if (this._cachedFolderId == "")
      createThunderbirdFolder();
    else {
      this._folderId = this._cachedFolderId;
      if (aCallback)
        aCallback();
    }
  },

  /**
   * Private callback function passed to, and called from
   * nsBoxFileUploader.
   *
   * @param aRequestObserver a request observer for monitoring the start and
   *                         stop states of a request.
   * @param aStatus the status of the request.
   */
  _uploaderCallback: function nsBox__uploaderCallback(aRequestObserver,
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
        this.uploadFile(nextUpload.file, nextUpload.requestObserver);
      }
      catch (ex) {
        nextUpload.callback(nextUpload.requestObserver, Cr.NS_ERROR_FAILURE);
      }
    }
    else
      this._uploader = null;
  },

  /**
   * Attempt to upload a file to Box's servers.
   *
   * @param aFile an nsILocalFile for uploading.
   * @param aCallback an nsIRequestObserver for monitoring the start and
   *                  stop states of the upload procedure.
   */
  uploadFile: function nsBox_uploadFile(aFile, aCallback) {
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    this.log.info("uploading " + aFile.leafName);

    // Some ugliness here - we stash requestObserver here, because we might
    // use it again in _getUserInfo.
    this.requestObserver = aCallback;

    // if we're uploading a file, queue this request.
    if (this._uploadingFile && this._uploadingFile != aFile) {
      let uploader = new nsBoxFileUploader(this, aFile,
                                               this._uploaderCallback
                                                   .bind(this),
                                               aCallback);
      this._uploads.push(uploader);
      return;
    }
    this._file = aFile;
    this._uploadingFile = aFile;

    let finish = function() {
      this._finishUpload(aFile, aCallback);
    }.bind(this);

    let onGetUserInfoSuccess = function() {
      this._initFolder(finish);
    }.bind(this);

    let onAuthFailure = function() {
      this._urlListener.onStopRequest(null, null,
                                      Ci.nsIMsgCloudFileProvider.authErr);
    }.bind(this);

    this.log.info("Checking to see if we're logged in");
    
    if (!this._loggedIn) {
      let onLoginSuccess = function() {
        this._getUserInfo(onGetUserInfoSuccess, onAuthFailure);
      }.bind(this);

      return this.logon(onLoginSuccess, onAuthFailure, true);
    }

    if (!this._userInfo)
      return this._getUserInfo(onGetUserInfoSuccess, onAuthFailure);

    onGetUserInfoSuccess();
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
  _finishUpload: function nsBox__finishUpload(aFile, aCallback) {
    let exceedsFileLimit = Ci.nsIMsgCloudFileProvider.uploadExceedsFileLimit;
    let exceedsQuota = Ci.nsIMsgCloudFileProvider.uploadWouldExceedQuota;
    if (aFile.fileSize > this._maxFileSize)
      return aCallback.onStopRequest(null, null, exceedsFileLimit);
    if (aFile.fileSize > this.remainingFileSpace)
      return aCallback.onStopRequest(null, null, exceedsQuota);

    delete this._userInfo; // force us to update userInfo on every upload.

    if (!this._uploader) {
      this._uploader = new nsBoxFileUploader(this, aFile,
                                             this._uploaderCallback
                                                 .bind(this),
                                             aCallback);
      this._uploads.unshift(this._uploader);
    }

    this._uploadingFile = aFile;
    this._uploader.uploadFile();
  },

  /**
   * Cancels an in-progress file upload.
   *
   * @param aFile the nsILocalFile being uploaded.
   */
  cancelFileUpload: function nsBox_cancelFileUpload(aFile) {
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
   * A private function for retrieving profile information about a user.
   *
   * @param successCallback a callback fired if retrieving profile information
   *                        is successful.
   * @param failureCallback a callback fired if retrieving profile information
   *                        fails.
   */
  _getUserInfo: function nsBox__getUserInfo(successCallback, failureCallback) {
    let args = "?action=get_account_info&api_key=" + kApiKey
                + "&auth_token=" + this._cachedAuthToken;
    let requestUrl = gServerUrl + args;
    this.log.info("get_account_info requestUrl = " + requestUrl);

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

    let accountInfoSuccess = function(aResponseText, aRequest) {
      this.log.info("get_account_info request response = " + aResponseText);

      try {
        let doc = aRequest.responseXML;
        let docResponse = doc.documentElement;
        if (docResponse && docResponse.nodeName == "response") {
         let docStatus = doc.querySelector("status").firstChild.nodeValue;
         this.log.info("get_account_info status = " + docStatus);
         if (docStatus != "get_account_info_ok") {
           this.failureCallback();
           return;
         }
         this._userInfo = aResponseText;

         this._totalStorage = doc.querySelector("space_amount").firstChild.nodeValue;
         this._fileSpaceUsed = doc.querySelector("space_used").firstChild.nodeValue;
         this._maxFileSize = doc.querySelector("max_upload_size").firstChild.nodeValue;
         this.log.info("storage total = " + this._totalStorage);
         this.log.info("storage used = " + this._fileSpaceUsed);
         this.log.info("max file size = " + this._maxFileSize);
         successCallback();
        }
        else {
         failureCallback();
        }
      }
      catch(e) {
        // most likely bad XML
        this.log.error("Failed to parse account info response: " + e);
        this.log.error("Account info response: " + aResponseText);
        failureCallback();
      }
    }.bind(this);
    let accountInfoFailure = function(aException, aResponseText, aRequest) {
      this.log.info("Failed to acquire user info:" + aResponseText);
      this.log.error("user info failed, status = " + aRequest.status);
      this.log.error("response text = " + aResponseText);
      this.log.error("exception = " + aException);
      failureCallback();
    }.bind(this)

    // Request to get user info
    httpRequest(requestUrl, {
                  onLoad: accountInfoSuccess,
                  onError: accountInfoFailure,
                  method: "GET"
                });
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
  _logonAndGetUserInfo: function nsBox_logonAndGetUserInfo(aSuccessCallback,
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
   * Returns the sharing URL for some uploaded file.
   *
   * @param aFile the nsILocalFile to get the URL for.
   */
  urlForFile: function nsBox_urlForFile(aFile) {
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
  refreshUserInfo: function nsBox_refreshUserInfo(aWithUI, aCallback) {
    this.log.info("Getting User Info 1 : " + this._loggedIn);
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
   * Our Box implementation does not implement the createNewAccount
   * function defined in nsIMsgCloudFileProvider.idl.
   */
  createNewAccount: function nsBox_createNewAccount(aEmailAddress,
                                                          aPassword, aFirstName,
                                                          aLastName) {
    return Cr.NS_ERROR_NOT_IMPLEMENTED;
  },

  /**
   * Private function for creating folder on the Box website.
   *
   * @param aName name of folder
   * @param aSuccessCallback called when folder is created
   */
  _createFolder: function nsBox__createFolder(aName,
                                              aSuccessCallback) {
    this.log.info("Creating folder: " + aName);
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    let args = "?action=create_folder&api_key=" + kApiKey
               + "&auth_token=" + this._cachedAuthToken
               + "&parent_id=0&name=" + aName
               + "&share=1";
    let requestUrl = gServerUrl + args;
    this.log.info("create_folder requestUrl = " + requestUrl);

    let createSuccess = function(aResponseText, aRequest) {
      this.log.info("create_folder request response = " + aResponseText);

      try {
        let doc = aRequest.responseXML;
        let docResponse = doc.documentElement;
        if (docResponse && docResponse.nodeName == "response") {
          let docStatus = doc.querySelector("status").firstChild.nodeValue;
          if (docStatus != "create_ok" && docStatus != "s_folder_exists") {
            this._lastErrorText = "Create folder failure";
            this._lastErrorStatus = docStatus;
            return;
          }
          let folderId = doc.querySelector("folder_id").firstChild.nodeValue;
          this.log.info("folder id = " + folderId);
          aSuccessCallback(folderId);
        }
        else {
          this._lastErrorText = "Create folder failure";
          this._lastErrorStatus = "";
        }
      }
      catch(e) {
        // most likely bad XML
        this.log.error("Failed to create a new folder");
      }
    }.bind(this);
    let createFailure = function(aException, aResponseText, aRequest) {
      this.log.error("Failed to create a new folder: " + aRequest.status);
    }.bind(this);

    // Request to create the folder
    httpRequest(requestUrl, {
                  onLoad: createSuccess,
                  onError: createFailure,
                  method: "GET"
                });
  },

  /**
   * If a the user associated with this account key already has an account,
   * allows them to log in.
   *
   * @param aRequestObserver an nsIRequestObserver for monitoring the start and
   *                         stop states of the login procedure.
   */
  createExistingAccount: function nsBox_createExistingAccount(aRequestObserver) {
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
  providerUrlForError: function nsBox_providerUrlForError(aError) {
    if (aError == Ci.nsIMsgCloudFileProvider.uploadWouldExceedQuota)
      return "https://www.box.com/pricing/";
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
  get remainingFileSpace() this._totalStorage - this._fileSpaceUsed,
  get fileSpaceUsed() this._fileSpaceUsed,

  /**
   * Attempts to delete an uploaded file.
   *
   * @param aFile the nsILocalFile to delete.
   * @param aCallback an nsIRequestObserver for monitoring the start and stop
   *                  states of the delete procedure.
   */
  deleteFile: function nsBox_deleteFile(aFile, aCallback) {
    this.log.info("Deleting a file");

    if (Services.io.offline) {
      this.log.error("We're offline - we can't delete the file.");
      throw Ci.nsIMsgCloudFileProvider.offlineErr;
    }

    let uploadInfo = this._uploadInfo[aFile.path];
    if (!uploadInfo) {
      this.log.error("Could not find a record for the file to be deleted.");
      throw Cr.NS_ERROR_FAILURE;
    }

    let args = "?action=delete&api_key=" + kApiKey
                + "&auth_token=" + this._cachedAuthToken
                + "&target=file&target_id=" + uploadInfo.fileId;
    let requestUrl = gServerUrl + args;
    this.log.info("delete requestUrl = " + requestUrl);

    let deleteSuccess = function(aResponseText, aRequest) {
      this.log.info("delete request response = " + aResponseText);

      try {
        let doc = aRequest.responseXML;
        let docResponse = doc.documentElement;
        if (docResponse && docResponse.nodeName == "response") {
          let docStatus = doc.querySelector("status").firstChild.nodeValue;
          this.log.info("delete status = " + docStatus);
          if (docStatus != "s_delete_node") {
            aCallback.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
            return;
          }
          this.log.info("Delete was successful!");
          // Success!
          aCallback.onStopRequest(null, null, Cr.NS_OK);
        }
        else {
          aCallback.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
        }
      }
      catch(e) {
        // most likely bad XML
        this.log.error("Failed to parse delete response: " + e);
        this.log.error("Delete response: " + aResponseText);
        aCallback.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
      }
    }.bind(this);
    let deleteFailure = function(aException, aResponseText, aRequest) {
      this.log.error("Failed to delete file:" + aResponseText);
      aCallback.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
    }.bind(this);

    // Request to delete a file
    httpRequest(requestUrl, {
                  onLoad: deleteSuccess,
                  onError: deleteFailure,
                  method: "GET"
                });
  },

  _getUrlParameter: function nsBox_getAuthParameter(aUrl, aName)
  {
    var params = aUrl.substr(aUrl.indexOf("?") + 1);
    var pVal = "";
    params = params.split("&");
    for (var i=0; i<params.length; i++) {
      temp = params[i].split("=");
      if ( [temp[0]] == aName ) { pVal = temp[1]; }
    }
    return pVal;
  },

  _finishLogonRequest: function nsBox_finishLogonRequest() {
    if (!("_browserRequest" in this))
      return;

    this._browserRequest._active = false;
    if ("_listener" in this._browserRequest)
      this._browserRequest._listener._cleanUp();
    delete this._browserRequest;
  },

  /**
   * Attempt to log on and get the auth token for this Box account.
   *
   * @param successCallback the callback to be fired if logging on is successful
   * @param failureCallback the callback to be fired if loggong on fails
   * @aparam aWithUI a boolean for whether or not we should prompt for a password
   *                 if no auth token is currently stored.
   */
  logon: function nsBox_logon(successCallback, failureCallback, aWithUI) {
    let authToken = this._cachedAuthToken;
    if (!aWithUI && !authToken.length) {
      failureCallback();
      return;
    }

    this._browserRequest = {
      promptText : "Box",
      account: this,
      _active: true,
      iconURI : this.iconClass,
      successCallback : successCallback,
      failureCallback : failureCallback,
      cancelled: function() {
        if (!this._active)
          return;
        this.account.log.info("auth cancelled");
        this.account._finishLogonRequest();
        this.failureCallback();
      },
      loaded: function(aWindow, aWebProgress) {
        if (!this._active)
          return;

        this._listener = {
          QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                                 Ci.nsISupportsWeakReference]),
          _cleanUp: function() {
            this.webProgress.removeProgressListener(this);
            this.window.close();
            delete this.window;
          },
          _checkForRedirect: function(aURL) {
            if (!aURL.startsWith(this._parent.completionURI))
              return;

            let ticket = this._parent._getUrlParameter(aURL, "ticket");
            this._parent._cachedAuthToken = this._parent._getUrlParameter(aURL, "auth_token");
            this._parent.log.info("Box auth redirect : "
                                  + aURL
                                  + "| ticket = "
                                  + ticket
                                  + " | Auth token = "
                                  + this._parent._cachedAuthToken);

            this._parent._loggedIn = true;
            this._loggedIn = true;
            this.successCallback();
            this._parent._finishLogonRequest();
          },
          onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus) {
            const wpl = Ci.nsIWebProgressListener;
            if (aStateFlags & (wpl.STATE_START | wpl.STATE_IS_NETWORK))
              this._checkForRedirect(aRequest.name);
          },
          onLocationChange: function(aWebProgress, aRequest, aLocation) {
            this._checkForRedirect(aLocation.spec);
          },
          onProgressChange: function() {},
          onStatusChange: function() {},
          onSecurityChange: function() {},

          window: aWindow,
          webProgress: aWebProgress,
          _parent: this.account,
          successCallback : this.successCallback
        };
        aWebProgress.addProgressListener(this._listener,
                                         Ci.nsIWebProgress.NOTIFY_ALL);
      },
    };
    this.wrappedJSObject = this._browserRequest;

    Services.ww.openWindow(null,
                           "chrome://messenger/content/cloudfile/Box/auth.xul",
                           null, "chrome,centerscreen,width=1100px,height=600px", this);
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

  get _cachedFolderId() {
    let folderId = "";
    try {
      folderId = this._prefBranch.getCharPref("folderid");
    }
    catch(e) { } // pref does not exist

    return folderId;
  },

  set _cachedFolderId(aVal) {
    if (!aVal)
      aVal = "";

    this._prefBranch.setCharPref("folderid", aVal);
  },
};

function nsBoxFileUploader(aBox, aFile, aCallback,
                                 aRequestObserver) {
  this.box = aBox;
  this.log = this.box.log;
  this.log.info("new nsBoxFileUploader file = " + aFile.leafName);
  this.file = aFile;
  this.callback = aCallback;
  this.requestObserver = aRequestObserver;
}

nsBoxFileUploader.prototype = {
  box : null,
  file : null,
  callback : null,
  request : null,

  /**
   * Do the upload of the file to Box.
   */
  uploadFile: function nsBox_uploadFile() {
    this.requestObserver.onStartRequest(null, null);
    let args = this.box._cachedAuthToken + "/" + this.box._folderId + "?new_copy=1&share=1";
    let requestUrl = gUploadUrl + args;
    this.box._uploadInfo[this.file.path] = {};
    this.box._uploadInfo[this.file.path].uploadUrl = requestUrl;

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    let curDate = Date.now().toString();
    this.log.info("upload url = " + requestUrl);
    this.request = req;
    req.open("POST", requestUrl, true);
    req.onload = function() {
      this.cleanupTempFile();
      if (req.status >= 200 && req.status < 400) {
        try {
          this.log.info("upload response = " + req.responseText);
          let doc = req.responseXML;
          let uploadResponse = doc.documentElement;
          if (uploadResponse && uploadResponse.nodeName == "response") {
            let uploadStatus = doc.querySelector("status").firstChild.nodeValue;
            this.log.info("upload status = " + uploadStatus);
            if (uploadStatus != "upload_ok") {
              this.callback(this.requestObserver,
                      Ci.nsIMsgCloudFileProvider.uploadErr);
              this.box._cachedFolderId = ""; // flush the folder id for a new attempt
              return;
            }

            let file = doc.querySelector("file");
            let pn = file.getAttribute("public_name");
            this.log.info("public_name = " + pn);
            this.box._uploadInfo[this.file.path].fileId = file.getAttribute("id");
            this.box._urlsForFiles[this.file.path] = gSharingUrl + pn;
            this.callback(this.requestObserver, Cr.NS_OK);
          }
          else {
            this.callback(this.requestObserver,
                      Ci.nsIMsgCloudFileProvider.uploadErr);
          }
        } catch (ex) {
          this.log.error(ex);
          this.callback(this.requestObserver,
                      Ci.nsIMsgCloudFileProvider.uploadErr);
        }
      }
      else {
        this.callback(this.requestObserver,
                      Ci.nsIMsgCloudFileProvider.uploadErr);
      }
    }.bind(this);

    req.onerror = function () {
      this.cleanupTempFile();
      if (this.callback)
        this.callback(this.requestObserver,
                      Ci.nsIMsgCloudFileProvider.uploadErr);
    }.bind(this);

    req.setRequestHeader("Date", curDate);
    let boundary = "------" + curDate;
    let contentType = "multipart/form-data; boundary="+ boundary;
    req.setRequestHeader("Content-Type", contentType);

    let fileName = encodeURIComponent(this.file.leafName);

    let fileContents = "\r\n--" + boundary +
      "\r\nContent-Disposition: form-data; name=\"fname\"; filename=\"" +
      fileName + "\"\r\nContent-Type: application/octet-stream" +
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
      this._bufStream.init(this._fstream, 4096);
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
   * Cancels the upload request for the file associated with this Uploader.
   */
  cancel: function nsBox_cancel() {
    this.log.info("in uploader cancel");
    this.callback(this.requestObserver, Ci.nsIMsgCloudFileProvider.uploadCanceled);
    delete this.callback;
    if (this.request) {
      this.log.info("cancelling upload request");
      let req = this.request;
      if (req.channel) {
        this.log.info("cancelling upload channel");
        req.channel.cancel(Cr.NS_BINDING_ABORTED);
      }
      this.request = null;
    }
  },

  /**
   * Creates and returns a temporary file on the local file system.
   */
  getTempFile: function nsBox_getTempFile(leafName) {
    let tempfile = Services.dirsvc.get("TmpD", Ci.nsIFile);
    tempfile.append(leafName)
    tempfile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt("0666", 8));
    // do whatever you need to the created file
    return tempfile.clone()
  },

  /**
   * Cleans up any temporary files that this nsBoxFileUploader may have
   * created.
   */
  cleanupTempFile: function nsBox_cleanupTempFile() {
    if (this._bufStream)
      this._bufStream.close();
    if (this._fstream)
      this._fstream.close();
    if (this._tempFile)
      this._tempFile.remove(false);
  },
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory([nsBox]);
