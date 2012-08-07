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

var gServerUrl = "https://dpi.yousendit.com"; // Production url
// test url var gServerUrl = "https://test2-api.yousendit.com";

const kApiKey = "7spvjdt7m4kycr7jyhywrdn2";
const kAuthPath = "/dpi/v1/auth";
const kUserInfoPath = "/dpi/v2/user";
const kFolderPath = "/dpi/v1/folder/";
const kFolderFilePath = "/dpi/v1/folder/file/";
const kFolderInitUploadPath = kFolderPath + "file/initUpload";
const kFolderCommitUploadPath = kFolderPath + "file/commitUpload";
const kUrlTail = "s=4001583&cid=pm-4001583";

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
  _folderId: "",
  _requestDate: null,
  _successCallback: null,
  _request: null,
  _maxFileSize : -1,
  _fileSpaceUsed : -1,
  _availableStorage : -1,
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
   * Private function for retrieving or creating folder
   * on YouSendIt website for uploading file.
   *
   * @param aCallback called if folder is ready.
   */
  _initFolder: function nsYouSendIt__initFolder(aCallback) {
    this.log.info('_initFolder');
    
    let saveFolderId = function(aFolderId) {
      this.log.info('saveFolderId');
      this._folderId = aFolderId;
      if (aCallback)
        aCallback();
    }.bind(this);

    let createThunderbirdFolder = function(aParentFolderId) {
      this._createFolder("Mozilla Thunderbird", aParentFolderId, saveFolderId);
    }.bind(this);

    let createAppsFolder = function(aParentFolderId) {
      this._createFolder("Apps", aParentFolderId, createThunderbirdFolder);
    }.bind(this);

    let findThunderbirdFolder = function(aParentFolderId) {
      this._findFolder("Mozilla Thunderbird", aParentFolderId,
                       createThunderbirdFolder, saveFolderId);
    }.bind(this);

    let findAppsFolder = function() {
      this._findFolder("Apps", 0, createAppsFolder, findThunderbirdFolder);
    }.bind(this);

    if (this._folderId == "")
      findAppsFolder();
    else
      this._checkFolderExist(this._folderId, aCallback, findAppsFolder);
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
      try {
        this.uploadFile(nextUpload.file, nextUpload.requestObserver);
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
   * Attempt to upload a file to YouSendIt's servers.
   *
   * @param aFile an nsILocalFile for uploading.
   * @param aCallback an nsIRequestObserver for monitoring the start and
   *                  stop states of the upload procedure.
   */
  uploadFile: function nsYouSendIt_uploadFile(aFile, aCallback) {
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    this.log.info("Preparing to upload a file");

    // if we're uploading a file, queue this request.
    if (this._uploadingFile && this._uploadingFile != aFile) {
      this.log.info("Adding file to queue");
      let uploader = new nsYouSendItFileUploader(this, aFile,
                                                 this._uploaderCallback
                                                     .bind(this),
                                                 aCallback);
      this._uploads.push(uploader);
      return;
    }

    this._uploadingFile = aFile;
    this._urlListener = aCallback;

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
  _finishUpload: function nsYouSendIt__finishUpload(aFile, aCallback) {
    if (aFile.fileSize > 2147483648)
      return this._fileExceedsLimit(aCallback, '2GB', 0);
    if (aFile.fileSize > this._maxFileSize)
      return this._fileExceedsLimit(aCallback, 'Limit', 0);
    if (aFile.fileSize > this._availableStorage)
      return this._fileExceedsLimit(aCallback, 'Quota', 
                                    aFile.fileSize + this._fileSpaceUsed);

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
   * A private function called when upload exceeds file limit.
   *
   * @param aCallback the nsIRequestObserver for monitoring the start and stop
   *                  states of the upload procedure.
   */
  _fileExceedsLimit: function nsYouSendIt__fileExceedsLimit(aCallback, aType, aStorageSize) {
    let cancel = Ci.nsIMsgCloudFileProvider.uploadCanceled;

    let args = {storage: aStorageSize};
    args.wrappedJSObject = args;
    Services.ww.openWindow(null,
                           "chrome://messenger/content/cloudfile/YouSendIt/"
                           + "fileExceeds" + aType + ".xul",
                           "YouSendIt", "chrome,centerscreen,dialog,modal,resizable=yes",
                           args).focus();

    return aCallback.onStopRequest(null, null, cancel);
  },

  /**
   * Cancels an in-progress file upload.
   *
   * @param aFile the nsILocalFile being uploaded.
   */
  cancelFileUpload: function nsYouSendIt_cancelFileUpload(aFile) {
    this.log.info("in cancel upload");
    if (this._uploadingFile != null && this._uploader != null && 
        this._uploadingFile.equals(aFile)) {
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
   * A private function for dealing with stale tokens.  Attempts to refresh
   * the token without prompting for the password.
   *
   * @param aSuccessCallback called if token refresh is successful.
   * @param aFailureCallback called if token refresh fails.
   */
  _handleStaleToken: function nsYouSendIt__handleStaleToken(aSuccessCallback,
                                                            aFailureCallback) {
    this.log.info("Handling a stale token.");
    this._loggedIn = false;
    this._cachedAuthToken = "";
    if (this.getPassword(this._userName, true) != "") {
      this.log.info("Attempting to reauth with saved password");
      // We had a stored password - let's try logging in with that now.
      this.logon(aSuccessCallback, aFailureCallback,
                 false);
    } else {
      this.log.info("No saved password stored, so we can't refresh the token silently.");
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
    let args = "?email=" + this._userName + "&";

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    req.open("GET", gServerUrl + kUserInfoPath + args + kUrlTail, true);

    req.onload = function() {
      if (req.status >= 200 && req.status < 400) {
        this.log.info("request status = " + req.status +
                      " response = " + req.responseText);
        let docResponse = JSON.parse(req.responseText);
        this.log.info("user info response parsed = " + docResponse);
        if (docResponse.errorStatus)
          this.log.info("error status = " + docResponse.errorStatus.code);

        if (docResponse.errorStatus && docResponse.errorStatus.code > 200) {
          if (docResponse.errorStatus.code > 400) {
            // Our token has gone stale
            this.log.info("Our token has gone stale - requesting a new one.");

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
        let storage = docResponse.storage;
        if (storage) {
          this._fileSpaceUsed = parseInt(storage.currentUsage);
          this._availableStorage = parseInt(storage.storageQuota) - this._fileSpaceUsed;
        }
        else
          this._availableStorage = parseInt(account.availableStorage);

        this._maxFileSize = docResponse.type == "BAS" ? 52428800 : (parseInt(account.maxFileSize));
        this.log.info("available storage = " + this._availableStorage + " max file size = " + this._maxFileSize);
        successCallback();
      }
      else
        failureCallback();
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
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

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
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    let args = "?email=" + aEmailAddress + "&password=" + aPassword + "&firstname="
               + aFirstName + "&lastname=" + aLastName + "&";

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    req.open("POST", gServerUrl + kUserInfoPath + args + kUrlTail, true);

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
   * Attempt to find folder by name on YSI website.
   *
   * @param aFolderName name of folder
   * @param aParentFolderId id of folder where we are looking
   * @param aNotFoundCallback called if folder is not found
   * @param aFoundCallback called if folder is found
   */
  _findFolder: function nsYouSendIt__findFolder(aFolderName,
                                                aParentFolderId,
                                                aNotFoundCallback,
                                                aFoundCallback) {
    
    this.log.info("Find folder: " + aFolderName);
    
    let checkChildFolders = function(folders) {
      this.log.info("Looking for a child folder");
      let folderId = 0;
      let folder = folders.folder;
      for (let i in folder) {
        if (folder[i].name == aFolderName) {
          folderId = folder[i].id;
          break;
        }
      }

      if (!folderId && aNotFoundCallback)
        aNotFoundCallback(aParentFolderId);

      if (folderId && aFoundCallback)
        aFoundCallback(folderId);
    }.bind(this);

    this._checkFolderExist(aParentFolderId, checkChildFolders);
  },

  /**
   * Attempt to find folder by id on YSI website.
   *
   * @param aFolderId id of folder
   * @param aNotFoundCallback called if folder is not found
   * @param aFoundCallback called if folder is found
   */
  _checkFolderExist: function nsYouSendIt__checkFolderExist(aFolderId,
                                                            aFoundCallback,
                                                            aNotFoundCallback) {
    this.log.info('checkFolderExist');
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    let args = "?includeFiles=false&includeFolders=true&";

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    req.open("GET",
             gServerUrl + kFolderPath + aFolderId + args + kUrlTail,
             true);

    req.onload = function() {
      let docResponse = JSON.parse(req.responseText);
      if (req.status >= 200 && req.status < 400) {
        this.log.info("request status = " + req + " response = " +
                      req.responseText);
		
        if (aFoundCallback && docResponse.folders)
          aFoundCallback(docResponse.folders);
      }
      else {
        this._lastErrorText = docResponse.errorStatus.message;
        this._lastErrorStatus = docResponse.errorStatus.code;
        if (this._lastErrorStatus == 400 && this._lastErrorText == "Not Found" && aNotFoundCallback)
          aNotFoundCallback();
      }
    }.bind(this);

    req.onerror = function() {
      this.log.info("_checkFolderExist failed - status = " + req.status);
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
   * Private function for creating folder on YSI website.
   *
   * @param aName name of folder
   * @param aParent id of parent folder
   * @param aSuccessCallback called when folder is created
   */
  _createFolder: function nsYouSendIt__createFolder(aName,
                                                    aParent,
                                                    aSuccessCallback) {
    this.log.info("Create folder: " + aName);
    if (Services.io.offline)
      throw Ci.nsIMsgCloudFileProvider.offlineErr;

    let args = "?name=" + aName + "&parentId=" + aParent + "&";

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    req.open("POST", gServerUrl + kFolderPath.replace(/\/$/, '') + args + kUrlTail, true);

    req.onload = function() {
      let docResponse = JSON.parse(req.responseText);
      if (req.status >= 200 && req.status < 400) {
        this.log.info("request status = " + req + " response = " +
                      req.responseText);
		
        if (aSuccessCallback)
          aSuccessCallback(docResponse.id)
      }
      else {
        this._lastErrorText = docResponse.errorStatus.message;
        this._lastErrorStatus = docResponse.errorStatus.code;
      }
    }.bind(this);

    req.onerror = function() {
      this.log.info("createFolder failed - status = " + req.status);
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
      throw Ci.nsIMsgCloudFileProvider.offlineErr;
    }

    let uploadInfo = this._uploadInfo[aFile.path];
    if (!uploadInfo) {
      this.log.error("Could not find a record for the file to be deleted.");
      throw Cr.NS_ERROR_FAILURE;
    }

    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    let args = kFolderFilePath + uploadInfo.fileId + "?";

    req.open("DELETE", gServerUrl + args + kUrlTail, true);
    this.log.info("Sending request to: " + gServerUrl + args);

    req.onerror = function() {    
      let response = JSON.parse(req.responseText);
      this._lastErrorStatus = response.errorStatus.status;
      this._lastErrorText = response.errorStatus.message;
      this.log.error("There was a problem deleting: " + this._lastErrorText);
      aCallback.onStopRequest(null, null, Cr.NS_ERROR_FAILURE);
    }.bind(this);

    req.onload = function() {
      // Response is the URL.
      let response = req.responseText;
      this.log.info("delete response = " + response);
      let deleteInfo = JSON.parse(response);

      if (deleteInfo.errorStatus) {
        // Argh - for some reason, on deletion, the error code for a stale
        // token is 401 instead of 500.
        if (deleteInfo.errorStatus.code == 401) {
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
        this.log.error("Error code: " + deleteInfo.errorStatus.code);
        this.log.error("Error message: " + deleteInfo.errorStatus.message);
        //aCallback.onStopRequest(null, null,
        //                        Ci.nsIMsgCloudFileProvider.uploadErr);
        return;
      }

      this.log.info("Delete was successful!");
      // Success!
      aCallback.onStopRequest(null, null, Cr.NS_OK);
    }.bind(this);

    req.setRequestHeader("X-Auth-Token", this._cachedAuthToken + " ");
    req.setRequestHeader("X-Api-Key", kApiKey);
    req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    req.setRequestHeader("Accept", "application/json");
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
    let logins = Services.logins.findLogins({}, passwordURI, null, passwordURI);
    for each (let loginInfo in logins) {
      if (loginInfo.username == aUsername)
        return loginInfo.password;
    }
    if (aNoPrompt)
      return "";

    // OK, let's prompt for it.
    let win = Services.wm.getMostRecentWindow(null);

    let authPrompter = Services.ww.getNewAuthPrompter(win);
    let password = { value: "" };
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
   * Clears any saved YouSendIt passwords for this instance's account.
   */
  clearPassword: function nsYouSendIt_clearPassword() {
    let logins = Services.logins.findLogins({}, gServerUrl, null, gServerUrl);
    for each (let loginInfo in logins)
      if (loginInfo.username == this._userName)
        Services.logins.removeLogin(loginInfo);
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
    let args = "?email=" + this._userName + "&password=" + this._password + "&";
    this.log.info("Sending login information...");
    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    let curDate = Date.now().toString();

    req.open("POST", gServerUrl + kAuthPath + args + kUrlTail, true);
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
          this.clearPassword();
          this._loggedIn = false;
          this._lastErrorText = docResponse.errorStatus.message;
          this._lastErrorStatus = docResponse.errorStatus.code;
          failureCallback();
        }
      }
      else {
        this.clearPassword();
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
    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    req.open("POST", gServerUrl + kFolderInitUploadPath + "?" + kUrlTail, true);

    req.onerror = failureCallback;

    req.onload = function() {
      let response = req.responseText;
      if (req.status >= 200 && req.status < 400) {
        this._urlInfo = JSON.parse(response);
        this.youSendIt._uploadInfo[this.file.path] = this._urlInfo;
        this.log.info("in prepare to send response = " + response);
        this.log.info("file id = " + this._urlInfo.fileId);
        this.log.info("upload url = " + this._urlInfo.uploadUrl[0]);
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
    this.log.info("upload url = " + this._urlInfo.uploadUrl[0]);
    this.request = req;
    req.open("POST", this._urlInfo.uploadUrl[0] + "?" + kUrlTail, true);
    req.onload = function() {
      this.cleanupTempFile();
      if (req.status >= 200 && req.status < 400) {
        try {
          this.log.info("upload response = " + req.responseText);
          this._commitSend();
        } catch (ex) {
          this.log.error(ex);
        }
      }
      else
        this.callback(this.requestObserver,
                      Ci.nsIMsgCloudFileProvider.uploadErr);
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

    let fileContents = "--" + boundary +
      "\r\nContent-Disposition: form-data; name=\"bid\"\r\n\r\n" +
       this._urlInfo.fileId;

    let fileName = /^[\040-\176]+$/.test(this.file.leafName) 
        ? this.file.leafName 
        : encodeURIComponent(this.file.leafName);

    fileContents += "\r\n--" + boundary +
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
  cancel: function nsYSIFU_cancel() {
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
   * Once the file is uploaded, if we want to get a sharing URL back, we have
   * to send a "commit" request - which this function does.
   */
  _commitSend: function nsYSIFU__commitSend() {
    this.log.info("commit sending file " + this._urlInfo.fileId);
    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);
    let args = "?name=" + this.file.leafName +
               "&fileId=" + this._urlInfo.fileId +
               "&parentId=" + this.youSendIt._folderId + "&";

    req.open("POST", gServerUrl + kFolderCommitUploadPath + args + kUrlTail, true);

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

      let succeed = function() {
        this.callback(this.requestObserver, Cr.NS_OK);
      }.bind(this);

      let failed = function() {
        this.callback(this.requestObserver, this.file.leafName.length > 120 
                      ? Ci.nsIMsgCloudFileProvider.uploadExceedsFileNameLimit
                      : Ci.nsIMsgCloudFileProvider.uploadErr);
      }.bind(this);

      if (uploadInfo.errorStatus) {
        this.youSendIt._lastErrorText = uploadInfo.errorStatus.message;
        this.youSendIt._lastErrorStatus = uploadInfo.errorStatus.code;
        failed();
      }
      else if (uploadInfo.clickableDownloadUrl) {
        // We need a kludge here because YSI is returning URLs without the scheme...
        let url = this._ensureScheme(uploadInfo.clickableDownloadUrl);
        this.youSendIt._urlsForFiles[this.file.path] = url;
        succeed();
      }
      else
        this._findDownloadUrl(uploadInfo.id, succeed, failed);
    }.bind(this);

    req.setRequestHeader("X-Auth-Token", this.youSendIt._cachedAuthToken + " ");
    req.setRequestHeader("X-Api-Key", kApiKey);
    req.setRequestHeader("Accept", "application/json");
    req.send();
  },

  /**
   * If there's no scheme prefix for a URL, attaches an https:// prefix
   * and returns the new result.
   *
   * @param aURL to ensure a scheme with
   */
  _ensureScheme: function nsYSIFU__ensureScheme(aURL) {
    try {
      let scheme = Services.io.extractScheme(aURL);
      return aURL;
    } catch(e) {
      // If we got NS_ERROR_MALFORMED_URI back, there's no scheme here.
      if (e.result == Cr.NS_ERROR_MALFORMED_URI)
        return "https://" + aURL;
      // Otherwise, we hit something different, and should throw.
      throw e;
    }
  },

  /**
   * Attempt to find download url for file.
   *
   * @param aFileId id of file
   * @param aSuccessCallback called if url is found
   * @param aFailureCallback called if url is not found
   */
  _findDownloadUrl: function nsYSIFU__findDownloadUrl(aFileId, aSuccessCallback, aFailureCallback) {
    let req = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"]
                .createInstance(Ci.nsIXMLHttpRequest);

    req.open("GET", gServerUrl + kFolderFilePath + aFileId, true);

    req.onerror = function() {
      this.log.info("error in findDownloadUrl");
      aFailureCallback();
    }.bind(this);

    req.onload = function() {
      let response = req.responseText;
      this.log.info("findDownloadUrl response = " + response);
      let fileInfo = JSON.parse(response);

      if (fileInfo.errorStatus)
        aFailureCallback();
      else {
        // We need a kludge here because YSI is returning URLs without the scheme...
        let url = this._ensureScheme(fileInfo.clickableDownloadUrl);
        this.youSendIt._urlsForFiles[this.file.path] = url;
        aSuccessCallback();
      }
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
    let tempfile = Services.dirsvc.get("TmpD", Ci.nsIFile);
    tempfile.append(leafName)
    tempfile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, parseInt("0666", 8));
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
