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
 * The Original Code is Mozilla Communicator client code, released
 * March 31, 1998.
 * 
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2000
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Ben Goodger <ben@netscape.com>
 *   Josh Soref <timeless@bemail.org>
 *   Varada Parthasarathi <varada@netscape.com>
 *   Scott Putterman <putterman@netscape.com>
 *   Simon Fraser <sfraser@netscape.com>
 *   Chris McAfee <mcafee@netscape.com>
 *   Ray Whitmer <rayw@netscape.com>
 *   David Hyatt <hyatt@netscape.com>
 *   Blake Ross <blakeross@telocity.com>
 *   Andrew Wooldridge <andreww@netscape.com>
 *   Joe Hewitt <hewitt@netscape.com>
 *   Brian Nesse <bnesse@netscape.com>
 *   Håkan Waara <hwaara@chello.se>
 *   Neil Rashbrook <neil@parkwaycc.co.uk>
 *   Srilatha Moturi <srilatha@netscape.com>
 *   Peter Annema <jaggernaut@netscape.com>
 *   Brian Ryner <bryner@netscape.com>
 *   Alec Flett <alecf@netscape.com>
 *   <shliang@netscape.com>
 *   <riceman+bmo@mail.rit.edu>
 *   Serge Gautherie <sgautherie.bz@free.fr>
 *   Karsten Düsterloh <mnyromyr@tprac.de>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the LGPL or the GPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

// biff observer topic
const BIFF_TOPIC = "mail:biff-state-changed";

// biff state constants used by themes
const BIFF_STATE_MESSAGES   = "NewMail";
const BIFF_STATE_NOMESSAGES = "NoMail";
const BIFF_STATE_UNKNOWN    = "UnknownMail";


// uses "toOpenWindowByType" function provided by utilityOverlay.js
// which is included by most clients. 
function toMessengerWindow()
{
  toOpenWindowByType("mail:3pane", "chrome://messenger/content/");
}

function toAddressBook() 
{
  toOpenWindowByType("mail:addressbook",
                     "chrome://messenger/content/addressbook/addressbook.xul");
}

function toNewsgroups() 
{
  dump("Sorry, command not implemented.\n");
}

function toImport()
{
  window.openDialog("chrome://messenger/content/importDialog.xul",
                    "importDialog",
                    "chrome, modal, titlebar, centerscreen");
}

function CoalesceGetMsgsForPop3ServersByDestFolder(aCurrentServer,
                                                   aPOP3DownloadServersArray,
                                                   aLocalFoldersToDownloadTo)
{
  // coalesce the servers that download into the same folder...
  var inbox = aCurrentServer.rootMsgFolder.getFolderWithFlags(Components.interfaces.nsMsgFolderFlags.Inbox);
  var index = aLocalFoldersToDownloadTo.indexOf(inbox);
  if (index == -1)
  {
    inbox.biffState = Components.interfaces.nsIMsgFolder.nsMsgBiffState_NoMail;
    inbox.clearNewMessages();
    aLocalFoldersToDownloadTo.push(inbox);
    index = aPOP3DownloadServersArray.length;
    aPOP3DownloadServersArray[index] =
      Components.classes["@mozilla.org/supports-array;1"]
                .createInstance(Components.interfaces.nsISupportsArray);
  }
  aPOP3DownloadServersArray[index].AppendElement(aCurrentServer);
}

function MailTasksGetMessagesForAllServers(aBiff, aMsgWindow, aDefaultServer)
{
  // now log into any server
  try
  {
    var allServers = Components.classes["@mozilla.org/messenger/account-manager;1"]
                               .getService(Components.interfaces.nsIMsgAccountManager)
                               .allServers;
    // array of ISupportsArrays of servers for a particular folder
    var pop3DownloadServersArray = [];
    // parallel array of folders to download to...
    var localFoldersToDownloadTo = [];
    var pop3Server = null;
    for (let i = 0; i < allServers.Count(); ++i)
    {
      let currentServer = allServers.GetElementAt(i);
      if (currentServer instanceof Components.interfaces.nsIMsgIncomingServer)
      {
        let protocolinfo = Components.classes["@mozilla.org/messenger/protocol/info;1?type=" + currentServer.type]
                                     .getService(Components.interfaces.nsIMsgProtocolInfo);
        if (aBiff)
        {
          if (protocolinfo.canLoginAtStartUp && currentServer.loginAtStartUp)
          {
            if (aDefaultServer &&
                aDefaultServer.equals(currentServer) && 
                !aDefaultServer.isDeferredTo &&
                aDefaultServer.rootFolder == aDefaultServer.rootMsgFolder)
            {
              dump(currentServer.serverURI + " ... skipping, already opened\n");
            }
            else if (currentServer.type == "pop3" && currentServer.downloadOnBiff)
            {
              CoalesceGetMsgsForPop3ServersByDestFolder(currentServer,
                                                        pop3DownloadServersArray,
                                                        localFoldersToDownloadTo);
              pop3Server = currentServer;
            }
            else
            {
              // check to see if there are new messages on the server
              currentServer.performBiff(aMsgWindow);
            }
          }
        }
        else
        {
          if (protocolinfo.canGetMessages && !currentServer.passwordPromptRequired)
          {
            if (currentServer.type == "pop3")
            {
              CoalesceGetMsgsForPop3ServersByDestFolder(currentServer,
                                                        pop3DownloadServersArray,
                                                        localFoldersToDownloadTo);
              pop3Server = currentServer;
            }
            else
            {
              // get new messages on the server for IMAP or RSS
              GetMessagesForInboxOnServer(currentServer);
            }
          }
        }
      }
    }

    if (pop3Server instanceof Components.interfaces.nsIPop3IncomingServer)
    {
      for (let i = 0; i < pop3DownloadServersArray.length; ++i)
      {
        // any ol' pop3Server will do -
        // the serversArray specifies which servers to download from
        pop3Server.downloadMailFromServers(pop3DownloadServersArray[i],
                                           aMsgWindow,
                                           localFoldersToDownloadTo[i],
                                           null);
      }
    }
  }
  catch (e)
  {
    Components.utils.reportError(e);
  }
}

const biffObserver =
{
  observe: function observe(subject, topic, state)
  {
    // sanity check
    if (topic == BIFF_TOPIC)
    {
      var biffManager = Components.classes["@mozilla.org/messenger/statusBarBiffManager;1"]
                                  .getService(Components.interfaces.nsIStatusBarBiffManager);
      document.getElementById("mini-mail")
              .setAttribute("BiffState",
                            [BIFF_STATE_MESSAGES,
                             BIFF_STATE_NOMESSAGES,
                             BIFF_STATE_UNKNOWN][biffManager.biffState]);
    }
  }
};

function MailTasksOnLoad(aEvent)
{
  // Without the mini-mail icon to show the biff state, there's no need to
  // initialize this here. We won't start with the hidden window alone,
  // so this early return doesn't break anything.
  var miniMail = document.getElementById("mini-mail");
  if (!miniMail)
    return;

  // initialize biff state
  const kObserverService = Components.classes["@mozilla.org/observer-service;1"]
                                     .getService(Components.interfaces.nsIObserverService);
  kObserverService.addObserver(biffObserver, BIFF_TOPIC, false);
  biffObserver.observe(null, BIFF_TOPIC, null); // init mini-mail icon
  addEventListener("unload", MailTasksOnUnload, false);

  // don't try to biff if offline, but do so silently
  const kIOService = Components.classes["@mozilla.org/network/io-service;1"]
                               .getService(Components.interfaces.nsIIOService);
  if (kIOService.offline)
    return;

  // Performing biff here will mean performing it for all new windows opened!
  // This might make non-users of mailnews unhappy...
  const kPrefBranch = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService)
                                .getBranch(null);
  if (!kPrefBranch.getBoolPref("mail.biff.on_new_window"))
    return;

  // The MailNews main window will perform biff later in its onload handler,
  // so we don't need to do this here.
  if (Components.classes["@mozilla.org/appshell/window-mediator;1"]
                .getService(Components.interfaces.nsIWindowMediator)
                .getMostRecentWindow("mail:3pane"))
    return;

  // If we already have a defined biff-state set on the mini-mail icon,
  // we know that biff is already running.
  const kBiffState = Components.classes["@mozilla.org/messenger/statusBarBiffManager;1"]
                               .getService(Components.interfaces.nsIStatusBarBiffManager)
                               .biffState;
  if (kBiffState != Components.interfaces.nsIMsgFolder.nsMsgBiffState_Unknown)
    return;

  // still no excuse to refuse to use this ruse
  MailTasksGetMessagesForAllServers(true, null, null);
}

function MailTasksOnUnload(aEvent)
{
  var observerService = Components.classes["@mozilla.org/observer-service;1"]
                                  .getService(Components.interfaces.nsIObserverService);
  observerService.removeObserver(biffObserver, BIFF_TOPIC);
}

/**
 * This class implements nsIBadCertListener2.  Its job is to prevent "bad cert"
 * security dialogs from being shown to the user.  Currently it puts up the
 * cert override dialog, though we'd like to give the user more detailed
 * information in the future.
 */
function nsMsgBadCertHandler() {
}

nsMsgBadCertHandler.prototype = {
  // Suppress any certificate errors
  notifyCertProblem: function(socketInfo, status, targetSite) {
    if (!status)
      return true;

    setTimeout(InformUserOfCertError, 0, targetSite);
    return true;
  },

  // nsIInterfaceRequestor
  getInterface: function(iid) {
    return this.QueryInterface(iid);
  },

  // nsISupports
  QueryInterface: function(iid) {
    if (!iid.equals(Components.interfaces.nsIBadCertListener2) &&
        !iid.equals(Components.interfaces.nsIInterfaceRequestor) &&
        !iid.equals(Components.interfaces.nsISupports))
      throw Components.results.NS_ERROR_NO_INTERFACE;
    return this;
  }
};

function InformUserOfCertError(targetSite)
{
  var params = { exceptionAdded : false,
                 prefetchCert : true,
                 location : targetSite };
  window.openDialog('chrome://pippki/content/exceptionDialog.xul',
                  '','chrome,centerscreen,modal', params);
}

addEventListener("load", MailTasksOnLoad, false);
