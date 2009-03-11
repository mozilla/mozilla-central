# -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is the Thunderbird Preferences System.
#
# The Initial Developer of the Original Code is
# Scott MacGregor.
# Portions created by the Initial Developer are Copyright (C) 2005
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Scott MacGregor <mscott@mozilla.org>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

var gSecurityPane = {
  mPane: null,
  mInitialized: false,

  init: function ()
  {
    this.mPane = document.getElementById("paneSecurity");

    this.updateManualMarkMode(document.getElementById('manualMark').checked);
    this.updateJunkLogButton(document.getElementById('enableJunkLogging').checked);

    this._initMasterPasswordUI();

    // update the checkbox for downloading phishing url tables
    // this.updateDownloadedPhishingListState();

    var preference = document.getElementById("mail.preferences.security.selectedTabIndex");
    if (preference.value)
      document.getElementById("securityPrefs").selectedIndex = preference.value;
    this.mInitialized = true;
  },

  tabSelectionChanged: function ()
  {
    if (this.mInitialized)
      document.getElementById("mail.preferences.security.selectedTabIndex")
              .valueFromPreferences = document.getElementById("securityPrefs").selectedIndex;
  },

  updateManualMarkMode: function(aEnableRadioGroup)
  {
    document.getElementById('manualMarkMode').disabled = !aEnableRadioGroup;
  },

  updateJunkLogButton: function(aEnableButton)
  {
    document.getElementById('openJunkLogButton').disabled = !aEnableButton;
  },

  openJunkLog: function()
  {
    document.documentElement.openWindow("mailnews:junklog", "chrome://messenger/content/preferences/junkLog.xul",
                                        "", null);
  },

  resetTrainingData: function()
  {
    // make sure the user really wants to do this
    var promptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                          .getService(Components.interfaces.nsIPromptService);
    var bundle = document.getElementById("bundlePreferences");
    var title = bundle.getString("confirmResetJunkTrainingTitle");
    var text = bundle.getString("confirmResetJunkTrainingText");

    // if the user says no, then just fall out
    if (!promptService.confirm(window, title, text))
      return;

    // otherwise go ahead and remove the training data
    var junkmailPlugin = Components.classes["@mozilla.org/messenger/filter-plugin;1?name=bayesianfilter"]
                        .getService(Components.interfaces.nsIJunkMailPlugin);

    if (junkmailPlugin)
      junkmailPlugin.resetTrainingData();
  },


  /**
   * Initializes master password UI: the "use master password" checkbox, selects
   * the master password button to show, and enables/disables it as necessary.
   * The master password is controlled by various bits of NSS functionality,
   * so the UI for it can't be controlled by the normal preference bindings.
   */
  _initMasterPasswordUI: function ()
  {
    var noMP = !this._masterPasswordSet();

    document.getElementById("changeMasterPassword").disabled = noMP;

    document.getElementById("useMasterPassword").checked = !noMP;
  },


  /**
   * Returns true if the user has a master password set and false otherwise.
   */
  _masterPasswordSet: function ()
  {
    const Cc = Components.classes, Ci = Components.interfaces;
    var secmodDB = Cc["@mozilla.org/security/pkcs11moduledb;1"].
                   getService(Ci.nsIPKCS11ModuleDB);
    var slot = secmodDB.findSlotByName("");
    if (slot) {
      var status = slot.status;
      var hasMP = status != Ci.nsIPKCS11Slot.SLOT_UNINITIALIZED &&
                  status != Ci.nsIPKCS11Slot.SLOT_READY;
      return hasMP;
    } else {
      // XXX I have no bloody idea what this means
      return false;
    }
  },


  /**
   * Enables/disables the master password button depending on the state of the
   * "use master password" checkbox, and prompts for master password removal
   * if one is set.
   */
  updateMasterPasswordButton: function ()
  {
    var checkbox = document.getElementById("useMasterPassword");
    var button = document.getElementById("changeMasterPassword");
    button.disabled = !checkbox.checked;

    // unchecking the checkbox should try to immediately remove the master
    // password, because it's impossible to non-destructively remove the master
    // password used to encrypt all the passwords without providing it (by
    // design), and it would be extremely odd to pop up that dialog when the
    // user closes the prefwindow and saves his settings
    if (!checkbox.checked)
      this._removeMasterPassword();
    else
      this.changeMasterPassword();

    this._initMasterPasswordUI();
  },

  /**
   * Displays the "remove master password" dialog to allow the user to remove
   * the current master password.  When the dialog is dismissed, master password
   * UI is automatically updated.
   */
  _removeMasterPassword: function ()
  {
    const Cc = Components.classes, Ci = Components.interfaces;
    var secmodDB = Cc["@mozilla.org/security/pkcs11moduledb;1"].
                   getService(Ci.nsIPKCS11ModuleDB);
    if (secmodDB.isFIPSEnabled) {
      var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].
                          getService(Ci.nsIPromptService);
      var bundle = document.getElementById("bundlePreferences");
      promptService.alert(window,
                          bundle.getString("pw_change_failed_title"),
                          bundle.getString("pw_change2empty_in_fips_mode"));
    }
    else {
      document.documentElement.openSubDialog("chrome://mozapps/content/preferences/removemp.xul",
                                             "", null);
    }
    this._initMasterPasswordUI();
  },

  /**
   * Displays a dialog in which the master password may be changed.
   */
  changeMasterPassword: function ()
  {
    document.documentElement.openSubDialog("chrome://mozapps/content/preferences/changemp.xul",
                                           "", null);
    this._initMasterPasswordUI();
  },

  /**
   * Shows the sites where the user has saved passwords and the associated
   * login information.
   */
  showPasswords: function ()
  {
    document.documentElement.openWindow("Toolkit:PasswordManager",
                                        "chrome://passwordmgr/content/passwordManager.xul",
                                        "", null);
  },

  updateDownloadedPhishingListState: function()
  {
    document.getElementById('useDownloadedList').disabled = !document.getElementById('enablePhishingDetector').checked;
  }
};
