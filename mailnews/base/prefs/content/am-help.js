/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Key value pairs to derive the tag based on the page loaded.
 * Each key is the page loaded when user clicks on one of the items on
 * the accounttree of the AccountManager window.
 * Value is a tag that is preset which will be used to display
 * context sensitive help. 
 */
var pageTagPairs = {
  "chrome://messenger/content/am-main.xul": "mail_account_identity",
  "chrome://messenger/content/am-server.xul": "mail",
  "chrome://messenger/content/am-copies.xul": "mail_copies",
  "chrome://messenger/content/am-addressing.xul": "mail_addressing_settings",
  "chrome://messenger/content/am-junk.xul": "mail-account-junk",
  "chrome://messenger/content/am-offline.xul": "mail-offline-accounts",
  "chrome://messenger/content/am-smtp.xul": "mail_smtp",
  "chrome://messenger/content/am-smime.xul": "mail_security_settings",
  "chrome://messenger/content/am-serverwithnoidentities.xul": "mail_local_folders_settings",
  "chrome://messenger/content/am-mdn.xul": "mail-account-receipts",
} 

function doHelpButton() 
{
  // Get the URI of the page loaded in the AccountManager's content frame.
  var pageSourceURI = contentFrame.location.href;
  // Get the help tag corresponding to the page loaded.
  var helpTag = pageTagPairs[pageSourceURI];

  // If the help tag is generic or offline, check if there is a need to set tags per server type
  if ((helpTag == "mail") || (helpTag == "mail-offline-accounts")) {
    // Get server type, as we may need to set help tags per server type for some pages
    var serverType = GetServerType();
  
    /**
     * Check the page to be loaded. Following pages needed to be presented with the 
     * help content that is based on server type. For any pages with such requirement
     * do add comments here about the page and a new case statement for pageSourceURI
     * switch.
     * - server settings ("chrome://messenger/content/am-server.xul")
     * - offline/diskspace settings ("chrome://messenger/content/am-offline.xul")
     */ 
    switch (pageSourceURI) {
      case "chrome://messenger/content/am-server.xul":
        helpTag = "mail_server_" + serverType;
        break;

      case "chrome://messenger/content/am-offline.xul":
        helpTag = "mail_offline_" + serverType;
        break;

      default :
        break;
    }
  }

  if ( helpTag ) 
  	openHelp(helpTag);  
  else
	openHelp('mail'); 
}

/**
 * Get server type of the seleted item
 */
function GetServerType()
{
  var serverType = null;
  var currentAccount = parent.getCurrentAccount();
  if (currentAccount)
    serverType = currentAccount.incomingServer.type;
  return serverType;
}
