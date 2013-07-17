/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "cloudfile-yousendit-helpers";

Cu.import('resource://mozmill/stdlib/httpd.js');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/cloudFileAccounts.js');

const kDefaultServerPort = 4444;
const kServerRoot = "http://localhost:" + kDefaultServerPort;
const kServerPath = "";
const kServerURL = kServerRoot + kServerPath;
const kAuthPath = "/dpi/v1/auth";
const kUserInfoPath = "/dpi/v2/user";
const kFolderPath = "/dpi/v1/folder/";
const kFolderInitUploadPath = kFolderPath + "file/initUpload";
const kFolderCommitUploadPath = kFolderPath + "file/commitUpload";
const kDeletePath = kFolderPath + "file";
const kDefaultFileUploadPath = "/uploads";
const kDownloadURLPrefix = "http://www.example.com/downloads";

const kAuthResult = {
  authToken: "someAuthToken",
  errorStatus: null,
}

const kDefaultConfig = {
  port: kDefaultServerPort
}

const kDefaultReturnHeader = {
  statusCode: 200,
  statusString: "OK",
  contentType: "text/plain",
}

const kDefaultUser = {
  key: null,
  id: null,
  type: "BAS",
  policy: null,
  version: "v3",
  password: null,
  role:null, 
  email: "john@example.com",
  firstname: "John",
  lastname: "User",
  created: null,
  account: {
    passwordProtect: "Pay-per-use",
    returnReceipt: "Pay-per-use",
    availableStorage: "2147483648",
    billingPlan: null,
    controlExpirationDate: null,
    dropboxUrl: null,
    knowledgeBase: "Yes",
    maxDownloadBWpermonth: "1073741824",
    maxFileDownloads: "100",
    maxFileSize: "104857600",
    premiumDelivery: null,
    verifyRecipientIdentity: "Included"
  },
  storage: {
    currentUsage: 1045,
    storageQuota: 2147483648
  },
  status: null,
  errorStatus: null,
};

const kDefaultFilePrepare = {
  fileId: "",
  uploadUrl: [
  ],
  status: null,
  errorStatus: null,
}

const kDefaultCommitReturn = {
  clickableDownloadUrl: "",
  errorStatus: null,
}

function installInto(module) {
  module.MockYouSendItServer = MockYouSendItServer;
  module.MockYouSendItAuthCounter = MockYouSendItAuthCounter;
  module.MockYouSendItDeleterStaleToken = MockYouSendItDeleterStaleToken;
  module.remember_ysi_credentials = remember_ysi_credentials;
}

function MockYouSendItServer() {
  this.auth = new MockYouSendItAuthSimple(this);
  this.userInfo = new MockYouSendItUserInfoSimple(this);
  this.registry = new MockYouSendItItemIdRegistry(this);
  this.committer = new MockYouSendItCommitterSimple(this);
  this.receiver = new MockYouSendItReceiverSimple(this);
  this.deleter = new MockYouSendItDeleterSimple(this);
  this.preparer = new MockYouSendItPrepareSimple(this);
}

MockYouSendItServer.prototype = {
  _server: null,

  getPreparedBackend: function MDBS_getPreparedBackend(aAccountKey) {
    let username = this.userInfo.username;
    Services.prefs.setCharPref("mail.cloud_files.accounts." + aAccountKey
                               + ".username", username);

    cloudFileAccounts.setSecretValue(aAccountKey, cloudFileAccounts.kTokenRealm, "someAuthToken");

    let yousendit = Cc["@mozilla.org/mail/yousendit;1"]
                    .createInstance(Ci.nsIMsgCloudFileProvider);

    let urls = [kServerURL];
    yousendit.overrideUrls(urls.length, urls);
    yousendit.init(aAccountKey);

    return yousendit;
  },

  init: function MDBS_init(aConfig) {

    this._config = overrideDefault(kDefaultConfig, aConfig);

    this._server = new HttpServer();
    this.auth.init(this._server);
    this.userInfo.init(this._server);
    this.registry.init(this._server);
    this.receiver.init(this._server);
    this.preparer.init(this._server);
    this.deleter.init(this._server);
    this.committer.init(this._server);

    this.userInfo.setupUser();
  },

  start: function MDBS_start() {
    this._server.start(this._config.port);
  },

  stop: function MDBS_stop(aController) {
    this.auth.shutdown();
    this.userInfo.shutdown();
    this.registry.shutdown();
    this.receiver.shutdown();
    this.preparer.shutdown();
    this.deleter.shutdown();
    this.committer.shutdown();

    let allDone = false;
    this._server.stop(function() {
      allDone = true;
    });
    aController.waitFor(function () allDone,
                        "Timed out waiting for YouSendIt server to stop!",
                        10000);
  },

  setupUser: function MDBS_wireUser(aData) {
    this.userInfo.shutdown();
    this.userInfo.init(this._server);
    this.userInfo.setupUser(aData);
  },

  /**
   * Prepare the mock server to have a file with filename aFilename be
   * uploaded.
   *
   * @param aFilename the name of the file to be uploaded.
   * @param aMSeconds an optional argument, for the amount of time the upload
   *                  should take in milliseconds.
   */
  planForUploadFile: function MDBS_planForUploadFile(aFilename, aMSeconds) {
    this.receiver.expect(aFilename, aMSeconds);
    let downloadUrl = kDownloadURLPrefix + "/" + aFilename;
    this.committer.prepareDownloadURL(aFilename, downloadUrl);
  },

  planForGetFileURL: function MDBS_planForGetShare(aFilename, aData) {
    this.committer.prepareDownloadURL(aFilename, aData.url);
  },

  planForDeleteFile: function MYSS_planForDeleteFile(aFilename) {
    this.deleter.prepareForDelete(aFilename);
  },
}

/**
 * A simple authentication handler, regardless of input, returns
 * an authorization token, and fires the cloudfile:auth observable
 * topic.
 */
function MockYouSendItAuthSimple(aYouSendIt) {
  this._server = null;
  this._auth = null;
}

MockYouSendItAuthSimple.prototype = {
  init: function(aServer) {
    this._server = aServer;
    this._auth = generateObservableRequestHandler(
        "cloudfile:auth", "", JSON.stringify(kAuthResult));

    this._server.registerPathHandler(kAuthPath, this._auth);
  },

  shutdown: function() {
    this._server.registerPathHandler(kAuthPath, null);
    this._server = null;
    this._auth = null;
  },
}

function MockYouSendItUserInfoSimple(aYouSendIt) {
  this._server = null;
  this._userInfo = null;
}

MockYouSendItUserInfoSimple.prototype = {
  init: function(aServer) {
    this._server = aServer;
  },

  setupUser: function(aData) {
    aData = overrideDefault(kDefaultUser, aData);

    this._userInfo = generateObservableRequestHandler(
        "cloudfile:auth", "", JSON.stringify(aData));
    this._server.registerPathHandler(kUserInfoPath, this._userInfo);
  },

  shutdown: function() {
    this._server.registerPathHandler(kUserInfoPath, null);
    this._server = null;
  },

  get username() {
    return kDefaultUser.email;
  },
};

function MockYouSendItItemIdRegistry(aYouSendIt) {
  this._itemIdMap = {};
  this._itemIds = [];
}

MockYouSendItItemIdRegistry.prototype = {
  init: function(aServer) {
    this._itemIdMap = {};
    this._itemIds = [];
  },

  shutdown: function() {
  },

  createItemId: function createItemId() {
    let itemId = generateUUID();
    this._itemIds.push(itemId);
    return itemId;
  },

  setMapping: function setMapping(aItemId, aFilename) {
    let oldItemId = this.lookupItemId(aFilename);
    if (oldItemId)
      delete this._itemIdMap[oldItemId]

    if (this._itemIds.indexOf(aItemId) != -1) {
      this._itemIdMap[aItemId] = aFilename;
    }
  },

  lookupFilename: function lookupFilename(aItemId) {
    return this._itemIdMap[aItemId];
  },

  hasItemId: function hasItemId(aItemId) {
    return (aItemId in this._itemIdMap);
  },

  lookupItemId: function lookupItemId(aFilename) {
    // Slow lookup
    for (let itemId in this._itemIdMap) {
      if (this._itemIdMap[itemId] == aFilename)
        return itemId;
    }
    return null;
  },
}

/**
 * A simple preparation handler for a YouSendIt mock server. Allows
 * a client to query for a unique URL to upload to.  Redirects the actual
 * uploads to the passed receiver
 */
function MockYouSendItPrepareSimple(aYouSendIt) {
  this._server = null;
  this._ysi = aYouSendIt;
}

MockYouSendItPrepareSimple.prototype = {
  init: function(aServer) {
    this._server = aServer;
    this._server.registerPathHandler(kFolderInitUploadPath,
                                     this._prepare.bind(this));
    
    this._foldersId = {
      root: 0,
      Apps: this._ysi.registry.createItemId(),
      "Mozilla Thunderbird" : this._ysi.registry.createItemId()
    };
    
    // Set up folders info
    for (let i in this._foldersId) {
      this._server.registerPathHandler(kFolderPath + this._foldersId[i],
                                       this._getFolderInfo.bind(this));
    }
  },

  shutdown: function() {
    this._server.registerPathHandler(kFolderInitUploadPath, null);
    for (let i in this._foldersId) {
      this._server.registerPathHandler(kFolderPath + this._foldersId[i],
                                       null);
    }
    this._server = null;
  },

  _getFolderInfo: function(aRequest, aResponse) {
    let folderId = aRequest.path.substring(kFolderPath.length);
    let nextFolder = folderId == (this._foldersId.root + "")
                        ? "Apps" 
                        : "Mozilla Thunderbird";
    let response = {
      folders: {
        folder: [{name: nextFolder, id: this._foldersId[nextFolder]}]
      },
      status: 200
    }
    aResponse.setStatusLine(null, 200, "OK");
    aResponse.setHeader("Content-Type", "application/json");
    aResponse.write(JSON.stringify(response));
  },

  _prepare: function(aRequest, aResponse) {
    let fileId = this._ysi.registry.createItemId();
    let uploadPath = kDefaultFileUploadPath + "/" + fileId;

    let injectedData = {
      fileId: fileId,
      uploadUrl: [
        kServerURL + uploadPath,
      ]
    }

    // Set up the path that will accept an uploaded file
    this._server.registerPathHandler(uploadPath,
                                     this._ysi.receiver.receiveUpload
                                                       .bind(this._ysi.receiver));

    // Set up the path that will accept file deletion

    let deletePath = kDeletePath + "/" + fileId;

    this._server.registerPathHandler(deletePath,
                                     this._ysi.deleter.receiveDelete
                                                      .bind(this._ysi.deleter));

    let data = overrideDefault(kDefaultFilePrepare, injectedData);
    aResponse.setStatusLine(null, 200, "OK");
    aResponse.setHeader("Content-Type", "application/json");
    aResponse.write(JSON.stringify(data));
  },

};

function MockYouSendItReceiverSimple(aYouSendIt) {
  this._server = null;
  this._ysi = aYouSendIt;
  this._expectedFiles = [];
  this._mSeconds = {};
  this._timers = [];
}

MockYouSendItReceiverSimple.prototype = {
  init: function(aServer) {
    this._server = aServer;
  },

  shutdown: function() {
    this._server = null;
    this._expectedFiles = [];
  },

  receiveUpload: function(aRequest, aResponse) {
    if (aRequest.method != "POST")
      throw new Error("Uploads should occur with a POST request");

    let formData = parseMultipartForm(aRequest);

    if (!formData)
      throw new Error("Could not parse multi-part form during upload");

    let filename = formData['filename'];
    let filenameIndex = this._expectedFiles.indexOf(filename);

    Services.obs.notifyObservers(null, "cloudfile:uploadStarted",
                                 filename);

    if (filename in this._mSeconds)
      aResponse.processAsync();

    if (filenameIndex == -1)
      throw new Error("Unexpected file upload: " + formData['filename']);

    Services.obs.notifyObservers(null, "cloudfile:uploadFile",
                                 filename);

    this._expectedFiles.splice(filenameIndex, 1);

    let itemId = formData['bid'];
    // Tell the committer how to map the uuid to the filename
    this._ysi.registry.setMapping(itemId, filename);

    // De-register this URL...
    this._server.registerPathHandler(aRequest.path, null);

    if (filename in this._mSeconds) {
      let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      let timerEvent = {
        notify: function(aTimer) {
          aResponse.finish();
        },
      }
      timer.initWithCallback(timerEvent, this._mSeconds[filename],
                             Ci.nsITimer.TYPE_ONE_SHOT);
      // This is kind of ridiculous, but it seems that we have to hold a
      // reference to this timer, or else it can get garbage collected before
      // it fires.
      this._timers.push(timer);
    }
  },

  expect: function(aFilename, aMSeconds) {
    this._expectedFiles.push(aFilename);

    if (aMSeconds)
      this._mSeconds[aFilename] = aMSeconds;
  },

  get expecting() {
    return this._expectedFiles;
  }
};

function MockYouSendItCommitterSimple(aYouSendIt) {
  this._server = null;
  this._ysi = aYouSendIt;
  this._itemIdMap = {};
  this._filenameURLMap = {};
}

MockYouSendItCommitterSimple.prototype = {
  init: function(aServer) {
    this._server = aServer;
    // Since fileId is in query, we need to register path only once.
    this._server.registerPathHandler(kFolderCommitUploadPath, 
                                     this.commit.bind(this));
  },

  shutdown: function() {
    this._server.registerPathHandler(kFolderCommitUploadPath, 
                                     null);
    this._server = null;
    this._itemIdMap = {};
    this._filenameURLMap = {};
  },

  prepareDownloadURL: function(aFilename, aURL) {
    this._filenameURLMap[aFilename] = aURL;
  },

  commit: function(aRequest, aResponse) {
    let fileId = aRequest.queryString;
    fileId = fileId.substring(fileId.indexOf("fileId=") + 7);
    fileId = fileId.substring(0, fileId.indexOf("&"));

    if (!this._ysi.registry.hasItemId(fileId)) {
      aResponse.setStatusLine(null, 500, "Bad request");
      aResponse.write("The item ID " + fileId + " did not map to an item we "
                      + "were prepared for committing");
      return;
    }

    let filename = this._ysi.registry.lookupFilename(fileId);
    let url;
    
    if (filename in this._filenameURLMap)
      url = this._filenameURLMap[filename];
    else
      url = kDownloadURLPrefix + "/" + filename;
    
    let injectedData = {
      clickableDownloadUrl: url,
    }
    let data = overrideDefault(kDefaultCommitReturn, injectedData);
    
    // Return the default share URL
    aResponse.setStatusLine(null, 200, "OK");
    aResponse.setHeader("Content-Type", "application/json");
    aResponse.write(JSON.stringify(data));
    
    Services.obs.notifyObservers(null, "cloudfile:getFileURL", filename);
  },
};

function MockYouSendItDeleterSimple(aYouSendIt) {
  this._server = null;
  this._ysi = aYouSendIt;
  this._expectDelete = [];
}

MockYouSendItDeleterSimple.prototype = {
  init: function(aServer) {
    this._server = aServer;
  },
  shutdown: function() {},

  receiveDelete: function(aRequest, aResponse) {
    if (aRequest.method != "DELETE") {
      aResponse.setStatusLine(null, 500, "Bad request");
      aResponse.write("Expected a DELETE for deleting.");
      return;
    }


    let fileId = aRequest.path.substring(kDeletePath.length + 1);

    if (!this._ysi.registry.hasItemId(fileId)) {
      aResponse.setStatusLine(null, 500, "Bad request");
      aResponse.write("The item ID " + fileId + " did not map to an item "
                      + "we were prepared for deleting");
      return;
    }

    let filename = this._ysi.registry.lookupFilename(fileId);
    let itemIndex = this._expectDelete.indexOf(filename);
    if (itemIndex == -1) {
      aResponse.setStatusLine(null, 500, "Bad request");
      aResponse.write("Not prepared to delete file with filename: "
                      + filename);
      return;
    }

    this._expectDelete.splice(itemIndex, 1);

    let response = {status: 200};
    aResponse.setStatusLine(null, 200, "OK");
    aResponse.setHeader("Content-Type", "application/json");
    aResponse.write(JSON.stringify(response));

    Services.obs.notifyObservers(null, "cloudfile:deleteFile", filename);
    this._server.registerPathHandler(aRequest.path, null);
  },
  prepareForDelete: function(aFilename) {
    this._expectDelete.push(aFilename);
  },
};

function MockYouSendItDeleterStaleToken(aYouSendIt) {
  this._server = null;
  this._ysi = aYouSendIt;
}

MockYouSendItDeleterStaleToken.prototype = {
  init: function(aServer) {
    this._server = aServer;
  },

  shutdown: function() {},

  receiveDelete: function(aRequest, aResponse) {
    let data = { errorStatus: { code: 401, message: "Invalid auth token" } };

    aResponse.setStatusLine(null, 401, "Invalid auth token");
    aResponse.setHeader("Content-Type", "application/json");
    aResponse.write(JSON.stringify(data));
  },

  prepareForDelete: function(aFilename) {},
};

function MockYouSendItAuthCounter(aYouSendIt) {
  this._server = null;
  this._ysi = aYouSendIt;
  this.count = 0;
}

MockYouSendItAuthCounter.prototype = {

  init: function(aServer) {
    this._server = aServer;
    this._server.registerPathHandler(kAuthPath, this._auth.bind(this));
  },

  _auth: function(aRequest, aResponse) {
    this.count += 1;
    aResponse.setStatusLine(null, 200, "OK");
    aResponse.setHeader("Content-Type", "application/json");
    aResponse.write(JSON.stringify(kAuthResult));
  },

  shutdown: function() {
    this._server.registerPathHandler(kAuthPath, null);
    this._server = null;
    this._auth = null;
  },
}

/**
 * Adds a username and password pair to nsILoginManager
 * for the YouSendIt provider instance to retrieve. This may
 * fail if a password already exists for aUserrname.
 *
 * @param aUsername the username to save the password for
 * @param aPassword the password to save
 */
function remember_ysi_credentials(aUsername, aPassword) {
  let loginInfo = Cc["@mozilla.org/login-manager/loginInfo;1"]
                  .createInstance(Ci.nsILoginInfo);

  loginInfo.init(kServerURL, null, kServerURL, aUsername,
                 aPassword, "", "");
  Services.logins.addLogin(loginInfo);
}

/**
 * Utility functions
 */

function generateObservableRequestHandler(aKey, aValue, aString, aOptions) {
  aOptions = overrideDefault(kDefaultReturnHeader, aOptions);

  let subjectString = Cc["@mozilla.org/supports-string;1"]
                      .createInstance(Ci.nsISupportsString);
  subjectString.data = aString;

  let func = function(aMeta, aResponse) {
    aResponse.setStatusLine(null, aOptions.statusCode,
                            aOptions.statusString);
    aResponse.setHeader("Content-Type", aOptions.contentType);
    aResponse.write(aString);
    Services.obs.notifyObservers(subjectString, aKey, aValue);
  }
  return func;
}

function overrideDefault(aDefault, aData) {
  if (aData === undefined)
    return aDefault;

  for (let param in aDefault) {
    if (param in aData)
      aDefault[param] = aData[param];
  }
  return aDefault;
}


/**
 * Large swaths of this were liberally stolen from 
 * mozilla/toolkit/crashreporter/test/browser/crashreport.sjs
 *
 */
function generateUUID() {
  let uuidGen = Cc["@mozilla.org/uuid-generator;1"]
                  .getService(Ci.nsIUUIDGenerator);
  let uuid = uuidGen.generateUUID().toString();
  return uuid.substring(1, uuid.length - 2);
  
}

function parseHeaders(data, start)
{
  let headers = {};

  while (true) {
    let done = false;
    let end = data.indexOf("\r\n", start);
    if (end == -1) {
      done = true;
      end = data.length;
    }
    let line = data.substring(start, end);
    start = end + 2;
    if (line == "")
      // empty line, we're done
      break;

    //XXX: this doesn't handle multi-line headers. do we care?
    let [name, value] = line.split(':');
    //XXX: not normalized, should probably use nsHttpHeaders or something
    headers[name] = value.trimLeft();
  }
  return [headers, start];
}

function parseMultipartForm(request)
{
  let boundary = null;
  // See if this is a multipart/form-data request, and if so, find the
  // boundary string
  if (request.hasHeader("Content-Type")) {
    let contenttype = request.getHeader("Content-Type");
    let bits = contenttype.split(";");
    if (bits[0] == "multipart/form-data") {
      for (let i = 1; i < bits.length; i++) {
        let b = bits[i].trimLeft();
        if (b.startsWith("boundary=")) {
          // grab everything after boundary=
          boundary = "--" + b.substring(9);
          break;
        }
      }
    }
  }
  if (boundary == null)
    return null;

  let body = Cc["@mozilla.org/binaryinputstream;1"]
               .createInstance(Ci.nsIBinaryInputStream);
  body.setInputStream(request.bodyInputStream);

  let avail;
  let bytes = [];
  while ((avail = body.available()) > 0)
    Array.prototype.push.apply(bytes, body.readByteArray(avail));
  let data = String.fromCharCode.apply(null, bytes);
  let formData = {};
  let done = false;
  let start = 0;
  while (true) {
    // read first line
    let end = data.indexOf("\r\n", start);
    if (end == -1) {
      done = true;
      end = data.length;
    }

    let line = data.substring(start, end);
    // look for closing boundary delimiter line
    if (line == boundary + "--") {
      break;
    }

    if (line != boundary) {
      dump("expected boundary line but didn't find it!");
      break;
    }

    // parse headers
    start = end + 2;
    let headers = null;
    [headers, start] = parseHeaders(data, start);

    // find next boundary string
    end = data.indexOf("\r\n" + boundary, start);
    if (end == -1) {
      dump("couldn't find next boundary string\n");
      break;
    }

    // read part data, stick in formData using Content-Disposition header
    let part = data.substring(start, end);
    start = end + 2;

    if ("Content-Disposition" in headers) {
      let bits = headers["Content-Disposition"].split(';');
      if (bits[0] == 'form-data') {
        for (let i = 0; i < bits.length; i++) {
          let b = bits[i].trimLeft();
          if (b.startsWith('name=')) {
            //TODO: handle non-ascii here?
            let name = b.substring(6, b.length - 1);
            //TODO: handle multiple-value properties?
            formData[name] = part;
          }
          if (b.startsWith('filename=')) {
            let filename = b.substring(10, b.length - 1);
            formData['filename'] = filename;
          }
          //TODO: handle filename= ?
          //TODO: handle multipart/mixed for multi-file uploads?
        }
      }
    }
  }
  return formData;
}

