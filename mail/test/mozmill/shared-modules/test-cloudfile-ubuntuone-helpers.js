/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "cloudfile-ubuntuone-helpers";

Cu.import('resource://mozmill/stdlib/httpd.js');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource:///modules/cloudFileAccounts.js');

const kDefaultServerPort = 4444;
const kServerRoot = "http://localhost:" + kDefaultServerPort;
const kServerPath = "/server";
const kContentPath = "/content";
const kSsoPath = "/sso/authentications";
const kSsoPingPath = "/sso-ping/";
const kServerURL = kServerRoot + kServerPath;
const kContentURL = kServerRoot + kContentPath;
const kSsoURL = kServerRoot + kSsoPath;
const kSsoPingURL = kServerRoot + kSsoPingPath;
const kVolumesPath = "/volumes";

const kDefaultConfig = {
  port: kDefaultServerPort
}

const kAuthToken = {
  token: "oauth_token",
  token_secret: "oauth_token_secret",
  consumer_key: "oauth_consumer_key",
  consumer_secret: "oauth_consumer_secret",
  description: "Ubuntu One @ hostname [thunderbird]"
};

const kDefaultUser = {
  visible_name: "Example User",
  user_id: 42,
  root_node_path: "/~/Ubuntu One",
  user_node_paths: [
    "/~/.ubuntuone/Purchased from Ubuntu One"
  ],
  resource_path: "",
  max_bytes: 91268055040,
  used_bytes: 134506915
};

const kDefaultVolume = {
  resource_path: "/volumes/~/Thunderbird Attachments",
  type: "udf",
  when_created: "2012-04-09T05:32:57Z",
  generation: 14,
  path: "~/Thunderbird Attachments",
  content_path: "/content/~/Thunderbird Attachments",
  node_path: "/~/Thunderbird Attachments"
};

const kDefaultFileInfo = {
  kind: "file",
  resource_path: "/~/Thunderbird Attachments/placeholder.txt",
  content_path: "/content/~/Thunderbird Attachments/placeholder.txt",
  key: "D0b30fjbSs-8oYWplbgi2A:jBK7FHshSCi8rpTRbUUkag",
  hash: "sha1:39e9d7d7689f94b61237a0c5d642331bbec4268c",
  when_created: "2012-04-09T10:51:30Z",
  when_changed: "2012-04-09T10:51:31Z",
  size: 39452,
  volume_path: "/volumes/~/Thunderbird Attachments",
  path: "/placeholder.txt",
  parent_path: "/~/Thunderbird Attachments",
  generation: 10,
  generation_created: 8,
  is_live: true,
  is_public: false,
};

const kDefaultReturnHeader = {
  statusCode: 200,
  statusString: "OK",
  contentType: "text/plain",
}

function installInto(module) {
  module.MockUbuntuOneServer = MockUbuntuOneServer;
}

function MockUbuntuOneServer() {}

MockUbuntuOneServer.prototype = {
  _server: null,
  _toDelete: [],
  _timers: [],

  getPreparedBackend: function MU1S_getPreparedBackend(aAccountKey, aDontAuth) {
    let emailaddress = "somebody@example.org";
    Services.prefs.setCharPref("mail.cloud_files.accounts." + aAccountKey
                               + ".emailaddress", emailaddress);
    if (!aDontAuth) {
      cloudFileAccounts.setSecretValue(aAccountKey, cloudFileAccounts.kTokenRealm,
                                       "someAuthToken");
      cloudFileAccounts.setSecretValue(aAccountKey, "Ubuntu One Auth Secret",
                                       "someAuthSecret");
      cloudFileAccounts.setSecretValue(aAccountKey, "Ubuntu One Consumer Key",
                                       "someConsumerKey");
      cloudFileAccounts.setSecretValue(aAccountKey, "Ubuntu One Consumer Secret",
                                       "someConsumerSecret");
    }

    let ubuntuone = Cc["@mozilla.org/mail/ubuntuone;1"]
      .createInstance(Ci.nsIMsgCloudFileProvider);

    let urls = [kServerURL, kContentURL, kSsoURL, kSsoPingURL];
    ubuntuone.overrideUrls(urls.length, urls);
    ubuntuone.init(aAccountKey);
    return ubuntuone;
  },

  init: function MU1S_init(aConfig) {
    this._config = this._overrideDefault(kDefaultConfig, aConfig);
    this._server = new HttpServer();
    this._pathInfo = {}
    this._wireSso();
  },

  start: function MU1S_start() {
    this._server.start(this._config.port);
  },

  stop: function MU1S_stop(aController) {
    let allDone = false;
    this._server.stop(function() {
      allDone = true;
    });
    aController.waitFor(function () allDone,
                        "Timed out waiting for UbuntuOne server to stop!",
                        10000);
  },

  setupUser: function MU1S_wireUser(aData) {
    this._userInfo = this._overrideDefault(kDefaultUser, aData);
    this._server.registerPathHandler(kServerPath, this._getUserInfo.bind(this));
  },

  _getUserInfo: function MU1S__delete(aRequest, aResponse) {
    Services.obs.notifyObservers(null, "cloudfile:user", "");
    aResponse.setStatusLine(null, 200, "OK");
    aResponse.setHeader("Content-Type", "application/json");
    aResponse.write(JSON.stringify(this._userInfo));
  },

  planForCreateVolume: function MU1S_planForCreateVolume(aVolumeName) {
    let volume_info = this._overrideDefault(kDefaultVolume, {
      resource_path: kVolumesPath + aVolumeName,
      path: aVolumeName.substring(1),
      content_path: kContentPath + aVolumeName,
      node_path: aVolumeName
    });
    let putFileFunc = function(aRequest, aResponse) {
      if (aRequest.method != "PUT") {
        returnError(aResponse, "Volume should be created with a PUT request");
        return
      }
      Services.obs.notifyObservers(null, "cloudfile:createvolume", aVolumeName);
      if (this._userInfo.user_node_paths.indexOf(aVolumeName) < 0) {
        this._userInfo.user_node_paths.push(aVolumeName);
      }

      aResponse.setStatusLine(null, 200, "OK");
      aResponse.setHeader("Content-Type", "application/json");
      aResponse.write(JSON.stringify(volume_info));
    }.bind(this);
    this._server.registerPathHandler(
      kServerPath + kVolumesPath + encodePathForURI(aVolumeName),
      putFileFunc);
  },

  /**
   * Plan to upload a file with a particular filename.
   *
   * @param aPath the path of the file that will be uploaded.
   * @param aMSeconds an optional argument, for how long the upload should
   *                  last in milliseconds.
   */
  planForUploadFile: function MU1S_planForUploadFile(aPath, aMSeconds) {
    let lastSlash = aPath.lastIndexOf('/');
    let parent = aPath.substring(0, lastSlash);
    let filename = aPath.substring(lastSlash);
    let info = this._overrideDefault(kDefaultFileInfo, {
      resource_path: aPath,
      content_path: kContentPath + aPath,
      volume_path: kVolumesPath + parent,
      path: filename,
      parent_path: parent,
    });
    this._pathInfo[aPath] = info;

    // Prepare the function that will receive the upload and respond
    // appropriately.
    let putFileFunc = function(aRequest, aResponse) {
      if (aRequest.method != "PUT") {
        returnError(aResponse, "Files should be created with a PUT request");
        return;
      }
      Services.obs.notifyObservers(null, "cloudfile:uploadFile", aPath);
      info.size = aRequest.getHeader("Content-Length");
      info.is_live = true;
      aResponse.setStatusLine(null, 201, "OK");
      aResponse.setHeader("Content-Type", "application/json");
      aResponse.write(JSON.stringify(info));
    }.bind(this);

    // Also prepare a function that will, if necessary, wait aMSeconds before
    // firing putFileFunc.
    let waitWrapperFunc = function(aRequest, aResponse) {
      Services.obs.notifyObservers(null, "cloudfile:uploadStarted", aPath);

      if (!aMSeconds) {
        putFileFunc(aRequest, aResponse);
        return;
      }

      // Ok, we're waiting a bit.  Tell the HTTP server that we're going to
      // generate a response asynchronously, then set a timer to send the
      // response after aMSeconds milliseconds.
      aResponse.processAsync();
      let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
      let timerEvent = {
        notify: function(aTimer) {
          putFileFunc(aRequest, aResponse);
          aResponse.finish();
        },
      };
      timer.initWithCallback(timerEvent, aMSeconds,
                             Ci.nsITimer.TYPE_ONE_SHOT);
      // We can't let the timer get garbage collected, so we store it.
      this._timers.push(timer);
    }.bind(this);

    this._server.registerPathHandler(kContentPath + encodePathForURI(aPath),
                                     waitWrapperFunc);
  },

  planForMetadataUpdate: function MU1S_planForMetadataUpdate(aPath,
                                                             aPublicURL) {
    let fileMetadataFunc = function(aRequest, aResponse) {
      let info = this._pathInfo[aPath];
      if (aRequest.method == "GET") {
        Services.obs.notifyObservers(null, "cloudfile:getMetadata", aPath);
      }
      else if (aRequest.method == "PUT") {
        Services.obs.notifyObservers(null, "cloudfile:getFileURL", aPath);
        let body = JSON.parse(readBody(aRequest));
        info.is_public = body.is_public;
        if (info.is_public) {
          info.public_url = aPublicURL;
        }
      }
      else if (aRequest.method == "DELETE") {
        Services.obs.notifyObservers(null, "cloudfile:deleteFile", aPath);
        info.is_live = false;
        info = "";
      }
      aResponse.setStatusLine(null, 200, "OK");
      aResponse.setHeader("Content-Type", "application/json");
      aResponse.write(JSON.stringify(info));
    }.bind(this);
    this._server.registerPathHandler(kServerPath + encodePathForURI(aPath),
                                     fileMetadataFunc);
  },

  _noteAndReturnString: function MU1S__noteAndReturnString(aKey, aValue,
                                                           aString,
                                                           aOptions) {

    aOptions = this._overrideDefault(kDefaultReturnHeader, aOptions);

    let subjectString = Cc["@mozilla.org/supports-string;1"]
                          .createInstance(Ci.nsISupportsString);
    subjectString.data = aString;

    let func = function(aMeta, aResponse) {
      try {
        aResponse.setStatusLine(null, aOptions.statusCode,
                                aOptions.statusString);
        aResponse.setHeader("Content-Type", aOptions.contentType);
        aResponse.write(aString);
        Services.obs.notifyObservers(subjectString, aKey, aValue);
      }
      catch(ex) {
        dump("Failed to generate server response: " + ex);
      }
    }
    return func;
  },

  _overrideDefault: function MU1S__overrideDefault(aDefault, aData) {
    let result = {}

    if (aData === undefined)
      aData = {};

    for (let param in aDefault) {
      if (param in aData)
        result[param] = aData[param];
      else
        result[param] = aDefault[param];
    }
    return result;
  },

  _wireSso: function MU1S__wireSso() {
    let authFunc = this._noteAndReturnString("cloudfile:auth", "",
                                             JSON.stringify(kAuthToken),
                                             {contentType: 'application/json'});
    this._server.registerPathHandler(kSsoPath, authFunc);

    let pingFunc = this._noteAndReturnString("cloudfile:ping", "",
                                             "ok 1/1");
    this._server.registerPathHandler(kSsoPingPath, pingFunc)
  },
}

function encodePathForURI(aStr) {
  return encodeURIComponent(aStr).replace(/%2F/g, '/');
}

const ScriptableInputStream = Components.Constructor(
  "@mozilla.org/scriptableinputstream;1",
  "nsIScriptableInputStream",
  "init");

function readBody(aRequest) {
  //let body = Cc['@mozilla.org/scriptableinputstream;1']
  //  .createInstance(Ci.nsIScriptableInputStream);
  //body.setInputStream(aRequest.bodyInputStream);
  let body = new ScriptableInputStream(aRequest.bodyInputStream)
  return body.read(-1);
}

function returnError(aResponse, aMessage) {
  aResponse.setStatusLine(null, 50, "Server Error");
  aResponse.setHeader("Content-Type", "text/plain");
  aResponse.write(aMessage);
}
