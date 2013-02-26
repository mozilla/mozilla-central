/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This dialog can only be opened if we have a shell service.

let gSystemIntegrationDialog = {
  _shellSvc: Components.classes["@mozilla.org/mail/shell-service;1"]
                       .getService(Components.interfaces.nsIShellService),

  _mailCheckbox: null,

  _newsCheckbox: null,

  _rssCheckbox: null,

  _startupCheckbox: null,

  _searchCheckbox: null,

  onLoad: function()
  {
    // Makes Services and SearchIntegration accessible via this.Services
    // and this.SearchIntegration.
    Components.utils.import("resource://gre/modules/Services.jsm", this);
    Components.utils.import("resource:///modules/SearchIntegration.js", this);

    // initialize elements
    this._mailCheckbox    = document.getElementById("checkMail");
    this._newsCheckbox    = document.getElementById("checkNews");
    this._rssCheckbox     = document.getElementById("checkRSS");
    this._startupCheckbox = document.getElementById("checkOnStartup");
    this._searchCheckbox  = document.getElementById("searchIntegration");

    // Initialize the check boxes based on the default app states.
    this._mailCheckbox.disabled =
      this._shellSvc.isDefaultClient(false, this._shellSvc.MAIL);

    if (!("arguments" in window) || (window.arguments[0] != "calledFromPrefs")) {
      // As an optimization, if we aren't already the default mail client,
      // then pre-check that option for the user. We'll leave News and RSS alone.
      // Do this only if we are not called from the Preferences (Options) dialog.
      // In that case, the user may want to just check what the current state is.
      this._mailCheckbox.checked = true;
    } else {
      this._mailCheckbox.checked = this._mailCheckbox.disabled;

      // If called from preferences, use only a simpler "Cancel" label on the
      // cancel button.
      document.documentElement.getButton("cancel").label =
        document.documentElement.getAttribute("buttonlabelcancel2");
    }

    if (!this._mailCheckbox.disabled)
      this._mailCheckbox.removeAttribute("tooltiptext");

    this._newsCheckbox.checked = this._newsCheckbox.disabled =
      this._shellSvc.isDefaultClient(false, this._shellSvc.NEWS);
    if (!this._newsCheckbox.disabled)
      this._newsCheckbox.removeAttribute("tooltiptext");

    this._rssCheckbox.checked  = this._rssCheckbox.disabled  =
      this._shellSvc.isDefaultClient(false, this._shellSvc.RSS);
    if (!this._rssCheckbox.disabled)
      this._rssCheckbox.removeAttribute("tooltiptext");

    // read the raw pref value and not shellSvc.shouldCheckDefaultMail
    this._startupCheckbox.checked =
      this.Services.prefs.getBoolPref("mail.shell.checkDefaultClient");

    // Search integration - check whether we should show/disable integration options
    if (this.SearchIntegration)
    {
      this._searchCheckbox.checked = this.SearchIntegration.prefEnabled;
      if (!this.SearchIntegration.osVersionTooLow) {
        this._searchCheckbox.hidden = false;
        if (this.SearchIntegration.osComponentsNotRunning)
        {
          this._searchCheckbox.checked = false;
          this._searchCheckbox.disabled = true;
        }
      }
    }
  },

  /**
   * Called when the dialog is closed by any button.
   *
   * @param aSetAsDefault  If true, set TB as the default application for the
   *                       checked actions (mail/news/rss). Otherwise do nothing.
   */
  onDialogClose: function(aSetAsDefault)
  {
    // In all cases, save the user's decision for "always check at startup".
    this._shellSvc.shouldCheckDefaultClient = this._startupCheckbox.checked;

    // If the "skip integration" button was used do not set any defaults
    // and close the dialog.
    if (!aSetAsDefault)
      return true;

    // For each checked item, if we aren't already the default client,
    // make us the default.
    let appTypes = 0;

    if (this._mailCheckbox.checked &&
        !this._shellSvc.isDefaultClient(false, this._shellSvc.MAIL))
      appTypes |= this._shellSvc.MAIL;

    if (this._newsCheckbox.checked &&
        !this._shellSvc.isDefaultClient(false, this._shellSvc.NEWS))
      appTypes |= this._shellSvc.NEWS;

    if (this._rssCheckbox.checked &&
        !this._shellSvc.isDefaultClient(false, this._shellSvc.RSS))
      appTypes |= this._shellSvc.RSS;

    if (appTypes)
      this._shellSvc.setDefaultClient(false, appTypes);

    // Set the search integration pref if it is changed.
    // The integration will handle the rest.
    if (!this._searchCheckbox.hidden)
    {
      this.SearchIntegration.prefEnabled = this._searchCheckbox.checked;
      this.SearchIntegration.firstRunDone = true;
    }

    return true;
  }
};
