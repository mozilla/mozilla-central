/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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
    for (let i = 0; i < allServers.length; ++i)
    {
      let currentServer = allServers.queryElementAt(i, Components.interfaces.nsIMsgIncomingServer);
      if (currentServer)
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
  Services.obs.addObserver(biffObserver, BIFF_TOPIC, false);
  biffObserver.observe(null, BIFF_TOPIC, null); // init mini-mail icon
  addEventListener("unload", MailTasksOnUnload, false);

  // don't try to biff if offline, but do so silently
  if (Services.io.offline)
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
  if (Services.wm.getMostRecentWindow("mail:3pane"))
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
  Services.obs.removeObserver(biffObserver, BIFF_TOPIC);
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
