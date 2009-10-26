/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Incoming Mail Auto discovery.
 *
 * The Initial Developer of the Original Code is
 * Brian Kirsch.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * David Ascher
 * Ben Bucksch <mozilla bucksch.org>
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

/**
 * This checks a given config, by trying a real connection and login,
 * with username and password.
 *
 * @param accountConfig {AccountConfig} The guessed account config.
 *    username, password, realname, emailaddress etc. are not filled out,
 *    but placeholders to be filled out via replaceVariables().
 * @param alter {boolean}
 *    Try other usernames and login schemes, until login works.
 *    Warning: Modifies |accountConfig|.
 *
 * This function is async.
 * @param successCallback function(accountConfig)
 *   Called when we could guess the config.
 *   For accountConfig, see below.
 * @param errorCallback function(ex)
 *   Called when we could guess not the config, either
 *   because we have not found anything or
 *   because there was an error (e.g. no network connection).
 *   The ex.message will contain a user-presentable message.
 */
function verifyConfig(config, alter, msgWindow, successCallback, errorCallback)
{
  ddumpObject(config, "config", 3);
  assert(config instanceof AccountConfig, "BUG: Arg 'config' needs to be an AccountConfig object");
  assert(typeof(alter) == "boolean", "BUG: Bad arg 'alter'");
  assert(typeof(successCallback) == "function", "BUG: 'successCallback' is not a function");
  assert(typeof(errorCallback) == "function", "BUG: 'errorCallback' is not a function");

  var accountManager = Cc["@mozilla.org/messenger/account-manager;1"]
                       .getService(Ci.nsIMsgAccountManager);

  if (accountManager.findRealServer(config.incoming.username,
                                    config.incoming.hostname,
                                    sanitize.enum(config.incoming.type,
                                                  ["pop3", "imap", "nntp"]),
                                    config.incoming.port))
    return errorCallback("Incoming server exists");

  // incoming server
  var inServer =
    accountManager.createIncomingServer(config.incoming.username,
                                        config.incoming.hostname,
                                        sanitize.enum(config.incoming.type,
                                                      ["pop3", "imap", "nntp"]));
  inServer.port = config.incoming.port;
  inServer.password = config.incoming.password;
  if (config.incoming.socketType == 1) // plain
    inServer.socketType = Ci.nsIMsgIncomingServer.defaultSocket;
  else if (config.incoming.socketType == 2) // SSL
    inServer.socketType = Ci.nsIMsgIncomingServer.useSSL;
  else if (config.incoming.socketType == 3) // TLS
    inServer.socketType = Ci.nsIMsgIncomingServer.alwaysUseTLS;

  // auth
  if (config.incoming.auth == 2) // "secure" auth
    inServer.useSecAuth = true;

  try {
    if (inServer.password)
      verifyLogon(config, inServer, alter, msgWindow,
                  successCallback, errorCallback);
    else {
      // Avoid pref pollution, clear out server prefs.
      accountManager.removeIncomingServer(inServer, true);
      successCallback(config);
    }
  } catch (e) {
    ddump("ERROR: verify logon shouldn't have failed");
    errorCallback(e);
    throw(e);
  }
};

function verifyLogon(config, inServer, alter, msgWindow, successCallback,
                     errorCallback)
{
  // hack - save away the old callbacks.
  let saveCallbacks = msgWindow.notificationCallbacks;
  // set our own callbacks - this works because verifyLogon will
  // synchronously create the transport and use the notification callbacks.
  let listener = new urlListener(config, inServer, alter, msgWindow,
                                 successCallback, errorCallback);
  // our listener listens both for the url and cert errors.
  msgWindow.notificationCallbacks = listener;
  // try to work around bug where backend is clearing password.
  try {
    inServer.password = config.incoming.password;
    let uri = inServer.verifyLogon(listener, msgWindow);
    // clear msgWindow so url won't prompt for passwords.
    uri.QueryInterface(Ci.nsIMsgMailNewsUrl).msgWindow = null;
  }
  finally {
    // restore them
    msgWindow.notificationCallbacks = saveCallbacks;
  }
}

/**
 * The url listener also implements nsIBadCertListener2.  Its job is to prevent
 * "bad cert" security dialogs from being shown to the user.  Currently it puts
 * up the cert override dialog, though we'd like to give the user more detailed
 * information in the future.
 */

function urlListener(config, server, alter, msgWindow, successCallback,
                     errorCallback)
{
  this.mConfig = config;
  this.mServer = server;
  this.mAlter = alter;
  this.mSuccessCallback = successCallback;
  this.mErrorCallback = errorCallback;
  this.mMsgWindow = msgWindow;
  this.mCertError = false;
  this._log = Log4Moz.getConfiguredLogger("mail.wizard");
}
urlListener.prototype =
{
  OnStartRunningUrl: function(aUrl)
  {
    this._log.info("Starting to test username");
    this._log.info("  username=" + (this.mConfig.incoming.username !=
                                    this.mConfig.identity.emailAddress));
    this._log.info("  secAuth=" + this.mServer.useSecAuth);
    this._log.info("  savedUsername=" +
                   (this.mConfig.usernameSaved ? "true" : "false"));
  },

  OnStopRunningUrl: function(aUrl, aExitCode)
  {
    if (Components.isSuccessCode(aExitCode))
    {
      this._cleanup();
      this.mSuccessCallback(this.mConfig);
    }
    // Logon failed, and we aren't supposed to try other variations.
    else if (!this.mAlter)
    {
      this._cleanup();
      var stringBundle = getStringBundle("chrome://messenger/locale/accountCreationModel.properties");
      var errorMsg = stringBundle.GetStringFromName("cannot_login.error");
      this.mErrorCallback(new Exception(errorMsg));
    }
    // Try other variations, unless there's a cert error, in which
    // case we'll see what the user chooses.
    else if (!this.mCertError)
    {
      ddump("trying next logon\n");
      this.tryNextLogon()
    }
  },

  tryNextLogon: function()
  {
    this._log.info("tryNextLogon()");
    this._log.info("  username=" + (this.mConfig.incoming.username !=
                                    this.mConfig.identity.emailAddress));
    this._log.info("  secAuth=" + this.mServer.useSecAuth);
    this._log.info("  savedUsername=" +
                   (this.mConfig.usernameSaved ? "true" : "false"));
    // check if we tried full email address as username
    if (this.mConfig.incoming.username != this.mConfig.identity.emailAddress)
    {
      this._log.info("  Changing username to email address.");
      this.mConfig.usernameSaved = this.mConfig.incoming.username;
      this.mConfig.incoming.username = this.mConfig.identity.emailAddress;
      this.mServer.username = this.mConfig.incoming.username;
      this.mServer.password = this.mConfig.incoming.password;
      verifyLogon(this.mConfig, this.mServer, this.mAlter, this.mMsgWindow,
                  this.mSuccessCallback, this.mErrorCallback);
      return;
    }

    if (this.mConfig.usernameSaved)
    {
      this._log.info("  Re-setting username.");
      // If we tried the full email address as the username, then let's go
      // back to trying just the username before trying the other cases.
      this.mConfig.incoming.username = this.mConfig.usernameSaved;
      this.mConfig.usernameSaved = null;
    }

    // sec auth seems to have failed, and we've tried both
    // varieties of user name, sadly.
    // So fall back to non-secure auth, and
    // again try the user name and email address as username
    if (this.mServer.useSecAuth &&
        (this.mServer.socketType == Ci.nsIMsgIncomingServer.useSSL ||
         this.mServer.socketType == Ci.nsIMsgIncomingServer.alwaysUseTLS))
    {
      this._log.info("  Changing useSecAuth to false.");
      this._log.info("  password=" +
                     (this.mServer.password ? "true" : "false"));
      this.mConfig.incoming.auth = 1; // "insecure" auth
      this.mServer.useSecAuth = false;
      this.mServer.username = this.mConfig.incoming.username;
      this.mServer.password = this.mConfig.incoming.password;
      verifyLogon(this.mConfig, this.mServer, this.mAlter, this.mMsgWindow,
                  this.mSuccessCallback, this.mErrorCallback);
      return;
    }

    // Tried all variations we can. Give up.
    this._log.info("  Giving up.");
    this._cleanup();
    let stringBundle = getStringBundle("chrome://messenger/locale/accountCreationModel.properties");
    let errorMsg = stringBundle.GetStringFromName("cannot_login.error");
    this.mErrorCallback(new Exception(errorMsg));
    return;
  },

  _cleanup : function()
  {
    // Avoid pref pollution, clear out server prefs.
    Cc["@mozilla.org/messenger/account-manager;1"]
    .getService(Ci.nsIMsgAccountManager)
    .removeIncomingServer(this.mServer, true);

    this.mServer = null;
  },

  // Suppress any certificate errors
  notifyCertProblem: function(socketInfo, status, targetSite) {
    if (!status)
      return true;

    this.mCertError = true;
    ddump("got cert error\n");
    setTimeout(this.informUserOfCertError, 0, socketInfo, targetSite, this);
    return true;
  },

  informUserOfCertError : function(socketInfo, targetSite, self) {
    let params = { exceptionAdded : false };
    params.prefetchCert = true;
    params.location = targetSite;
    window.openDialog("chrome://pippki/content/exceptionDialog.xul",
                      "","chrome,centerscreen,modal", params);
    ddump("after exception dialog\n");
    ddump("exceptionAdded = " + params.exceptionAdded + "\n");
    if (!params.exceptionAdded) {
      self._cleanup();
      let stringBundle = getStringBundle("chrome://messenger/locale/accountCreationModel.properties");
      let errorMsg = stringBundle.GetStringFromName("cannot_login.error");
      self.mErrorCallback(new Exception(errorMsg));
    }
    else {
      // Retry the logon now that we've added the cert exception.
      verifyLogon(self.mConfig, self.mServer, self.mAlter, self.mMsgWindow,
                  self.mSuccessCallback, self.mErrorCallback);
    }
  },

  // nsIInterfaceRequestor
  getInterface: function(iid) {
    return this.QueryInterface(iid);
  },

  // nsISupports
  QueryInterface: function(iid) {
    if (!iid.equals(Components.interfaces.nsIBadCertListener2) &&
        !iid.equals(Components.interfaces.nsIInterfaceRequestor) &&
        !iid.equals(Components.interfaces.nsIUrlListener) &&
        !iid.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;

    return this;
  }
}
