/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function setAccountTypeData() 
{
  var rg = document.getElementById("acctyperadio");
  var selectedItemId = rg.selectedItem.id;
  var mail = selectedItemId == "mailaccount";
  var news = selectedItemId == "newsaccount";

  var pageData = parent.GetPageData();
  setPageData(pageData, "accounttype", "mailaccount", mail);
  setPageData(pageData, "accounttype", "newsaccount", news);

  // Other account type, e.g. Movemail
  setPageData(pageData, "accounttype", "otheraccount", !(news || mail));
}

function acctTypePageUnload() {
    gCurrentAccountData = null;
    setAccountTypeData();
    initializeIspData();
    setupWizardPanels();
    return true;
}

function setupWizardPanels() {
    if (gCurrentAccountData && gCurrentAccountData.useOverlayPanels) {
      if ("testingIspServices" in this) {
        if ("SetPageMappings" in this && testingIspServices()) {
          SetPageMappings(document.documentElement.currentPage.id, "done");
        }
      }
    }

    var pageData = parent.GetPageData();
   
    // We default this to false, even though we could set it to true if we
    // are going to display the page. However as the accname page will set
    // it to true for us, we'll just default it to false and not work it out
    // twice.
    setPageData(pageData, "accname", "userset", false);

    // If we need to skip wizardpanels, set the wizard to jump to the
    // summary page i.e., last page. Otherwise, set the flow based
    // on type of account (mail or news) user is creating.
    var skipPanels = "";
    try {
      if (gCurrentAccountData.wizardSkipPanels)
        skipPanels = gCurrentAccountData.wizardSkipPanels.toString().toLowerCase();
    } catch(ex) {}

      // "done" is the only required panel for all accounts. We used to require an identity panel but not anymore.
      // initialize wizardPanels with the optional mail/news panels
      var wizardPanels, i;
      var isMailAccount = pageData.accounttype.mailaccount;
      var isNewsAccount = pageData.accounttype.newsaccount;
      if (skipPanels == "true") // Support old syntax of true/false for wizardSkipPanels
        wizardPanels = new Array("identitypage"); 
      else if (isMailAccount && isMailAccount.value)
        wizardPanels = new Array("identitypage", "incomingpage", "outgoingpage", "accnamepage");
      else if (isNewsAccount && isNewsAccount.value)
        wizardPanels = new Array("identitypage", "newsserver", "accnamepage");
      else { // An account created by an extension and XUL overlays
        var button = document.getElementById("acctyperadio").selectedItem;
        wizardPanels = button.value.split(/ *, */);
      }

      // Create a hash table of the panels to skip
      var skipArray = skipPanels.split(",");
      var skipHash = new Array();
      for (i = 0; i < skipArray.length; i++)
        skipHash[skipArray[i]] = skipArray[i];

      // Remove skipped panels
      i = 0;
      while (i < wizardPanels.length) {
        if (wizardPanels[i] in skipHash)
          wizardPanels.splice(i, 1);
        else
          i++;
      }

      wizardPanels.push("done");

      // Set up order of panels
      for (i = 0; i < (wizardPanels.length-1); i++)
        setNextPage(wizardPanels[i], wizardPanels[i+1]);

      // make the account type page go to the very first of our approved wizard panels...this is usually going to
      // be accounttype --> identitypage unless we were configured to skip the identity page
      setNextPage("accounttype",wizardPanels[0]);
}

function initializeIspData()
{
    let mailAccount = document.getElementById("mailaccount");
    if (!mailAccount || !mailAccount.selected) {
      parent.SetCurrentAccountData(null);
    }

    // now reflect the datasource up into the parent
    var accountSelection = document.getElementById("acctyperadio");

    var ispName = accountSelection.selectedItem.id;

    dump("initializing ISP data for " + ispName + "\n");

    if (!ispName || ispName == "") return;

    parent.PrefillAccountForIsp(ispName);
}
