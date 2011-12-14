/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * David Ascher <davida@mozilla.com> and
 * Ben Bucksch <ben.bucksch beonex.com>
 * Portions created by the Initial Developer are Copyright (C) 2008-2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either of the GNU General Public License Version 2 or later (the "GPL"),
 * or the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
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

Components.utils.import("resource://gre/modules/Services.jsm");

/**
 * This is the dialog opened by menu File | New account | Mail... .
 *
 * It gets the user's realname, email address and password,
 * and tries to automatically configure the account from that,
 * using various mechanisms. If all fails, the user can enter/edit
 * the config, then we create the account.
 *
 * Steps:
 * - User enters realname, email address and password
 * - check for config files on disk
 *   (shipping with Thunderbird, for enterprise deployments)
 * - (if fails) try to get the config file from the ISP via a
 *   fixed URL on the domain of the email address
 * - (if fails) try to get the config file from our own database
 *   at MoMo servers, maintained by the community
 * - (if fails) try to guess the config, by guessing hostnames,
 *    probing ports, checking config via server's CAPS line etc..
 * - verify the setup, by trying to login to the configured servers
 * - let user verify and maybe edit the server names and ports
 * - If user clicks OK, create the account
 */


// from http://xyfer.blogspot.com/2005/01/javascript-regexp-email-validator.html
var emailRE = /^[-_a-z0-9\'+*$^&%=~!?{}]+(?:\.[-_a-z0-9\'+*$^&%=~!?{}]+)*@(?:[-a-z0-9.]+\.[a-z]{2,6}|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/i;
var domainRE = /^((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$|(\[?(\d{1,3}\.){3}\d{1,3}\]?)$/i
const kHighestPort = 65535;

Cu.import("resource:///modules/gloda/log4moz.js");
let gEmailWizardLogger = Log4Moz.getConfiguredLogger("mail.wizard");

var gStringsBundle;
var gMessengerBundle;
var gBrandShortName;

/*********************
TODO for bug 549045
- autodetect protocol
Polish
- reformat code style to match
<https://developer.mozilla.org/En/Mozilla_Coding_Style_Guide#Control_Structures>
- bold status
- remove status when user edited in manual edit
- add and adapt test from bug 534588
Bugs
- SSL cert errors
  - invalid cert (hostname mismatch) doesn't trigger warning dialog as it should
  - accept self-signed cert (e.g. imap.mail.ru) doesn't work
    (works without my patch),
    verifyConfig.js line 124 has no inServer, for whatever reason,
    although I didn't change verifyConfig.js at all
    (the change you see in that file is irrelevant: that was an attempt to fix
    the bug and clean up the code).
- Set radio IMAP vs. POP3, see TODO in code
Things to test (works for me):
- state transitions, buttons enable, status msgs
  - stop button
    - showes up again after stopping detection and restarting it
    - when stopping [retest]: buttons proper?
  - enter nonsense domain. guess fails, (so automatically) manual,
    change domain to real one (not in DB), guess succeeds.
    former bug: goes to manual first shortly, then to result
**********************/

// To debug, set mail.wizard.logging.dump (or .console)="All" and kDebug = true

function e(elementID)
{
  return document.getElementById(elementID);
};

function _hide(id)
{
  e(id).hidden = true;
}

function _show(id)
{
  e(id).hidden = false;
}

function _enable(id)
{
  e(id).disabled = false;
}

function _disable(id)
{
  e(id).disabled = true;
}

function setText(id, value)
{
  var element = e(id);
  assert(element, "setText() on non-existant element ID");

  if (element.localName == "textbox" || element.localName == "label") {
    element.value = value;
  } else if (element.localName == "description") {
    element.textContent = value;
  } else {
    throw new NotReached("XUL element type not supported");
  }
}

function setLabelFromStringBundle(elementID, stringName)
{
  e(elementID).label = gMessengerBundle.getString(stringName);
};

function EmailConfigWizard()
{
  this._init();
}
EmailConfigWizard.prototype =
{
  _init : function EmailConfigWizard__init()
  {
    gEmailWizardLogger.info("Initializing setup wizard");
    this._abortable = null;
  },

  onLoad : function()
  {
    /**
     * this._currentConfig is the config we got either from the XML file or
     * from guessing or from the user. Unless it's from the user, it contains
     * placeholders like %EMAILLOCALPART% in username and other fields.
     *
     * The config here must retain these placeholders, to be able to
     * adapt when the user enters a different realname, or password or
     * email local part. (A change of the domain name will trigger a new
     * detection anyways.)
     * That means, before you actually use the config (e.g. to create an
     * account or to show it to the user), you need to run replaceVariables().
     */
    this._currentConfig = null;
    this._domain = "";
    this._email = "";
    this._realname = "";
    this._password = "";
    this._okCallback = null;

    if (window.arguments && window.arguments[0]) {
      if (window.arguments[0].msgWindow) {
        this._parentMsgWindow = window.arguments[0].msgWindow;
      }
      if (window.arguments[0].okCallback) {
        this._okCallback = window.arguments[0].okCallback;
      }
    }

    gStringsBundle = e("strings");
    gMessengerBundle = e("bundle_messenger");
    gBrandShortName = e("bundle_brand").getString("brandShortName");

    setLabelFromStringBundle("in-authMethod-password-cleartext",
        "authPasswordCleartextViaSSL"); // will warn about insecure later
    setLabelFromStringBundle("in-authMethod-password-encrypted",
        "authPasswordEncrypted");
    setLabelFromStringBundle("in-authMethod-kerberos", "authKerberos");
    setLabelFromStringBundle("in-authMethod-ntlm", "authNTLM");
    setLabelFromStringBundle("out-authMethod-no", "authNo");
    setLabelFromStringBundle("out-authMethod-password-cleartext",
        "authPasswordCleartextViaSSL"); // will warn about insecure later
    setLabelFromStringBundle("out-authMethod-password-encrypted",
        "authPasswordEncrypted");
    setLabelFromStringBundle("out-authMethod-kerberos", "authKerberos");
    setLabelFromStringBundle("out-authMethod-ntlm", "authNTLM");

    e("incoming_port").value = gStringsBundle.getString("port_auto");
    this.fillPortDropdown("smtp");

    // If the account provisioner is preffed off, don't display
    // the account provisioner button.
    if (!Services.prefs.getBoolPref("mail.provider.enabled"))
      _hide("provisioner_button");

    // Populate SMTP server dropdown with already configured SMTP servers from
    // other accounts.
    var menulist = e("outgoing_hostname");
    var smtpManager = Cc["@mozilla.org/messengercompose/smtp;1"]
        .getService(Ci.nsISmtpService);
    var smtpServers = smtpManager.smtpServers;
    while (smtpServers.hasMoreElements()) {
      let server = smtpServers.getNext().QueryInterface(Ci.nsISmtpServer);
      let label = server.displayname;
      let key = server.key;
      if (smtpManager.defaultServer &&
          smtpManager.defaultServer.key == key) {
        label += " " + gStringsBundle.getString("default_server_tag");
      }
      let menuitem = menulist.appendItem(label, key, ""); // label,value,descr
      menuitem.serverKey = key;
    }
    // Add the entry for the new host to the menulist
    let menuitem = menulist.insertItemAt(0, "", "-new-"); // pos,label,value
    menuitem.serverKey = null;

    // admin-locked prefs hurray
    if (!Application.prefs.getValue("signon.rememberSignons", true)) {
      let rememberPasswordE = e("remember_password");
      rememberPasswordE.checked = false;
      rememberPasswordE.disabled = true;
    }

    // First, unhide the main window areas, and store the width,
    // so that we don't resize wildly when we unhide areas.
    // switchToMode() will then hide the unneeded parts again.
    // We will add some leeway of 10px, in case some of the <description>s wrap,
    // e.g. outgoing username != incoming username.
    _show("status_area");
    _show("result_area");
    _hide("manual-edit_area");
    window.sizeToContent();
    e("mastervbox").setAttribute("style",
        "min-width: " + document.width + "px; " +
        "min-height: " + (document.height + 10) + "px;");

    this.switchToMode("start");
    e("realname").focus();
  },

  /**
   * Changes the window configuration to the different modes we have.
   * Shows/hides various window parts and buttons.
   * @param modename {String-enum}
   *    "start" : Just the realname, email address, password fields
   *    "find-config" : detection step, adds the progress message/spinner
   *    "result" : We found a config and display it to the user.
   *       The user may create the account.
   *    "manual-edit" : The user wants (or needs) to manually enter their
   *       the server hostname and other settings. We'll use them as provided.
   * Additionally, there are the following sub-modes which can be entered after
   * you entered the main mode:
   *    "manual-edit-have-hostname" : user entered a hostname for both servers
   *        that we can use
   *    "manual-edit-testing" : User pressed the [Re-test] button and
   *         we're currently detecting the "Auto" values
   *    "manual-edit-complete" : user entered (or we tested) all necessary
   *         values, and we're ready to create to account
   * Currently, this doesn't cover the warning dialogs etc.. It may later.
   */
  switchToMode : function(modename)
  {
    if (modename == this._currentModename) {
      return;
    }
    this._currentModename = modename;
    gEmailWizardLogger.info("switching to UI mode " + modename)

    //_show("initialSettings"); always visible
    //_show("cancel_button"); always visible
    if (modename == "start") {
      _hide("status_area");
      _hide("result_area");
      _hide("manual-edit_area");

      _show("next_button");
      _disable("next_button"); // will be enabled by code
      _hide("half-manual-test_button");
      _hide("create_button");
      _hide("stop_button");
      _hide("manual-edit_button");
      _hide("advanced-setup_button");
    } else if (modename == "find-config") {
      _show("status_area");
      _hide("result_area");
      _hide("manual-edit_area");

      _show("next_button");
      _disable("next_button");
      _hide("half-manual-test_button");
      _hide("create_button");
      _show("stop_button");
      this.onStop = this.onStopFindConfig;
      _show("manual-edit_button");
      _hide("advanced-setup_button");
    } else if (modename == "result") {
      _show("status_area");
      _show("result_area");
      _hide("manual-edit_area");

      _hide("next_button");
      _hide("half-manual-test_button");
      _show("create_button");
      _enable("create_button");
      _hide("stop_button");
      _show("manual-edit_button");
      _hide("advanced-setup_button");
    } else if (modename == "manual-edit") {
      _show("status_area");
      _hide("result_area");
      _show("manual-edit_area");

      _hide("next_button");
      _show("half-manual-test_button");
      _disable("half-manual-test_button");
      _show("create_button");
      _disable("create_button");
      _hide("stop_button");
      _hide("manual-edit_button");
      _show("advanced-setup_button");
      _disable("advanced-setup_button");
    } else if (modename == "manual-edit-have-hostname") {
      _show("status_area");
      _hide("result_area");
      _show("manual-edit_area");
      _hide("manual-edit_button");
      _hide("next_button");
      _show("create_button");

      _show("half-manual-test_button");
      _enable("half-manual-test_button");
      _disable("create_button");
      _hide("stop_button");
      _show("advanced-setup_button");
      _disable("advanced-setup_button");
    } else if (modename == "manual-edit-testing") {
      _show("status_area");
      _hide("result_area");
      _show("manual-edit_area");
      _hide("manual-edit_button");
      _hide("next_button");
      _show("create_button");

      _show("half-manual-test_button");
      _disable("half-manual-test_button");
      _disable("create_button");
      _show("stop_button");
      this.onStop = this.onStopHalfManualTesting;
      _show("advanced-setup_button");
      _disable("advanced-setup_button");
    } else if (modename == "manual-edit-complete") {
      _show("status_area");
      _hide("result_area");
      _show("manual-edit_area");
      _hide("manual-edit_button");
      _hide("next_button");
      _show("create_button");

      _show("half-manual-test_button");
      _enable("half-manual-test_button");
      _enable("create_button");
      _hide("stop_button");
      _show("advanced-setup_button");
      _enable("advanced-setup_button");
    } else {
      throw new NotReached("unknown mode");
    }
    // If we're offline, we're going to disable the create button, but enable
    // the advanced config button if we have a current config.
    if (Services.io.offline) {
      if (this._currentConfig != null) {
        _show("advanced-setup_button");
        _enable("advanced-setup_button");
        _hide("half-manual-test_button");
        _hide("create_button");
        _hide("manual-edit_button");
      }
    }
    window.sizeToContent();
  },

  /**
   * Start from beginning with possibly new email address.
   */
  onStartOver : function()
  {
    if (this._abortable) {
      this.onStop();
    }
    this.switchToMode("start");
  },

  getConcreteConfig : function()
  {
    var result = this._currentConfig.copy();
    replaceVariables(result, this._realname, this._email, this._password);
    result.rememberPassword = e("remember_password").checked &&
                              !!this._password;
    return result;
  },

  /*
   * This checks if the email address is at least possibly valid, meaning it
   * has an '@' before the last char.
   */
  validateEmailMinimally : function(emailAddr)
  {
    let atPos = emailAddr.lastIndexOf("@");
    return atPos > 0 && atPos + 1 < emailAddr.length;
  },

  /*
   * This checks if the email address is syntactically valid,
   * as far as we can determine. We try hard to make full checks.
   *
   * OTOH, we have a very small chance of false negatives,
   * because the RFC822 address spec is insanely complicated,
   * but rarely needed, so when this here fails, we show an error message,
   * but don't stop the user from continuing.
   * In contrast, if validateEmailMinimally() fails, we stop the user.
   */
  validateEmail : function(emailAddr)
  {
    return emailRE.test(emailAddr);
  },

  /**
   * onInputEmail and onInputRealname are called on input = keypresses, and
   * enable/disable the next button based on whether there's a semi-proper
   * e-mail address and non-blank realname to start with.
   *
   * A change to the email address also automatically restarts the
   * whole process.
   */
  onInputEmail : function()
  {
    this._email = e("email").value;
    this.onStartOver();
    this.checkStartDone();
  },
  onInputRealname : function()
  {
    this._realname = e("realname").value;
    this.checkStartDone();
  },

  onInputPassword : function()
  {
    this._password = e("password").value;
  },

  /**
   * This does very little other than to check that a name was entered at all
   * Since this is such an insignificant test we should be using a very light
   * or even jovial warning.
   */
  onBlurRealname : function()
  {
    let realnameEl = e("realname");
    if (this._realname) {
      this.clearError("nameerror");
      _show("nametext");
      realnameEl.removeAttribute("error");
    // bug 638790: don't show realname error until user enter an email address
    } else if (this.validateEmailMinimally(this._email)) {
      _hide("nametext");
      this.setError("nameerror", "please_enter_name");
      realnameEl.setAttribute("error", "true");
    }
  },

  /**
   * This check is only done as an informative warning.
   * We don't want to block the person, if they've entered an email address
   * that doesn't conform to our regex.
   */
  onBlurEmail : function()
  {
    if (!this._email) {
      return;
    }
    var emailEl = e("email");
    if (this.validateEmail(this._email)) {
      this.clearError("emailerror");
      emailEl.removeAttribute("error");
      this.onBlurRealname();
    } else {
      this.setError("emailerror", "double_check_email");
      emailEl.setAttribute("error", "true");
    }
  },

  /**
   * If the user just tabbed through the password input without entering
   * anything, set the type back to text so we don't wind up showing the
   * emptytext as bullet characters.
   */
  onBlurPassword : function()
  {
    if (!this._password) {
      e("password").type = "text";
    }
  },

  /**
   * @see onBlurPassword()
   */
  onFocusPassword : function()
  {
    e("password").type = "password";
  },

  /**
   * Check whether the user entered the minimum of information
   * needed to leave the "start" mode (entering of name, email, pw)
   * and is allowed to proceed to detection step.
   */
  checkStartDone : function()
  {
    if (this.validateEmailMinimally(this._email) &&
        this._realname) {
      this._domain = this._email.split("@")[1].toLowerCase();
      _enable("next_button");
    } else {
      _disable("next_button");
    }
  },

  /**
   * When the [Continue] button is clicked, we move from the initial account
   * information stage to using that information to configure account details.
   */
  onNext : function()
  {
    this.findConfig(this._domain, this._email);
  },


  /////////////////////////////////////////////////////////////////
  // Detection step

  /**
   * Try to find an account configuration for this email address.
   * This is the function which runs the autoconfig.
   */
  findConfig : function(domain, email)
  {
    gEmailWizardLogger.info("findConfig()");
    if (this._abortable) {
      this.onStop();
    }
    this.switchToMode("find-config");
    this.startSpinner("looking_up_settings_disk");
    var self = this;
    this._abortable = fetchConfigFromDisk(domain,
      function(config) // success
      {
        self._abortable = null;
        self.foundConfig(config);
        self.stopSpinner("found_settings_disk");
      },
      function(e) // fetchConfigFromDisk failed
      {
        if (e instanceof CancelledException) {
          return;
        }
        gEmailWizardLogger.info("fetchConfigFromDisk failed: " + e);
        self.startSpinner("looking_up_settings_isp");
        self._abortable = fetchConfigFromISP(domain, email,
          function(config) // success
          {
            self._abortable = null;
            self.foundConfig(config);
            self.stopSpinner("found_settings_isp");
          },
          function(e) // fetchConfigFromISP failed
          {
            if (e instanceof CancelledException) {
              return;
            }
            gEmailWizardLogger.info("fetchConfigFromISP failed: " + e);
            logException(e);
            self.startSpinner("looking_up_settings_db");
            self._abortable = fetchConfigFromDB(domain,
              function(config) // success
              {
                self._abortable = null;
                self.foundConfig(config);
                self.stopSpinner("found_settings_db");
              },
              function(e) // fetchConfigFromDB failed
              {
                if (e instanceof CancelledException) {
                  return;
                }
                logException(e);
                gEmailWizardLogger.info("fetchConfigFromDB failed: " + e);
                self.startSpinner("looking_up_settings_db");
                self._abortable = fetchConfigForMX(domain,
                  function(config) // success
                  {
                    self._abortable = null;
                    self.foundConfig(config);
                    self.stopSpinner("found_settings_db");
                  },
                  function(e) // fetchConfigForMX failed
                  {
                    if (e instanceof CancelledException) {
                      return;
                    }
                    logException(e);
                    gEmailWizardLogger.info("fetchConfigForMX failed: " + e);
                    var initialConfig = new AccountConfig();
                    self._prefillConfig(initialConfig);
                    self._guessConfig(domain, initialConfig);
                  });
              });
          });
      });
  },

  /**
   * Just a continuation of findConfig()
   */
  _guessConfig : function(domain, initialConfig)
  {
    this.startSpinner("looking_up_settings_guess")
    var self = this;
    self._abortable = guessConfig(domain,
      function(type, hostname, port, ssl, done, config) // progress
      {
        gEmailWizardLogger.info("progress callback host " + hostname +
                                " port " +  port + " type " + type);
      },
      function(config) // success
      {
        self._abortable = null;
        self.foundConfig(config);
        self.stopSpinner(Services.io.offline ?
                         "guessed_settings_offline" : "found_settings_guess");
        window.sizeToContent();
      },
      function(e, config) // guessconfig failed
      {
        if (e instanceof CancelledException) {
          return;
        }
        self._abortable = null;
        gEmailWizardLogger.info("guessConfig failed: " + e);
        self.showErrorStatus("failed_to_find_settings");
        self.editConfigDetails();
      },
      initialConfig, "both");
  },

  /**
   * When findConfig() was successful, it calls this.
   * This displays the config to the user.
   */
  foundConfig : function(config)
  {
    gEmailWizardLogger.info("foundConfig()");
    assert(config instanceof AccountConfig,
        "BUG: Arg 'config' needs to be an AccountConfig object");

    this._haveValidConfigForDomain = this._email.split("@")[1];;

    if (!this._realname || !this._email) {
      return;
    }
    return this._foundConfig2(config);
  },

  // Continuation of foundConfig2() after custom fields.
  _foundConfig2 : function(config)
  {
    this.displayConfigResult(config);
  },

  /**
   * [Stop] button click handler.
   * This allows the user to abort any longer operation, esp. network activity.
   * We currently have 3 such cases here:
   * 1. findConfig(), i.e. fetch config from DB, guessConfig etc.
   * 2. onHalfManualTest(), i.e. the [Retest] button in manual config.
   * 3. verifyConfig() - We can't stop this yet, so irrelevant here currently.
   * Given that these need slightly different actions, this function will be set
   * to a function (i.e. overwritten) by whoever enables the stop button.
   *
   * We also call this from the code when the user started a different action
   * without explicitly clicking [Stop] for the old one first.
   */
  onStop : function()
  {
    throw new NotReached("onStop should be overridden by now");
  },
  _onStopCommon : function()
  {
    if (!this._abortable) {
      throw new NotReached("onStop called although there's nothing to stop");
    }
    gEmailWizardLogger.info("onStop cancelled _abortable");
    this._abortable.cancel(new UserCancelledException());
    this._abortable = null;
    this.stopSpinner();
  },
  onStopFindConfig : function()
  {
    this._onStopCommon();
    this.switchToMode("start");
    this.checkStartDone();
  },
  onStopHalfManualTesting : function()
  {
    this._onStopCommon();
    this.validateManualEditComplete();
  },



  ///////////////////////////////////////////////////////////////////
  // status area

  startSpinner : function(actionStrName)
  {
    e("status_area").setAttribute("status", "loading");
    gEmailWizardLogger.warn("spinner start " + actionStrName);
    this._showStatusTitle(actionStrName);
  },

  stopSpinner : function(actionStrName)
  {
    e("status_area").setAttribute("status", "result");
    _hide("stop_button");
    this._showStatusTitle(actionStrName);
    gEmailWizardLogger.warn("all spinner stop " + actionStrName);
  },

  showErrorStatus : function(actionStrName)
  {
    e("status_area").setAttribute("status", "error");
    gEmailWizardLogger.warn("status error " + actionStrName);
    this._showStatusTitle(actionStrName);
  },

  _showStatusTitle : function(msgName)
  {
    let msg = " "; // assure height. Do via min-height in CSS, for 2 lines?
    try {
      if (msgName) {
        msg = gStringsBundle.getFormattedString(msgName, [gBrandShortName]);
      }
    } catch(ex) {
      gEmailWizardLogger.error("missing string for " + msgName);
      msg = msgName + " (missing string in translation!)";
    }

    e("status_msg").textContent = msg;
    gEmailWizardLogger.info("status msg: " + msg);
  },



  /////////////////////////////////////////////////////////////////
  // Result area

  /**
   * Displays a (probed) config to the user,
   * in the result config details area.
   *
   * @param config {AccountConfig} The config to present to user
   */
  displayConfigResult : function(config)
  {
    assert(config instanceof AccountConfig);
    this._currentConfig = config;
    var configFilledIn = this.getConcreteConfig();

    var unknownString = gStringsBundle.getString("resultUnknown");

    function _makeHostDisplayString(server, stringName)
    {
      let type = gStringsBundle.getString(sanitize.translate(server.type,
          { imap : "resultIMAP", pop3 : "resultPOP3", smtp : "resultSMTP" }),
          unknownString);
      let host = server.hostname +
          (isStandardPort(server.port) ? "" : ":" + server.port);
      let ssl = gStringsBundle.getString(sanitize.translate(server.socketType,
          { 1 : "resultNoEncryption", 2 : "resultSSL", 3 : "resultSTARTTLS" }),
          unknownString);
      let certStatus = gStringsBundle.getString(server.badCert ?
          "resultSSLCertWeak" : "resultSSLCertOK");
      return gStringsBundle.getFormattedString(stringName,
          [ type, host, ssl, certStatus ]);
    };

    var incomingResult = unknownString;
    if (configFilledIn.incoming.hostname) {
      incomingResult = _makeHostDisplayString(configFilledIn.incoming,
          "resultIncoming");
    }

    var outgoingResult = unknownString;
    if (!config.outgoing.existingServerKey) {
      if (configFilledIn.outgoing.hostname) {
        outgoingResult = _makeHostDisplayString(configFilledIn.outgoing,
            "resultOutgoing");
      }
    } else {
      outgoingResult = gStringsBundle.getString("resultOutgoingExisting");
    }

    var usernameResult;
    if (configFilledIn.incoming.username == configFilledIn.outgoing.username) {
      usernameResult = gStringsBundle.getFormattedString("resultUsernameBoth",
            [ configFilledIn.incoming.username || unknownString ]);
    } else {
      usernameResult = gStringsBundle.getFormattedString(
            "resultUsernameDifferent",
            [ configFilledIn.incoming.username || unknownString,
              configFilledIn.outgoing.username || unknownString ]);
    }

    setText("result-incoming", incomingResult);
    setText("result-outgoing", outgoingResult);
    setText("result-username", usernameResult);

    gEmailWizardLogger.info(debugObject(config, "config"));
    // IMAP / POP dropdown
    var lookForAltType =
        config.incoming.type == "imap" ? "pop3" : "imap";
    var alternative = null;
    for (let i = 0; i < config.incomingAlternatives.length; i++) {
      let alt = config.incomingAlternatives[i];
      if (alt.type == lookForAltType) {
        alternative = alt;
        break;
      }
    }
    if (alternative) {
      _show("result_imappop");
      e("result_select_" + alternative.type).configIncoming = alternative;
      e("result_select_" + config.incoming.type).configIncoming =
          config.incoming;
      e("result_imappop").value =
          config.incoming.type == "imap" ? 1 : 2;
    } else {
      _hide("result_imappop");
    }

    this.switchToMode("result");
  },

  /**
   * Handle the user switching between IMAP and POP3 settings using the
   * radio buttons.
   *
   * Note: This function must only be called by user action, not by setting
   *       the value or selectedItem or selectedIndex of the radiogroup!
   *       This is why we use the oncommand attribute of the radio elements
   *       instead of the onselect attribute of the radiogroup.
   */
  onResultIMAPOrPOP3 : function()
  {
    var config = this._currentConfig;
    var radiogroup = e("result_imappop");
    // add current server as best alternative to start of array
    config.incomingAlternatives.unshift(config.incoming);
    // use selected server (stored as special property on the <radio> node)
    config.incoming = radiogroup.selectedItem.configIncoming;
    // remove newly selected server from list of alternatives
    config.incomingAlternatives = config.incomingAlternatives.filter(
        function(e) { return e != config.incoming; });
    this.displayConfigResult(config);
  },



  /////////////////////////////////////////////////////////////////
  // Manual Edit area

  /**
   * Gets the values from the user in the manual edit area.
   *
   * Realname and password are not part of that area and still
   * placeholders, but hostname and username are concrete and
   * no placeholders anymore.
   */
  getUserConfig : function()
  {
    var config = this.getConcreteConfig();
    if (!config) {
      config = new AccountConfig();
    }
    config.source = AccountConfig.kSourceUser;

    // Incoming server
    try {
      var inHostnameField = e("incoming_hostname");
      config.incoming.hostname = sanitize.hostname(inHostnameField.value);
      inHostnameField.value = config.incoming.hostname;
    } catch (e) { gEmailWizardLogger.warn(e); }
    try {
      config.incoming.port = sanitize.integerRange(e("incoming_port").value,
                                                   1, kHighestPort);
    } catch (e) {
      config.incoming.port = undefined; // incl. default "Auto"
    }
    config.incoming.type = sanitize.translate(e("incoming_protocol").value,
        { 1: "imap", 2 : "pop3", 0 : null });
    config.incoming.socketType = parseInt(e("incoming_ssl").value);
    config.incoming.auth = parseInt(e("incoming_authMethod").value);
    config.incoming.username = e("incoming_username").value;

    // Outgoing server

    // Did the user select one of the already configured SMTP servers from the
    // drop-down list? If so, use it.
    var outHostnameCombo = e("outgoing_hostname");
    var outMenuitem = outHostnameCombo.selectedItem;
    if (outMenuitem && outMenuitem.serverKey) {
      config.outgoing.existingServerKey = outMenuitem.serverKey;
      config.outgoing.existingServerLabel = outMenuitem.label;
      config.outgoing.addThisServer = false;
      config.outgoing.useGlobalPreferredServer = false;
    } else {
      config.outgoing.existingServerKey = null;
      config.outgoing.addThisServer = true;
      config.outgoing.useGlobalPreferredServer = false;

      try {
        config.outgoing.hostname = sanitize.hostname(
              outHostnameCombo.inputField.value);
        outHostnameCombo.inputField.value = config.outgoing.hostname;
      } catch (e) { gEmailWizardLogger.warn(e); }
      try {
        config.outgoing.port = sanitize.integerRange(e("outgoing_port").value,
              1, kHighestPort);
      } catch (e) {
        config.outgoing.port = undefined; // incl. default "Auto"
      }
      config.outgoing.socketType = e("outgoing_ssl").value;
      config.outgoing.auth = e("outgoing_authMethod").value;
      config.outgoing.username = config.incoming.username;
    }

    return config;
  },

  /**
   * [Manual Config] button click handler. This turns the config details area
   * into an editable form and makes the (Go) button appear. The edit button
   * should only be available after the config probing is completely finished,
   * replacing what was the (Stop) button.
   */
  onManualEdit : function()
  {
    if (this._abortable) {
      this.onStop();
    }
    this.editConfigDetails();
  },

  /**
   * Setting the config details form so it can be edited. We also disable
   * (and hide) the create button during this time because we don't know what
   * might have changed. The function called from the button that restarts
   * the config check should be enabling the config button as needed.
   */
  editConfigDetails : function()
  {
    gEmailWizardLogger.info("manual edit");

    if (!this._currentConfig) {
      this._currentConfig = new AccountConfig();
      this._currentConfig.incoming.type = "imap";
      this._currentConfig.incoming.username = "%EMAILLOCALPART%";
      this._currentConfig.outgoing.username = "%EMAILLOCALPART%";
      this._currentConfig.incoming.hostname = ".%EMAILDOMAIN%";
      this._currentConfig.outgoing.hostname = ".%EMAILDOMAIN%";
    }
    // Although we go manual, and we need to display the concrete username,
    // however the realname and password is not part of manual config and
    // must stay a placeholder in _currentConfig. @see getUserConfig()

    this._fillManualEditFields(this.getConcreteConfig());

    // _fillManualEditFields() indirectly calls validateManualEditComplete(),
    // but it's important to not forget it in case the code is rewritten,
    // so calling it explicitly again. Doesn't do harm, speed is irrelevant.
    this.validateManualEditComplete();
  },

  /**
   * Fills the manual edit textfields with the provided config.
   * @param config {AccountConfig} The config to present to user
   */
  _fillManualEditFields : function(config)
  {
    assert(config instanceof AccountConfig);

    // incoming server
    e("incoming_protocol").value = sanitize.translate(config.incoming.type,
                                                { "imap" : 1, "pop3" : 2 }, 1);
    e("incoming_hostname").value = config.incoming.hostname;
    e("incoming_ssl").value = sanitize.enum(config.incoming.socketType,
                                            [ 0, 1, 2, 3 ], 0);
    e("incoming_authMethod").value = sanitize.enum(config.incoming.auth,
                                                   [ 0, 3, 4, 5, 6 ], 0);
    e("incoming_username").value = config.incoming.username;
    if (config.incoming.port) {
      e("incoming_port").value = config.incoming.port;
    } else {
      this.adjustIncomingPortToSSLAndProtocol(config);
    }
    this.fillPortDropdown(config.incoming.type);

    // outgoing server
    e("outgoing_hostname").value = config.outgoing.hostname;
    e("outgoing_ssl").value = sanitize.enum(config.outgoing.socketType,
                                            [ 0, 1, 2, 3 ], 0);
    e("outgoing_authMethod").value = sanitize.enum(config.outgoing.auth,
                                                   [ 0, 1, 3, 4, 5, 6 ], 0);
    if (config.outgoing.port) {
      e("outgoing_port").value = config.outgoing.port;
    } else {
      this.adjustOutgoingPortToSSLAndProtocol(config);
    }
    // populate fields even if existingServerKey, in case user changes back

    if (config.outgoing.existingServerKey) {
      let menulist = e("outgoing_hostname");
      // We can't use menulist.value = config.outgoing.existingServerKey
      // because would overwrite the text field, so have to do it manually:
      for each (let menuitem in e("outgoing_hostname_popup").childNodes) {
        if (menuitem.serverKey == config.outgoing.existingServerKey) {
          menulist.selectedItem = menuitem;
          break;
        }
      }
    }
    this.onChangedOutgoingDropdown(); // show/hide outgoing port, SSL, ...
  },

  /**
   * Automatically fill port field in manual edit,
   * unless user entered a non-standard port.
   * @param config {AccountConfig}
   */
  adjustIncomingPortToSSLAndProtocol : function(config)
  {
    var autoPort = gStringsBundle.getString("port_auto");
    var incoming = config.incoming;
    // we could use getHostEntry() here, but that API is bad, so don't bother
    var newInPort = undefined;
    if (!incoming.port || isStandardPort(incoming.port)) {
      if (incoming.type == "imap") {
        if (incoming.socketType == 1 || incoming.socketType == 3) {
          newInPort = 143;
        } else if (incoming.socketType == 2) { // Normal SSL
          newInPort = 993;
        } else { // auto
          newInPort = autoPort;
        }
      } else if (incoming.type == "pop3") {
        if (incoming.socketType == 1 || incoming.socketType == 3) {
          newInPort = 110;
        } else if (incoming.socketType == 2) { // Normal SSLs
          newInPort = 995;
        } else { // auto
          newInPort = autoPort;
        }
      }
    }
    if (newInPort != undefined) {
      e("incoming_port").value = newInPort;
      e("incoming_authMethod").value = 0; // auto
    }
  },

  /**
   * @see adjustIncomingPortToSSLAndProtocol()
   */
  adjustOutgoingPortToSSLAndProtocol : function(config)
  {
    var autoPort = gStringsBundle.getString("port_auto");
    var outgoing = config.outgoing;
    var newOutPort = undefined;
    if (!outgoing.port || isStandardPort(outgoing.port)) {
      if (outgoing.socketType == 1 || outgoing.socketType == 3) {
        // standard port is 587 *or* 25, so set to auto
        // unless user or config already entered one of these two ports.
        if (outgoing.port != 25 && outgoing.port != 587) {
          newOutPort = autoPort;
        }
      } else if (outgoing.socketType == 2) { // Normal SSL
        newOutPort = 465;
      } else { // auto
        newOutPort = autoPort;
      }
    }
    if (newOutPort != undefined) {
      e("outgoing_port").value = newOutPort;
      e("outgoing_authMethod").value = 0; // auto
    }
  },

  /**
   * If the user changed the port manually, adjust the SSL value,
   * (only) if the new port is impossible with the old SSL value.
   * @param config {AccountConfig}
   */
  adjustIncomingSSLToPort : function(config)
  {
    var incoming = config.incoming;
    var newInSocketType = undefined;
    if (!incoming.port || // auto
        !isStandardPort(incoming.port)) {
      return;
    }
    if (incoming.type == "imap") {
      // normal SSL impossible
      if (incoming.port == 143 && incoming.socketType == 2) {
        newInSocketType = 0; // auto
      // must be normal SSL
      } else if (incoming.port == 993 && incoming.socketType != 2) {
        newInSocketType = 2;
      }
    } else if (incoming.type == "pop3") {
      // normal SSL impossible
      if (incoming.port == 110 && incoming.socketType == 2) {
        newInSocketType = 0; // auto
      // must be normal SSL
      } else if (incoming.port == 995 && incoming.socketType != 2) {
        newInSocketType = 2;
      }
    }
    if (newInSocketType != undefined) {
      e("incoming_ssl").value = newInSocketType;
      e("incoming_authMethod").value = 0; // auto
    }
  },

  /**
   * @see adjustIncomingSSLToPort()
   */
  adjustOutgoingSSLToPort : function(config)
  {
    var outgoing = config.outgoing;
    var newOutSocketType = undefined;
    if (!outgoing.port || // auto
        !isStandardPort(outgoing.port)) {
      return;
    }
    // normal SSL impossible
    if ((outgoing.port == 587 || outgoing.port == 25) &&
        outgoing.socketType == 2) {
      newOutSocketType = 0; // auto
    // must be normal SSL
    } else if (outgoing.port == 465 && outgoing.socketType != 2) {
      newOutSocketType = 2;
    }
    if (newOutSocketType != undefined) {
      e("outgoing_ssl").value = newOutSocketType;
      e("outgoing_authMethod").value = 0; // auto
    }
  },

  /**
   * Sets the prefilled values of the port fields.
   * Filled statically with the standard ports for the given protocol,
   * plus "Auto".
   */
  fillPortDropdown : function(protocolType)
  {
    var menu = e(protocolType == "smtp" ? "outgoing_port" : "incoming_port");

    // menulist.removeAllItems() is nice, but nicely clears the user value, too
    var popup = menu.menupopup;
    while (popup.hasChildNodes())
      popup.removeChild(popup.firstChild);

    // add standard ports
    var autoPort = gStringsBundle.getString("port_auto");
    menu.appendItem(autoPort, autoPort, ""); // label,value,descr
    for each (let port in getStandardPorts(protocolType)) {
      menu.appendItem(port, port, ""); // label,value,descr
    }
  },

  onChangedProtocolIncoming : function()
  {
    var config = this.getUserConfig();
    this.adjustIncomingPortToSSLAndProtocol(config);
    this.fillPortDropdown(config.incoming.type);
    this.onChangedManualEdit();
  },
  onChangedPortIncoming : function()
  {
    gEmailWizardLogger.info("incoming port changed");
    this.adjustIncomingSSLToPort(this.getUserConfig());
    this.onChangedManualEdit();
  },
  onChangedPortOutgoing : function()
  {
    gEmailWizardLogger.info("outgoing port changed");
    this.adjustOutgoingSSLToPort(this.getUserConfig());
    this.onChangedManualEdit();
  },
  onChangedSSLIncoming : function()
  {
    this.adjustIncomingPortToSSLAndProtocol(this.getUserConfig());
    this.onChangedManualEdit();
  },
  onChangedSSLOutgoing : function()
  {
    this.adjustOutgoingPortToSSLAndProtocol(this.getUserConfig());
    this.onChangedManualEdit();
  },
  onChangedAuth : function()
  {
    this.onChangedManualEdit();
  },
  onInputUsername : function()
  {
    this.onChangedManualEdit();
  },
  onInputHostname : function()
  {
    this.onChangedManualEdit();
  },

  /**
   * Sets the label of the first entry of the dropdown which represents
   * the new outgoing server.
   */
  onOpenOutgoingDropdown : function()
  {
    var menulist = e("outgoing_hostname");
    var menuitem = menulist.getItemAtIndex(0);
    assert(!menuitem.serverKey, "I wanted the special item for the new host");
    menuitem.label = menulist.inputField.value;
  },

  /**
   * User selected an existing SMTP server (or deselected it).
   * This changes only the UI. The values are read in getUserConfig().
   */
  onChangedOutgoingDropdown : function()
  {
    var menulist = e("outgoing_hostname");
    var menuitem = menulist.selectedItem;
    if (menuitem && menuitem.serverKey) {
      // an existing server has been selected from the dropdown
      menulist.setAttribute("editable", false);
      _hide("outgoing_port");
      _hide("outgoing_ssl");
      _hide("outgoing_authMethod");
    } else {
      // new server, with hostname, port etc.
      menulist.setAttribute("editable", true);
      _show("outgoing_port");
      _show("outgoing_ssl");
      _show("outgoing_authMethod");
    }

    this.onChangedManualEdit();
  },

  onChangedManualEdit : function()
  {
    if (this._abortable) {
      this.onStop();
    }
    this.validateManualEditComplete();
  },

  /**
   * This enables the buttons which allow the user to proceed
   * once he has entered enough information.
   *
   * We can easily and faily surely autodetect everything apart from the
   * hostname (and username). So, once the user has entered
   * proper hostnames, change to "manual-edit-have-hostname" mode
   * which allows to press [Re-test], which starts the detection
   * of the other values.
   * Once the user has entered (or we detected) all values, he may
   * do [Create Account] (tests login and if successful creates the account)
   * or [Advanced Setup] (goes to Account Manager). Esp. in the latter case,
   * we will not second-guess his setup and just to as told, so here we make
   * sure that he at least entered all values.
   */
  validateManualEditComplete : function()
  {
    // getUserConfig() is expensive, but still OK, not a problem
    var manualConfig = this.getUserConfig();
    this._currentConfig = manualConfig;
    if (manualConfig.isComplete()) {
      this.switchToMode("manual-edit-complete");
    } else if (!!manualConfig.incoming.hostname &&
               !!manualConfig.outgoing.hostname) {
      this.switchToMode("manual-edit-have-hostname");
    } else {
      this.switchToMode("manual-edit");
    }
  },

  /**
   * [Switch to provisioner] button click handler. Always active, allows
   * one to switch to the account provisioner screen.
   */
  onSwitchToProvisioner : function ()
  {
    // We have to close this window first, otherwise msgNewMailAccount
    // in accountUtils.js will think that this window still
    // exists when it's called from the account provisioner window.
    // This is because the account provisioner window is modal,
    // and therefore blocks.  Therefore, we override the _okCallback
    // with a function that spawns the account provisioner, and then
    // close the window.
    this._okCallback = function() {
      NewMailAccountProvisioner(window.arguments[0].msgWindow, window.arguments[0].extraData);
    }
    window.close();
  },

  /**
   * [Advanced Setup...] button click handler
   * Only active in manual edit mode, and goes straight into
   * Account Settings (pref UI) dialog. Requires a backend account,
   * which requires proper hostname, port and protocol.
   */
  onAdvancedSetup : function()
  {
    assert(this._currentConfig instanceof AccountConfig);
    var configFilledIn = this.getConcreteConfig();

    if (checkIncomingServerAlreadyExists(configFilledIn)) {
      alertPrompt(gStringsBundle.getString("error_creating_account"),
                  gStringsBundle.getString("incoming_server_exists"));
      return;
    }

    gEmailWizardLogger.info("creating account in backend");
    var newAccount = createAccountInBackend(configFilledIn);

    var windowManager = Cc["@mozilla.org/appshell/window-mediator;1"]
        .getService(Ci.nsIWindowMediator);
    var existingAccountManager = windowManager
        .getMostRecentWindow("mailnews:accountmanager");
    if (existingAccountManager) {
      existingAccountManager.focus();
    } else {
      window.openDialog("chrome://messenger/content/AccountManager.xul",
                        "AccountManager", "chrome,centerscreen,modal,titlebar",
                        { server: newAccount.incomingServer,
                          selectPage: "am-server.xul" });
    }
    window.close();
  },

  /**
   * [Re-test] button click handler.
   * Restarts the config guessing process after a person editing the server
   * fields.
   * It's called "half-manual", because we take the user-entered values
   * as given and will not second-guess them, to respect the user wishes.
   * (Yes, Sir! Will do as told!)
   * The values that the user left empty or on "Auto" will be guessed/probed
   * here. We will also check that the user-provided values work.
   */
  onHalfManualTest : function()
  {
    var newConfig = this.getUserConfig();
    gEmailWizardLogger.info(debugObject(newConfig, "manualConfigToTest"));
    this.startSpinner("looking_up_settings_halfmanual");
    this.switchToMode("manual-edit-testing");
    // if (this._userPickedOutgoingServer) TODO
    var self = this;
    this._abortable = guessConfig(this._domain,
      function(type, hostname, port, ssl, done, config) // progress
      {
        gEmailWizardLogger.info("progress callback host " + hostname +
                                " port " +  port + " type " + type);
      },
      function(config) // success
      {
        self._abortable = null;
        self._fillManualEditFields(config);
        self.switchToMode("manual-edit-complete");
        self.stopSpinner("found_settings_halfmanual");
      },
      function(e, config) // guessconfig failed
      {
        if (e instanceof CancelledException) {
          return;
        }
        self._abortable = null;
        gEmailWizardLogger.info("guessConfig failed: " + e);
        self.showErrorStatus("failed_to_find_settings");
        self.switchToMode("manual-edit-have-hostname");
      },
      newConfig,
      newConfig.outgoing.existingServerKey ? "incoming" : "both");
  },



  /////////////////////////////////////////////////////////////////
  // UI helper functions

  _prefillConfig : function(initialConfig)
  {
    var emailsplit = this._email.split("@");
    assert(emailsplit.length > 1);
    var emaillocal = sanitize.nonemptystring(emailsplit[0]);
    initialConfig.incoming.username = emaillocal;
    initialConfig.outgoing.username = emaillocal;
    return initialConfig;
  },

  clearError : function(which)
  {
    _hide(which);
    _hide(which + "icon");
    e(which).textContent = "";
  },

  setError : function(which, msg_name)
  {
    try {
      _show(which);
      _show(which + "icon");
      e(which).textContent = gStringsBundle.getString(msg_name);
    } catch (ex) { alertPrompt("missing error string", msg_name); }
  },



  /////////////////////////////////////////////////////////////////
  // Finish & dialog close functions

  onKeyDown : function(event)
  {
    let key = event.keyCode;
    if (key == 27) { // Escape key
      this.onCancel();
      return true;
    }
    if (key == 13) { // OK key
      let buttons = [
        { id: "next_button", action: makeCallback(this, this.onNext) },
        { id: "create_button", action: makeCallback(this, this.onCreate) },
        { id: "half-manual-test_button",
          action: makeCallback(this, this.onHalfManualTest) },
      ];
      for each (let button in buttons) {
        button.e = e(button.id);
        if (button.e.hidden || button.e.disabled) {
          continue;
        }
        button.action();
        return true;
      }
    }
    return false;
  },

  onCancel : function()
  {
    window.close();
    // The window onclose handler will call onWizardShutdown for us.
  },

  onWizardShutdown : function()
  {
    if (this._abortable) {
      this._abortable.cancel(new UserCancelledException());
    }

    if (this._okCallback) {
      this._okCallback();
    }
    gEmailWizardLogger.info("Shutting down email config dialog");
  },


  onCreate : function()
  {
    try {
      gEmailWizardLogger.info("Create button clicked");

      var configFilledIn = this.getConcreteConfig();
      var self = this;
      // If the dialog is not needed, it will go straight to OK callback
      gSecurityWarningDialog.open(this._currentConfig, configFilledIn, true,
        function() // on OK
        {
          self.validateAndFinish(configFilledIn);
        },
        function() {}); // on cancel, do nothing
    } catch (ex) {
      gEmailWizardLogger.error("Error creating account.  ex=" + ex +
                               ", stack=" + ex.stack);
      alertPrompt(gStringsBundle.getString("error_creating_account"), ex);
    }
  },

  // called by onCreate()
  validateAndFinish : function()
  {
    var configFilledIn = this.getConcreteConfig();

    if (checkIncomingServerAlreadyExists(configFilledIn)) {
      alertPrompt(gStringsBundle.getString("error_creating_account"),
                  gStringsBundle.getString("incoming_server_exists"));
      return;
    }

    if (configFilledIn.outgoing.addThisServer) {
      let existingServer = checkOutgoingServerAlreadyExists(configFilledIn);
      if (existingServer) {
        configFilledIn.outgoing.addThisServer = false;
        configFilledIn.outgoing.existingServerKey = existingServer.key;
      }
    }

    // TODO use a UI mode (switchToMode()) for verfication, too.
    // But we need to go back to the previous mode, because we might be in
    // "result" or "manual-edit-complete" mode.
    _disable("create_button");
    _disable("half-manual-test_button");
    _disable("advanced-setup_button");
    // no stop button: backend has no ability to stop :-(
    var self = this;
    this.startSpinner("checking_password");
    // logic function defined in verifyConfig.js
    verifyConfig(
      configFilledIn,
      // guess login config?
      configFilledIn.source != AccountConfig.kSourceXML,
      // TODO Instead, the following line would be correct, but I cannot use it,
      // because some other code doesn't adhere to the expectations/specs.
      // Find out what it was and fix it.
      //concreteConfig.source == AccountConfig.kSourceGuess,
      this._parentMsgWindow,
      function(successfulConfig) // success
      {
        self.stopSpinner(successfulConfig.incoming.password ?
                         "password_ok" : null);

        // the auth might have changed, so we
        // should back-port it to the current config.
        self._currentConfig.incoming.auth = successfulConfig.incoming.auth;
        self._currentConfig.outgoing.auth = successfulConfig.outgoing.auth;
        self.finish();
      },
      function(e) // failed
      {
        self.showErrorStatus("config_unverifiable");
        // TODO bug 555448: wrong error msg, there may be a 1000 other
        // reasons why this failed, and this is misleading users.
        self.setError("passworderror", "user_pass_invalid");
        // TODO use switchToMode(), see above
        // give user something to proceed after fixing
        _enable("create_button");
        // hidden in non-manual mode, so it's fine to enable
        _enable("half-manual-test_button");
        _enable("advanced-setup_button");
      });
  },

  finish : function()
  {
    gEmailWizardLogger.info("creating account in backend");
    createAccountInBackend(this.getConcreteConfig());
    window.close();
  },
};

var gEmailConfigWizard = new EmailConfigWizard();
gEmailWizardLogger.info("email account setup dialog");


function serverMatches(a, b)
{
  return a.type == b.type &&
         a.hostname == b.hostname &&
         a.port == b.port &&
         a.socketType == b.socketType &&
         a.auth == b.auth;
}

var _gStandardPorts = {};
_gStandardPorts["imap"] = [ 143, 993 ];
_gStandardPorts["pop3"] = [ 110, 995 ];
_gStandardPorts["smtp"] = [ 587, 25, 465 ]; // order matters
var _gAllStandardPorts = _gStandardPorts["smtp"]
    .concat(_gStandardPorts["imap"]).concat(_gStandardPorts["pop3"]);

function isStandardPort(port)
{
  return _gAllStandardPorts.indexOf(port) != -1;
}

function getStandardPorts(protocolType)
{
  return _gStandardPorts[protocolType];
}


/**
 * Warning dialog, warning user about lack of, or inappropriate, encryption.
 *
 * This is effectively a separate dialog, but implemented as part of
 * this dialog. It works by hiding the main dialog part and unhiding
 * the this part, and vice versa, and resizing the dialog.
 */
function SecurityWarningDialog()
{
  this._acknowledged = new Array();
}
SecurityWarningDialog.prototype =
{
  /**
   * {Array of {(incoming or outgoing) server part of {AccountConfig}}
   * A list of the servers for which we already showed this dialog and the
   * user approved the configs. For those, we won't show the warning again.
   * (Make sure to store a copy in case the underlying object is changed.)
   */
  _acknowledged : null,

  /**
   * Checks whether we need to warn about this config.
   *
   * We (currently) warn if
   * - the mail travels unsecured (no SSL/STARTTLS)
   * - the SSL certificate is not proper
   * - (We don't warn about unencrypted passwords specifically,
   *   because they'd be encrypted with SSL and without SSL, we'd
   *   warn anyways.)
   *
   * We may not warn despite these conditions if we had shown the
   * warning for that server before and the user acknowledged it.
   * (Given that this dialog object is static/global and persistent,
   * we can store that approval state here in this object.)
   *
   * @param configSchema @see open()
   * @param configFilledIn @see open()
   * @returns {Boolean}   true when the dialog should be shown
   *      (call open()). if false, the dialog can and should be skipped.
   */
  needed : function(configSchema, configFilledIn)
  {
    assert(configSchema instanceof AccountConfig);
    assert(configFilledIn instanceof AccountConfig);
    assert(configSchema.isComplete());
    assert(configFilledIn.isComplete());

    var incomingOK = configFilledIn.incoming.socketType > 1 &&
        !configFilledIn.incoming.badCert;
    var outgoingOK = configFilledIn.outgoing.socketType > 1 &&
        !configFilledIn.outgoing.badCert;

    if (!incomingOK) {
      incomingOK = this._acknowledged.some(
          function(ackServer) {
            return serverMatches(ackServer, configFilledIn.incoming);
          });
    }
    if (!outgoingOK) {
      outgoingOK = this._acknowledged.some(
          function(ackServer) {
            return serverMatches(ackServer, configFilledIn.outgoing);
          });
    }
    return !incomingOK || !outgoingOK;
  },

  /**
   * Opens the dialog, fills it with values, and shows it to the user.
   *
   * The function is async: it returns immediately, and when the user clicks
   * OK or Cancel, the callbacks are called. There the callers proceed as
   * appropriate.
   *
   * @param configSchema   The config, with placeholders not replaced yet.
   *      This object may be modified to store the user's confirmations, but
   *      currently that's not the case.
   * @param configFilledIn   The concrete config with placeholders replaced.
   * @param onlyIfNeeded {Boolean}   If there is nothing to warn about,
   *     call okCallback() immediately (and sync).
   * @param okCallback {function(config {AccountConfig})}
   *      Called when the user clicked OK and approved the config including
   *      the warnings. |config| is without placeholders replaced.
   * @param cancalCallback {function()}
   *      Called when the user decided to heed the warnings and not approve.
   */
  open : function(configSchema, configFilledIn, onlyIfNeeded,
                  okCallback, cancelCallback)
  {
    assert(typeof(okCallback) == "function");
    assert(typeof(cancelCallback) == "function");
    // needed() also checks the parameters
    var needed = this.needed(configSchema, configFilledIn);
    if (!needed && onlyIfNeeded) {
      okCallback();
      return;
    }
    assert(needed, "security dialog opened needlessly");
    this._currentConfigFilledIn = configFilledIn;
    this._okCallback = okCallback;
    this._cancelCallback = cancelCallback;
    var incoming = configFilledIn.incoming;
    var outgoing = configFilledIn.outgoing;

    _hide("mastervbox");
    _show("warningbox");
    // reset dialog, in case we've shown it before
    e("acknowledge_warning").checked = false;
    _disable("iknow");
    e("incoming_technical").removeAttribute("expanded");
    e("incoming_details").setAttribute("collapsed", true);
    e("outgoing_technical").removeAttribute("expanded");
    e("outgoing_details").setAttribute("collapsed", true);

    if (incoming.socketType == 1) {
      setText("warning_incoming", gStringsBundle.getFormattedString(
          "cleartext_warning", [incoming.hostname]));
      setText("incoming_details", gStringsBundle.getString(
          "cleartext_details"));
      _show("incoming_box");
      _show("acknowledge_warning");
    } else if (incoming.badCert) {
      setText("warning_incoming", gStringsBundle.getFormattedString(
          "selfsigned_warning", [incoming.hostname]));
      setText("incoming_details", gStringsBundle.getString(
          "selfsigned_details"));
      _show("incoming_box");
      _show("acknowledge_warning");
    } else {
      _hide("incoming_box");
      _hide("acknowledge_warning");
    }

    if (outgoing.socketType == 1) {
      setText("warning_outgoing", gStringsBundle.getFormattedString(
          "cleartext_warning", [outgoing.hostname]));
      setText("outgoing_details", gStringsBundle.getString(
          "cleartext_details"));
      _show("outgoing_box");
      _show("acknowledge_warning");
    } else if (outgoing.badCert) {
      setText("warning_outgoing", gStringsBundle.getFormattedString(
          "selfsigned_warning", [outgoing.hostname]));
      setText("outgoing_details", gStringsBundle.getString(
          "selfsigned_details"));
      _show("outgoing_box");
      _show("acknowledge_warning");
    } else {
      _hide("outgoing_box");
    }
    window.sizeToContent();
  },

  toggleDetails : function (id)
  {
    let details = e(id + "_details");
    let tech = e(id + "_technical");
    if (details.getAttribute("collapsed")) {
      details.removeAttribute("collapsed");
      tech.setAttribute("expanded", true);
    } else {
      details.setAttribute("collapsed", true);
      tech.removeAttribute("expanded");
    }
  },

  /**
   * user checked checkbox that he understood it and wishes
   * to ignore the warning.
   */
  toggleAcknowledge : function()
  {
    if (e("acknowledge_warning").checked) {
      _enable("iknow");
    } else {
      _disable("iknow");
    }
  },

  /**
   * [Cancel] button pressed. Get me out of here!
   */
  onCancel : function()
  {
    _hide("warningbox");
    _show("mastervbox");
    window.sizeToContent();

    this._cancelCallback();
  },

  /**
   * [OK] button pressed.
   * Implies that the user toggled the acknowledge checkbox,
   * i.e. approved the config and ignored the warnings,
   * otherwise the button would have been disabled.
   */
  onOK : function()
  {
    assert(e("acknowledge_warning").checked);

    var overrideOK = this.showCertOverrideDialog(this._currentConfigFilledIn);
    if (!overrideOK) {
      this.onCancel();
      return;
    }

    // need filled in, in case hostname is placeholder
    var storeConfig = this._currentConfigFilledIn.copy();
    this._acknowledged.push(storeConfig.incoming);
    this._acknowledged.push(storeConfig.outgoing);

    _show("mastervbox");
    _hide("warningbox");
    window.sizeToContent();

    this._okCallback();
  },

  /**
   * Shows a(nother) dialog which allows the user to see and override
   * (manually accept) a bad certificate. It also optionally adds it
   * permanently to the "good certs" store of NSS in the profile.
   * Only shows the dialog, if there are bad certs. Otherwise, it's a no-op.
   *
   * The dialog is the standard PSM cert override dialog.
   *
   * @param config {AccountConfig} concrete
   * @returns true, if all certs are fine or the user accepted them.
   *     false, if the user cancelled.
   *
   * static function
   * sync function: blocks until the dialog is closed.
   */
  showCertOverrideDialog : function(config)
  {
    if (config.incoming.socketType > 1 && // SSL or STARTTLS
        config.incoming.badCert) {
      var params = {
        exceptionAdded : false,
        prefetchCert : true,
        location : config.incoming.targetSite,
      };
      window.openDialog("chrome://pippki/content/exceptionDialog.xul",
                        "","chrome,centerscreen,modal", params);
      if (params.exceptionAdded) { // set by dialog
        config.incoming.badCert = false;
      } else {
        return false;
      }
    }
    if (!config.outgoing.existingServerKey) {
      if (config.outgoing.socketType > 1 && // SSL or STARTTLS
          config.outgoing.badCert) {
        var params = {
          exceptionAdded : false,
          prefetchCert : true,
          location : config.outgoing.targetSite,
        };
        window.openDialog("chrome://pippki/content/exceptionDialog.xul",
                          "","chrome,centerscreen,modal", params);
        if (params.exceptionAdded) { // set by dialog
          config.outgoing.badCert = false;
        } else {
          return false;
        }
      }
    }
    return true;
  },
}
var gSecurityWarningDialog = new SecurityWarningDialog();
