/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// this dialog can only be opened if we have a shell service

var gSystemIntegrationDialog = {
  /// Whether the search integration checkbox is disabled or hidden
  _searchCheckboxInactive: false,
  
  onLoad: function () 
  {
    var nsIShellService = Components.interfaces.nsIShellService;
    var shellSvc = Components.classes["@mozilla.org/mail/shell-service;1"]
                             .getService(nsIShellService);
                               
    // initialize the check boxes based on the default app states.
    var mailCheckbox = document.getElementById('checkMail');
    var newsCheckbox = document.getElementById('checkNews');
    var rssCheckbox = document.getElementById('checkRSS');
    
    mailCheckbox.disabled = shellSvc.isDefaultClient(false, nsIShellService.MAIL);
    // as an optimization, if we aren't already the default mail client, then pre-check that option
    // for the user. We'll leave news and RSS alone.
    mailCheckbox.checked = true;
    newsCheckbox.checked = newsCheckbox.disabled = shellSvc.isDefaultClient(false, nsIShellService.NEWS);
    rssCheckbox.checked  = rssCheckbox.disabled  = shellSvc.isDefaultClient(false, nsIShellService.RSS);       
    
    // read the raw pref value and not shellSvc.shouldCheckDefaultMail
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefBranch);
    document.getElementById('checkOnStartup').checked = prefs.getBoolPref("mail.shell.checkDefaultClient");

    // Search integration -- check whether we should hide or disable integration
    let hideSearchUI = false;
    let disableSearchUI = false;
    Components.utils.import("resource:///modules/SearchIntegration.js");
    if (SearchIntegration)
    {
      if (SearchIntegration.osVersionTooLow)
        hideSearchUI = true;
      else if (SearchIntegration.osComponentsNotRunning)
        disableSearchUI = true;
    }
    else
    {
      hideSearchUI = true;
    }

    let searchCheckbox = document.getElementById("searchIntegration");

    if (hideSearchUI)
    {
      this._searchCheckboxInactive = true;
      document.getElementById("searchIntegrationContainer").hidden = true;
    }
    else if (disableSearchUI)
    {
      this._searchCheckboxInactive = true;
      searchCheckbox.checked = false;
      searchCheckbox.disabled = true;
    }
    else
    {
      searchCheckbox.checked = SearchIntegration.prefEnabled;
    }
  },
  
  onAccept: function()
  {
    // for each checked item, if we aren't already the default, make us the default.
    var nsIShellService = Components.interfaces.nsIShellService;    
    var shellSvc = Components.classes["@mozilla.org/mail/shell-service;1"]
                             .getService(nsIShellService);
    var appTypes = 0;                            
    if (document.getElementById('checkMail').checked && !shellSvc.isDefaultClient(false, nsIShellService.MAIL))
      appTypes |= nsIShellService.MAIL;
    if (document.getElementById('checkNews').checked && !shellSvc.isDefaultClient(false, nsIShellService.NEWS))
      appTypes |= nsIShellService.NEWS;
    if (document.getElementById('checkRSS').checked &&  !shellSvc.isDefaultClient(false, nsIShellService.RSS))
      appTypes |= nsIShellService.RSS;
    
    if (appTypes)
      shellSvc.setDefaultClient(false, appTypes);

    shellSvc.shouldCheckDefaultClient = document.getElementById('checkOnStartup').checked;
    
    // Set the search integration pref if it's changed
    // The integration will handle the rest
    if (!this._searchCheckboxInactive)
    {
      SearchIntegration.prefEnabled = document.getElementById("searchIntegration").checked;
      SearchIntegration.firstRunDone = true;
    }
  }
};
