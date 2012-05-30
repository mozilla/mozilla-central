/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gPrefsBundle;

function acctNamePageValidate() 
{
  var accountname = document.getElementById("prettyName").value;
  var canAdvance = accountname ? true : false;

  document.documentElement.canAdvance = canAdvance;
}

function acctNamePageUnload() {
  var pageData = parent.GetPageData();

  // fix for bug #255473
  // allow for multiple RSS accounts.
  // if our isp.rdf file defines "wizardAutoGenerateUniqueHostname"
  // we generate a unique hostname until we have one that doesn't exist
  // for RSS accounts, in rss.rdf, userName, hostName and serverType
  // default to the same thing, so we need to do this to allow for
  // multiple RSS accounts.  Note, they can all have the same pretty name.
  if (gCurrentAccountData && 
      gCurrentAccountData.wizardAutoGenerateUniqueHostname) 
  {
    var serverType = parent.getCurrentServerType(pageData);
    var userName = parent.getCurrentUserName(pageData);
    var hostName = parent.getCurrentHostname(pageData);
    var hostNamePref = hostName;
    var i = 2;
    while (parent.AccountExists(userName, hostName, serverType)) 
    {
      // If "Feeds" exists, try "Feeds-2", then "Feeds-3", etc.
      hostName = hostNamePref + "-" + i;
      i++;
    }
    setPageData(pageData, "server", "hostname", hostName);
  }

  var accountname = document.getElementById("prettyName").value;
  setPageData(pageData, "accname", "prettyName", accountname);
  // Set this to true so we know the user has set the name.
  setPageData(pageData, "accname", "userset", true);
  return true;
}

function acctNamePageInit()
{
    gPrefsBundle = document.getElementById("bundle_prefs");
    var accountNameInput = document.getElementById("prettyName");
    if (accountNameInput.value=="") {
        var pageData = parent.GetPageData();
        var type = parent.getCurrentServerType(pageData);
        var accountName;

        if (gCurrentAccountData && gCurrentAccountData.wizardAccountName)
            accountName = gCurrentAccountData.wizardAccountName;
        else if (type == "nntp") 
            accountName = pageData.newsserver.hostname.value;
        else
            accountName = pageData.identity.email.value;
        accountNameInput.value = accountName;
    }
    acctNamePageValidate();
}
