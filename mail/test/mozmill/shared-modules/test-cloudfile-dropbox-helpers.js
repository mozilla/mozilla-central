/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;

const MODULE_NAME = 'cloudfile-dropbox-helpers';

const RELATIVE_ROOT = '../shared-modules';
const MODULE_REQUIRES = [];

let httpd = {};
Cu.import('resource://mozmill/stdlib/httpd.js', httpd);
Cu.import('resource://gre/modules/Services.jsm');

const kDefaultServerPort = 4444;
const kServerRoot = "http://localhost:" + kDefaultServerPort;
const kServerPath = "/server/";
const kContentPath = "/content/";
const kAuthPath = "/auth/";
const kServerURL = kServerRoot + kServerPath;
const kContentURL = kServerRoot + kContentPath;
const kAuthURL = kServerRoot + kAuthPath;
const kOAuthTokenPath = "oauth/request_token";
const kOAuthAuthorizePath = "oauth/authorize";
const kOAuthAccessTokenPath = "oauth/access_token";
const kUserInfoPath = "account/info";
const kPutFilePath = "files_put/sandbox/";
const kSharesPath = "shares/sandbox/";
const kDeletePath = "fileops/delete/";
const kLogoutPath = "/logout";
const kLogoutURL = kServerRoot + kLogoutPath;

const kDefaultConfig = {
  port: kDefaultServerPort
}

const kAuthTokenString = "oauth_token=requestkey&oauth_token_secret=requestsecret";

const kDefaultUser = {
  referral_link: "https://www.dropbox.com/referrals/r1a2n3d4m5s6t7",
  display_name: "John P. User",
  uid: 12345678,
  country: "US",
  quota_info: {
    shared: 253738410565,
    quota: 107374182400000,
    normal: 680031877871
  },
  email: "john@example.com"
}

const kDefaultFilePutReturn = {
  size: "225.4KB",
  rev: "35e97029684fe",
  thumb_exists: false,
  bytes: 230783,
  modified: "Tue, 19 Jul 2011 21:55:38 +0000",
//  path: "/Getting_Started.pdf",
  is_dir: false,
  icon: "page_white_acrobat",
  root: "dropbox",
  mime_type: "application/pdf",
  revision: 220823
}

const kDefaultShareReturn = {
  url: "http://db.tt/APqhX1",
  expires: "Wed, 17 Aug 2011 02:34:33 +0000"
}

const kDefaultReturnHeader = {
  statusCode: 200,
  statusString: "OK",
  contentType: "text/plain",
}

const kDefaultDeleteReturn = {
  size: "0 bytes",
  is_deleted: true,
  bytes: 0,
  thumb_exists: false,
  rev: "1f33043551f",
  modified: "Wed, 10 Aug 2011 18:21:30 +0000",
//  path: "/test .txt",
  is_dir: false,
  icon: "page_white_text",
  root: "dropbox",
  mime_type: "text/plain",
  revision: 492341,
}

function installInto(module) {
  module.MockDropboxServer = MockDropboxServer;
}

function MockDropboxServer() {}

MockDropboxServer.prototype = {
  _server: null,
  _toDelete: [],

  getPreparedBackend: function MDBS_getPreparedBackend(aAccountKey) {
    let dropbox = Cc["@mozilla.org/mail/dropbox;1"]
                  .getService(Ci.nsIMsgCloudFileProvider);

    let urls = [kServerURL, kContentURL, kAuthURL, kLogoutURL];
    dropbox.overrideUrls(urls.length, urls);
    dropbox.init(aAccountKey);
    return dropbox;
  },

  init: function MDBS_init(aConfig) {
    this._config = kDefaultConfig;

    for (let param in aConfig) {
      this._config[param] = aConfig[param];
    }

    this._server = httpd.getServer(this._config.port, '');
    this._wireOAuth();
    this._wireDeleter();
  },

  start: function MDBS_start() {
    this._server.start(this._config.port);
  },

  stop: function MDBS_stop(aController) {
    let allDone = false;
    this._server.stop(function() {
      allDone = true;
    });
    aController.waitFor(function () allDone,
                        "Timed out waiting for Dropbox server to stop!");
  },

  setupUser: function MDBS_wireUser(aData) {
    aData = this._overrideDefault(kDefaultUser, aData);

    let userFunc = this._noteAndReturnString("cloudfile:user", "",
                                             JSON.stringify(aData));

    this._server.registerPathHandler(kServerPath + kUserInfoPath,
                                     userFunc);
  },

  planForUploadFile: function MDBS_planForUploadFile(aFileName, aData) {
    let data = kDefaultFilePutReturn;
    data.path = aFileName;
    aData = this._overrideDefault(data, aData);

    let putFileFunc = this._noteAndReturnString("cloudfile:uploadFile",
                                                aFileName,
                                                JSON.stringify(aData));
    this._server.registerPathHandler(kContentPath + kPutFilePath + aFileName,
                                     putFileFunc);
  },

  planForGetFileURL: function MDBS_planForGetShare(aFileName, aData) {
    aData = this._overrideDefault(kDefaultShareReturn, aData);

    let getShareFunc = this._noteAndReturnString("cloudfile:getFileURL",
                                                 aFileName,
                                                 JSON.stringify(aData));
    this._server.registerPathHandler(kServerPath + kSharesPath + aFileName,
                                     getShareFunc);
  },

  planForDeleteFile: function MDBS_planForDeleteFile(aFilename) {
    this._toDelete.push(aFilename);
  },

  _wireDeleter: function MDBS__wireDeleter() {
    this._server.registerPathHandler(kServerPath + kDeletePath,
                                     this._delete.bind(this));
  },

  _delete: function MDBS__delete(aRequest, aResponse) {
    // Extract the query params
    let params = parseQueryString(aRequest.queryString);
    let pathIndex = this._toDelete.indexOf(params.path);

    if (pathIndex == -1) {
      aResponse.setStatusLine(null, 500, "Bad request");
      aResponse.write("Was not prepared to delete a file at path: "
                      + params.path);
      return;
    }

    this._toDelete.splice(pathIndex, 1);

    Services.obs.notifyObservers(null, "cloudfile:deleteFile",
                                 params.path);

    let data = kDefaultDeleteReturn;
    data.path = params.path;

    aResponse.setStatusLine(null, 200, "OK");
    aResponse.setHeader("Content-Type", "text/plain");
    aResponse.write(JSON.stringify(data));
  },

  _noteAndReturnString: function MDBS__noteAndReturnString(aKey, aValue,
                                                           aString,
                                                           aOptions) {

    aOptions = this._overrideDefault(kDefaultReturnHeader, aOptions);
    let self = this;

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
      } catch(e) {
        dump("Failed to generate server response: " + e);
      }
    }
    return func;
  },

  _overrideDefault: function MDBS__overrideDefault(aDefault, aData) {
    if (aData === undefined)
      return aDefault;

    for (let param in aDefault) {
      if (param in aData)
        aDefault[param] = aData[param];
    }
    return aDefault;
  },

  _wireOAuth: function MDBS__wireOAuth() {
    let authFunc = this._noteAndReturnString("cloudfile:auth", "",
                                             kAuthTokenString);

    this._server.registerPathHandler(kServerPath + kOAuthTokenPath,
                                     authFunc);
    this._server.registerPathHandler(kServerPath + kOAuthAccessTokenPath,
                                     authFunc);
    this._server.registerPathHandler(kAuthPath + kOAuthAuthorizePath,
                                     this._authHandler);

    let logoutFunc = this._noteAndReturnString("cloudfile:logout", "",
                                               "Successfully logged out!");
    this._server.registerPathHandler(kLogoutPath, logoutFunc);
  },

  _authHandler: function MDBS__authHandler(meta, response) {
    response.setStatusLine(null, 302, "Found");
    response.setHeader("Location", "http://oauthcallback.local/",
                       false);
  },
}

function parseQueryString(str)
{
  let paramArray = str.split("&");
  let regex = /^([^=]+)=(.*)$/;
  let params = {};
  for (let i = 0; i < paramArray.length; i++)
  {
    let match = regex.exec(paramArray[i]);
    if (!match)
      throw "Bad parameter in queryString!  '" + paramArray[i] + "'";
    params[decodeURIComponent(match[1])] = decodeURIComponent(match[2]);
  }

  return params;
}
