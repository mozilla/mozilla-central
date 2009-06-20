/* -*- Mode: JavaScript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * ***** BEGIN LICENSE BLOCK *****
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
 * Portions created by the Initial Developer are Copyright (C) 1998-1999
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Bienvenu <bienvenu@nventure.com>
 *   Olivier Parniere BT Global Services / Etat francais Ministere de la Defense
 *   Simon Wilkinson <simon@sxw.org.uk>
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

// Ensure the activity modules are loaded for this window.
Components.utils.import("resource://app/modules/activity/activityModules.js");

/**
 * interfaces
 */
const nsIMsgCompDeliverMode = Components.interfaces.nsIMsgCompDeliverMode;
const nsIMsgCompSendFormat = Components.interfaces.nsIMsgCompSendFormat;
const nsIMsgCompConvertible = Components.interfaces.nsIMsgCompConvertible;
const nsIMsgCompType = Components.interfaces.nsIMsgCompType;
const nsIMsgCompFormat = Components.interfaces.nsIMsgCompFormat;
const nsIAbPreferMailFormat = Components.interfaces.nsIAbPreferMailFormat;
const nsIPlaintextEditorMail = Components.interfaces.nsIPlaintextEditor;
const nsISupportsString = Components.interfaces.nsISupportsString;
const mozISpellCheckingEngine = Components.interfaces.mozISpellCheckingEngine;

var sDictCount = 0;

/* Create message window object. This is use by mail-offline.js and therefore should not be renamed. We need to avoid doing
   this kind of cross file global stuff in the future and instead pass this object as parameter when needed by function
   in the other js file.
*/
var msgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
                          .createInstance(Components.interfaces.nsIMsgWindow);

/**
 * Global variables, need to be re-initialized every time mostly because we need to release them when the window close
 */
var gHideMenus;
var gMsgCompose;
var gAccountManager;
var gIOService;
var gPromptService;
var gWindowLocked;
var gContentChanged;
var gAutoSaving;
var gCurrentIdentity;
var defaultSaveOperation;
var gSendOrSaveOperationInProgress;
var gCloseWindowAfterSave;
var gIsOffline;
var gSessionAdded;
var gCurrentAutocompleteDirectory;
var gSetupLdapAutocomplete;
var gLDAPSession;
var gSavedSendNowKey;
var gSendFormat;

var gMsgIdentityElement;
var gMsgAddressingWidgetTreeElement;
var gMsgSubjectElement;
var gMsgAttachmentElement;
var gMsgHeadersToolbarElement;

// i18n globals
var gSendDefaultCharset;
var gCharsetTitle;
var gCharsetConvertManager;

var gLastWindowToHaveFocus;
var gReceiptOptionChanged;
var gDSNOptionChanged;
var gAttachVCardOptionChanged;

var gMailSession;
var gAutoSaveInterval;
var gAutoSaveTimeout;
var gAutoSaveKickedIn;
var gEditingDraft;

const kComposeAttachDirPrefName = "mail.compose.attach.dir";

function InitializeGlobalVariables()
{
  gAccountManager = Components.classes["@mozilla.org/messenger/account-manager;1"].getService(Components.interfaces.nsIMsgAccountManager);
  gIOService = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
  gPromptService = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);

  gMsgCompose = null;
  gWindowLocked = false;
  gContentChanged = false;
  gCurrentIdentity = null;
  defaultSaveOperation = "draft";
  gSendOrSaveOperationInProgress = false;
  gAutoSaving = false;
  gCloseWindowAfterSave = false;
  gIsOffline = gIOService.offline;
  gSessionAdded = false;
  gCurrentAutocompleteDirectory = null;
  gSetupLdapAutocomplete = false;
  gLDAPSession = null;
  gSavedSendNowKey = null;
  gSendFormat = nsIMsgCompSendFormat.AskUser;
  gSendDefaultCharset = null;
  gCharsetTitle = null;
  gCharsetConvertManager = Components.classes['@mozilla.org/charset-converter-manager;1'].getService(Components.interfaces.nsICharsetConverterManager);
  gMailSession = Components.classes["@mozilla.org/messenger/services/session;1"].getService(Components.interfaces.nsIMsgMailSession);
  gHideMenus = false;

  gLastWindowToHaveFocus = null;
  gReceiptOptionChanged = false;
  gDSNOptionChanged = false;
  gAttachVCardOptionChanged = false;
}
InitializeGlobalVariables();

function ReleaseGlobalVariables()
{
  gAccountManager = null;
  gIOService = null;
  gPromptService = null;
  gCurrentIdentity = null;
  gCurrentAutocompleteDirectory = null;
  gLDAPSession = null;
  gCharsetConvertManager = null;
  gMsgCompose = null;
  gMailSession = null;
}

function disableEditableFields()
{
  gMsgCompose.editor.flags |= nsIPlaintextEditorMail.eEditorReadonlyMask;
  var disableElements = document.getElementsByAttribute("disableonsend", "true");
  for (let i = 0; i < disableElements.length; i++)
    disableElements[i].setAttribute('disabled', 'true');

}

function enableEditableFields()
{
  gMsgCompose.editor.flags &= ~nsIPlaintextEditorMail.eEditorReadonlyMask;
  var enableElements = document.getElementsByAttribute("disableonsend", "true");
  for (let i = 0; i < enableElements.length; i++)
    enableElements[i].removeAttribute('disabled');

}

var gComposeRecyclingListener = {
  onClose: function() {
    //Reset recipients and attachments
    ReleaseAutoCompleteState();
    awResetAllRows();
    RemoveAllAttachments();

    // We need to clear the identity popup menu in case the user will change them.
    // It will be rebuilt later in ComposeStartup
    ClearIdentityListPopup(document.getElementById("msgIdentityPopup"));

    //Clear the subject
    GetMsgSubjectElement().value = "";
    // be sure to clear the transaction manager for the subject
    GetMsgSubjectElement().editor.transactionManager.clear();
    SetComposeWindowTitle();

    SetContentAndBodyAsUnmodified();
    disableEditableFields();
    ReleaseGlobalVariables();

    // Clear the focus
    awGetInputElement(1).removeAttribute('focused');

    //Reset Boxes size
    document.getElementById("headers-box").removeAttribute("height");
    document.getElementById("appcontent").removeAttribute("height");
    document.getElementById("addresses-box").removeAttribute("width");
    document.getElementById("attachments-box").removeAttribute("width");

    //Reset menu options
    document.getElementById("format_auto").setAttribute("checked", "true");
    document.getElementById("priority_normal").setAttribute("checked", "true");

    //Reset toolbars that could be hidden
    if (gHideMenus) {
      document.getElementById("formatMenu").hidden = false;
      document.getElementById("insertMenu").hidden = false;
      var showFormat = document.getElementById("menu_showFormatToolbar")
      showFormat.hidden = false;
      if (showFormat.getAttribute("checked") == "true")
        document.getElementById("FormatToolbar").hidden = false;
    }

    // Stop InlineSpellCheckerUI so personal dictionary is saved
    enableInlineSpellCheck(false);
    // clear any suggestions in the context menu
    InlineSpellCheckerUI.clearSuggestionsFromMenu();

    //Reset editor
    EditorResetFontAndColorAttributes();
    EditorCleanup();

    //Release the nsIMsgComposeParams object
    if (window.arguments && window.arguments[0])
      window.arguments[0] = null;

    var event = document.createEvent('Events');
    event.initEvent('compose-window-close', false, true);
    document.getElementById("msgcomposeWindow").dispatchEvent(event);
    if (gAutoSaveTimeout)
      clearTimeout(gAutoSaveTimeout);
  },

  onReopen: function(params) {
    InitializeGlobalVariables();
    ComposeStartup(true, params);

    var event = document.createEvent('Events');
    event.initEvent('compose-window-reopen', false, true);
    document.getElementById("msgcomposeWindow").dispatchEvent(event);
  }
};

var stateListener = {
  NotifyComposeFieldsReady: function() {
    ComposeFieldsReady();
  },

  NotifyComposeBodyReady: function() {
    if (gMsgCompose.composeHTML)
      loadHTMLMsgPrefs();
    AdjustFocus();
  },

  ComposeProcessDone: function(aResult) {
    gWindowLocked = false;
    enableEditableFields();
    updateComposeItems();

    if (aResult== Components.results.NS_OK)
    {
      if (!gAutoSaving)
        SetContentAndBodyAsUnmodified();

      if (gCloseWindowAfterSave)
      {
        // Notify the SendListener that Send has been aborted and Stopped
        if (gMsgCompose)
          gMsgCompose.onSendNotPerformed(null, Components.results.NS_ERROR_ABORT);

        MsgComposeCloseWindow(true);
      }
    }
    // else if we failed to save, and we're autosaving, need to re-mark the editor
    // as changed, so that we won't lose the changes.
    else if (gAutoSaving)
    {
      gMsgCompose.bodyModified = true;
      gContentChanged = true;
    }
    gAutoSaving = false;
    gCloseWindowAfterSave = false;
  },

  SaveInFolderDone: function(folderURI) {
    DisplaySaveFolderDlg(folderURI);
  }
};

// all progress notifications are done through the nsIWebProgressListener implementation...
var progressListener = {
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus)
    {
      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_START)
      {
        document.getElementById('compose-progressmeter').setAttribute( "mode", "undetermined" );
      }

      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
      {
        gSendOrSaveOperationInProgress = false;
        document.getElementById('compose-progressmeter').setAttribute( "mode", "normal" );
        document.getElementById('compose-progressmeter').setAttribute( "value", 0 );
        document.getElementById('statusText').setAttribute('label', '');
      }
    },

    onProgressChange: function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
    {
      // Calculate percentage.
      var percent;
      if ( aMaxTotalProgress > 0 )
      {
        percent = Math.round( (aCurTotalProgress*100)/aMaxTotalProgress );
        if ( percent > 100 )
          percent = 100;

        document.getElementById('compose-progressmeter').removeAttribute("mode");

        // Advance progress meter.
        document.getElementById('compose-progressmeter').setAttribute( "value", percent );
      }
      else
      {
        // Progress meter should be barber-pole in this case.
        document.getElementById('compose-progressmeter').setAttribute( "mode", "undetermined" );
      }
    },

    onLocationChange: function(aWebProgress, aRequest, aLocation)
    {
      // we can ignore this notification
    },

    onStatusChange: function(aWebProgress, aRequest, aStatus, aMessage)
    {
      // Looks like it's possible that we get call while the document has been already delete!
      // therefore we need to protect ourself by using try/catch
      try {
        let statusText = document.getElementById("statusText");
        if (statusText)
          statusText.setAttribute("label", aMessage);
      } catch (ex) {}
    },

    onSecurityChange: function(aWebProgress, aRequest, state)
    {
      // we can ignore this notification
    },

    QueryInterface : function(iid)
    {
      if (iid.equals(Components.interfaces.nsIWebProgressListener) ||
          iid.equals(Components.interfaces.nsISupportsWeakReference) ||
          iid.equals(Components.interfaces.nsISupports))
        return this;

      throw Components.results.NS_NOINTERFACE;
    }
};

var defaultController =
{
  supportsCommand: function(command)
  {
    switch (command)
    {
      //File Menu
      case "cmd_attachFile":
      case "cmd_attachPage":
      case "cmd_close":
      case "cmd_saveDefault":
      case "cmd_saveAsFile":
      case "cmd_saveAsDraft":
      case "cmd_saveAsTemplate":
      case "cmd_sendButton":
      case "cmd_sendNow":
      case "cmd_sendWithCheck":
      case "cmd_sendLater":
      case "cmd_printSetup":
      case "cmd_print":
      case "cmd_quit":

      //Edit Menu
      case "cmd_delete":
      case "cmd_renameAttachment":
      case "cmd_selectAll":
      case "cmd_openAttachment":
      case "cmd_account":

      //View Menu
      case "cmd_showComposeToolbar":
      case "cmd_showFormatToolbar":

      //Options Menu
      case "cmd_outputFormat":
      case "cmd_quoteMessage":
        return true;

      default:
//        dump("##MsgCompose: command " + command + "no supported!\n");
        return false;
    }
  },
  isCommandEnabled: function(command)
  {
    var composeHTML = gMsgCompose && gMsgCompose.composeHTML;

    switch (command)
    {
      //File Menu
      case "cmd_attachFile":
      case "cmd_attachPage":
      case "cmd_close":
      case "cmd_saveDefault":
      case "cmd_saveAsFile":
      case "cmd_saveAsDraft":
      case "cmd_saveAsTemplate":
      case "cmd_sendButton":
      case "cmd_sendLater":
      case "cmd_printSetup":
      case "cmd_print":
      case "cmd_sendWithCheck":
        return !gWindowLocked;
      case "cmd_sendNow":
        return !(gWindowLocked || gIsOffline);
      case "cmd_quit":
        return true;

      //Edit Menu
      case "cmd_delete":
        return MessageGetNumSelectedAttachments();
      case "cmd_selectAll":
        return MessageHasAttachments();
      case "cmd_openAttachment":
        return MessageGetNumSelectedAttachments() == 1;
      case "cmd_renameAttachment":
        return MessageGetNumSelectedAttachments() == 1;
      case "cmd_account":

      //View Menu
      case "cmd_showComposeToolbar":
        return true;
      case "cmd_showFormatToolbar":
        return composeHTML;

      //Options Menu
      case "cmd_outputFormat":
        return composeHTML;
      case "cmd_quoteMessage":
        var selectedURIs = GetSelectedMessages();
        if (selectedURIs && selectedURIs.length > 0)
          return true;
        return false;

      default:
//        dump("##MsgCompose: command " + command + " disabled!\n");
        return false;
    }
  },

  doCommand: function(command)
  {
    switch (command)
    {
      //File Menu
      case "cmd_attachFile"         : if (defaultController.isCommandEnabled(command)) AttachFile();           break;
      case "cmd_attachPage"         : AttachPage();           break;
      case "cmd_close"              : DoCommandClose();       break;
      case "cmd_saveDefault"        : Save();                 break;
      case "cmd_saveAsFile"         : SaveAsFile(true);       break;
      case "cmd_saveAsDraft"        : SaveAsDraft();          break;
      case "cmd_saveAsTemplate"     : SaveAsTemplate();       break;
      case "cmd_sendButton"         :
        if (defaultController.isCommandEnabled(command))
        {
          if (gIOService && gIOService.offline)
            SendMessageLater();
          else
            SendMessage();
        }
        break;
      case "cmd_sendNow"            : if (defaultController.isCommandEnabled(command)) SendMessage();          break;
      case "cmd_sendWithCheck"   : if (defaultController.isCommandEnabled(command)) SendMessageWithCheck();          break;
      case "cmd_sendLater"          : if (defaultController.isCommandEnabled(command)) SendMessageLater();     break;
      case "cmd_printSetup"         : PrintUtils.showPageSetup(); break;
      case "cmd_print"              : DoCommandPrint(); break;

      //Edit Menu
      case "cmd_delete"             : if (MessageGetNumSelectedAttachments()) RemoveSelectedAttachment();         break;
      case "cmd_renameAttachment"   : if (MessageGetNumSelectedAttachments() == 1) RenameSelectedAttachment(); break;
      case "cmd_selectAll"          : if (MessageHasAttachments()) SelectAllAttachments();                     break;
      case "cmd_openAttachment"     : if (MessageGetNumSelectedAttachments() == 1) OpenSelectedAttachment();          break;
      case "cmd_account"            : MsgAccountManager(null); break;

      //View Menu
      case "cmd_showComposeToolbar" : goToggleToolbar('composeToolbar2', 'menu_showComposeToolbar'); break;
      case "cmd_showFormatToolbar"  : goToggleToolbar('FormatToolbar', 'menu_showFormatToolbar');   break;

      //Options Menu
      case "cmd_quoteMessage"       : if (defaultController.isCommandEnabled(command)) QuoteSelectedMessage();  break;
      default:
//        dump("##MsgCompose: don't know what to do with command " + command + "!\n");
        return;
    }
  },

  onEvent: function(event)
  {
//    dump("DefaultController:onEvent\n");
  }
}

function goOpenNewMessage()
{
  // if there is a MsgNewMessage function in scope
  // and we should use it, so that we choose the proper
  // identity, based on the selected message or folder
  // if not, bring up the compose window to the default identity
  if ("MsgNewMessage" in window) {
    MsgNewMessage(null);
    return;
   }

   var msgComposeService = Components.classes["@mozilla.org/messengercompose;1"].getService();
   msgComposeService = msgComposeService.QueryInterface(Components.interfaces.nsIMsgComposeService);
   msgComposeService.OpenComposeWindow(null, null, null,
                                       Components.interfaces.nsIMsgCompType.New,
                                       Components.interfaces.nsIMsgCompFormat.Default,
                                       null, null);
}

function QuoteSelectedMessage()
{
  var selectedURIs = GetSelectedMessages();
  if (selectedURIs)
    for (let i = 0; i < selectedURIs.length; i++)
      gMsgCompose.quoteMessage(selectedURIs[i]);
}

function GetSelectedMessages()
{
  if (gMsgCompose) {
    var mailWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService()
                     .QueryInterface(Components.interfaces.nsIWindowMediator)
                     .getMostRecentWindow("mail:3pane");
    if (mailWindow) {
      return mailWindow.gFolderDisplay.selectedMessageUris;
    }
  }

  return null;
}

function SetupCommandUpdateHandlers()
{
  top.controllers.insertControllerAt(0, defaultController);
}

function UnloadCommandUpdateHandlers()
{
  top.controllers.removeController(defaultController);
}

function CommandUpdate_MsgCompose()
{
  var focusedWindow = top.document.commandDispatcher.focusedWindow;

  // we're just setting focus to where it was before
  if (focusedWindow == gLastWindowToHaveFocus) {
    //dump("XXX skip\n");
    return;
  }

  gLastWindowToHaveFocus = focusedWindow;

  //dump("XXX update, focus on " + focusedWindow + "\n");

  updateComposeItems();
}

function updateComposeItems()
{
  try {
    // Edit Menu
    goUpdateCommand("cmd_rewrap");

    // Insert Menu
    if (gMsgCompose && gMsgCompose.composeHTML)
    {
      goUpdateCommand("cmd_renderedHTMLEnabler");
      goUpdateCommand("cmd_decreaseFont");
      goUpdateCommand("cmd_increaseFont");
      goUpdateCommand("cmd_bold");
      goUpdateCommand("cmd_italic");
      goUpdateCommand("cmd_underline");
      goUpdateCommand("cmd_ul");
      goUpdateCommand("cmd_ol");
      goUpdateCommand("cmd_indent");
      goUpdateCommand("cmd_outdent");
      goUpdateCommand("cmd_align");
      goUpdateCommand("cmd_smiley");
    }

    // Options Menu
    goUpdateCommand("cmd_spelling");
    goUpdateCommand("cmd_quoteMessage");
  } catch(e) {}
}

function openEditorContextMenu(popup)
{
  InlineSpellCheckerUI.clearSuggestionsFromMenu();
  InlineSpellCheckerUI.initFromEvent(document.popupRangeParent, document.popupRangeOffset);
  var onMisspelling = InlineSpellCheckerUI.overMisspelling;
  document.getElementById('spellCheckSuggestionsSeparator').hidden = !onMisspelling;
  document.getElementById('spellCheckAddToDictionary').hidden = !onMisspelling;
  document.getElementById('spellCheckIgnoreWord').hidden = !onMisspelling;
  var separator = document.getElementById('spellCheckAddSep');
  separator.hidden = !onMisspelling;
  document.getElementById('spellCheckNoSuggestions').hidden = !onMisspelling ||
      InlineSpellCheckerUI.addSuggestionsToMenu(popup, separator, 5);

  updateEditItems();
}

function updateEditItems()
{
  goUpdateCommand("cmd_pasteNoFormatting");
  goUpdateCommand("cmd_pasteQuote");
  goUpdateCommand("cmd_delete");
  goUpdateCommand("cmd_renameAttachment");
  goUpdateCommand("cmd_selectAll");
  goUpdateCommand("cmd_openAttachment");
  goUpdateCommand("cmd_find");
  goUpdateCommand("cmd_findNext");
  goUpdateCommand("cmd_findPrev");
}

var messageComposeOfflineObserver =
{
  observe: function(subject, topic, state)
  {
    // sanity checks
    if (topic != "network:offline-status-changed")
      return;
    gIsOffline = state == "offline";
    MessageComposeOfflineStateChanged(gIsOffline);

    try {
      setupLdapAutocompleteSession();
    } catch (ex) {
      // catch the exception and ignore it, so that if LDAP setup
      // fails, the entire compose window stuff doesn't get aborted
    }
  }
}

function AddMessageComposeOfflineObserver()
{
  var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
  observerService.addObserver(messageComposeOfflineObserver, "network:offline-status-changed", false);

  gIsOffline = gIOService.offline;
  // set the initial state of the send button
  MessageComposeOfflineStateChanged(gIsOffline);
}

function RemoveMessageComposeOfflineObserver()
{
  var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
  observerService.removeObserver(messageComposeOfflineObserver,"network:offline-status-changed");
}

function MessageComposeOfflineStateChanged(goingOffline)
{
  try {
    var sendButton = document.getElementById("button-send");
    var sendNowMenuItem = document.getElementById("menu-item-send-now");

    if (!gSavedSendNowKey) {
      gSavedSendNowKey = sendNowMenuItem.getAttribute('key');
    }

    // don't use goUpdateCommand here ... the defaultController might not be installed yet
    goSetCommandEnabled("cmd_sendNow", defaultController.isCommandEnabled("cmd_sendNow"));

    if (goingOffline)
    {
      sendButton.label = sendButton.getAttribute('later_label');
      sendButton.setAttribute('tooltiptext', sendButton.getAttribute('later_tooltiptext'));
      sendNowMenuItem.removeAttribute('key');
    }
    else
    {
      sendButton.label = sendButton.getAttribute('now_label');
      sendButton.setAttribute('tooltiptext', sendButton.getAttribute('now_tooltiptext'));
      if (gSavedSendNowKey) {
        sendNowMenuItem.setAttribute('key', gSavedSendNowKey);
      }
    }

  } catch(e) {}
}

var directoryServerObserver = {
  observe: function(subject, topic, value) {
      try {
          setupLdapAutocompleteSession();
      } catch (ex) {
          // catch the exception and ignore it, so that if LDAP setup
          // fails, the entire compose window doesn't get horked
      }
  }
}

function AddDirectoryServerObserver(flag) {
  var branch = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefBranch2);
  if (flag) {
    branch.addObserver("ldap_2.autoComplete.useDirectory",
                       directoryServerObserver, false);
    branch.addObserver("ldap_2.autoComplete.directoryServer",
                       directoryServerObserver, false);
  }
  else
  {
    var prefstring = "mail.identity." + gCurrentIdentity.key + ".overrideGlobal_Pref";
    branch.addObserver(prefstring, directoryServerObserver, false);
    prefstring = "mail.identity." + gCurrentIdentity.key + ".directoryServer";
    branch.addObserver(prefstring, directoryServerObserver, false);
  }
}

function RemoveDirectoryServerObserver(prefstring)
{
  var branch = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefBranch2);
  if (!prefstring) {
    branch.removeObserver("ldap_2.autoComplete.useDirectory",
                          directoryServerObserver);
    branch.removeObserver("ldap_2.autoComplete.directoryServer",
                          directoryServerObserver);
  }
  else
  {
    var str = prefstring + ".overrideGlobal_Pref";
    branch.removeObserver(str, directoryServerObserver);
    str = prefstring + ".directoryServer";
    branch.removeObserver(str, directoryServerObserver);
  }
}

function AddDirectorySettingsObserver()
{
  var branch = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefBranch2);
  branch.addObserver(gCurrentAutocompleteDirectory, directoryServerObserver,
                     false);
}

function RemoveDirectorySettingsObserver(prefstring)
{
  var branch = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefBranch2);
  branch.removeObserver(prefstring, directoryServerObserver);
}

function setupLdapAutocompleteSession()
{
    var autocompleteLdap = false;
    var autocompleteDirectory = null;
    var prevAutocompleteDirectory = gCurrentAutocompleteDirectory;

    autocompleteLdap = getPref("ldap_2.autoComplete.useDirectory");
    if (autocompleteLdap)
        autocompleteDirectory = getPref("ldap_2.autoComplete.directoryServer");

    if(gCurrentIdentity.overrideGlobalPref) {
        autocompleteDirectory = gCurrentIdentity.directoryServer;
    }

    // use a temporary to do the setup so that we don't overwrite the
    // global, then have some problem and throw an exception, and leave the
    // global with a partially setup session.  we'll assign the temp
    // into the global after we're done setting up the session
    //
    var LDAPSession;
    if (gLDAPSession) {
        LDAPSession = gLDAPSession;
    } else {
        LDAPSession = Components
            .classes["@mozilla.org/autocompleteSession;1?type=ldap"];
        if (LDAPSession) {
          try {
            LDAPSession = LDAPSession.createInstance()
                .QueryInterface(Components.interfaces.nsILDAPAutoCompleteSession);
          } catch (ex) {dump ("ERROR: Cannot get the LDAP autocomplete session\n" + ex + "\n");}
        }
    }

    if (autocompleteDirectory && !gIsOffline) {
        // Add observer on the directory server we are autocompleting against
        // only if current server is different from previous.
        // Remove observer if current server is different from previous
        gCurrentAutocompleteDirectory = autocompleteDirectory;
        if (prevAutocompleteDirectory) {
          if (prevAutocompleteDirectory != gCurrentAutocompleteDirectory) {
            RemoveDirectorySettingsObserver(prevAutocompleteDirectory);
            AddDirectorySettingsObserver();
          }
        }
        else
          AddDirectorySettingsObserver();

        // fill in the session params if there is a session
        //
        if (LDAPSession) {
            let url = getPref(autocompleteDirectory + ".uri", true);

            LDAPSession.serverURL =
              Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService)
                        .newURI(url, null, null)
                        .QueryInterface(Components.interfaces.nsILDAPURL);

            // get the login to authenticate as, if there is one
            //
            try {
                LDAPSession.login = getPref(autocompleteDirectory + ".auth.dn", true);
            } catch (ex) {
                // if we don't have this pref, no big deal
            }

            try {
                 LDAPSession.saslMechanism = getPref(autocompleteDirectory +
		    ".auth.saslmech", true);
            } catch (ex) {
                // don't care if we don't have this pref
            }

            // set the LDAP protocol version correctly
            var protocolVersion;
            try {
                protocolVersion = getPref(autocompleteDirectory +
                                          ".protocolVersion");
            } catch (ex) {
                // if we don't have this pref, no big deal
            }
            if (protocolVersion == "2") {
                LDAPSession.version =
                    Components.interfaces.nsILDAPConnection.VERSION2;
            }

            // don't search on non-CJK strings shorter than this
            //
            try {
                LDAPSession.minStringLength = getPref(
                    autocompleteDirectory + ".autoComplete.minStringLength");
            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsLDAPAutoCompleteSession use its default.
            }

            // don't search on CJK strings shorter than this
            //
            try {
                LDAPSession.cjkMinStringLength = getPref(
                  autocompleteDirectory + ".autoComplete.cjkMinStringLength");
            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsLDAPAutoCompleteSession use its default.
            }

            // we don't try/catch here, because if this fails, we're outta luck
            //
            var ldapFormatter = Components.classes[
                "@mozilla.org/ldap-autocomplete-formatter;1?type=addrbook"]
                .createInstance().QueryInterface(
                    Components.interfaces.nsIAbLDAPAutoCompFormatter);

            // override autocomplete name format?
            //
            try {
                ldapFormatter.nameFormat = getPref(autocompleteDirectory +
                                                   ".autoComplete.nameFormat",
                                                   true);
            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsAbLDAPAutoCompFormatter use its default.
            }

            // override autocomplete mail address format?
            //
            try {
                ldapFormatter.addressFormat = getPref(autocompleteDirectory +
                                                      ".autoComplete.addressFormat",
                                                      true);
            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsAbLDAPAutoCompFormatter use its default.
            }

            try {
                // figure out what goes in the comment column, if anything
                //
                // 0 = none
                // 1 = name of addressbook this card came from
                // 2 = other per-addressbook format
                //
                var showComments = getPref("mail.autoComplete.commentColumn");

                switch (showComments) {

                case 1:
                    // use the name of this directory
                    //
                    ldapFormatter.commentFormat = getPref(
                        autocompleteDirectory + ".description", true);
                    break;

                case 2:
                    // override ldap-specific autocomplete entry?
                    //
                    try {
                        ldapFormatter.commentFormat =
                            getPref(autocompleteDirectory +
                                    ".autoComplete.commentFormat", true);
                    } catch (innerException) {
                        // if nothing has been specified, use the ldap
                        // organization field
                        ldapFormatter.commentFormat = "[o]";
                    }
                    break;

                case 0:
                default:
                    // do nothing
                }
            } catch (ex) {
                // if something went wrong while setting up comments, try and
                // proceed anyway
            }

            // set the session's formatter, which also happens to
            // force a call to the formatter's getAttributes() method
            // -- which is why this needs to happen after we've set the
            // various formats
            //
            LDAPSession.formatter = ldapFormatter;

            // override autocomplete entry formatting?
            //
            try {
                LDAPSession.outputFormat = getPref(autocompleteDirectory +
                                                   ".autoComplete.outputFormat",
                                                   true);

            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsLDAPAutoCompleteSession use its default.
            }

            // override default search filter template?
            //
            try {
                LDAPSession.filterTemplate = getPref(
                    autocompleteDirectory + ".autoComplete.filterTemplate",
                    true);

            } catch (ex) {
                // if this pref isn't there, no big deal.  just let
                // nsLDAPAutoCompleteSession use its default
            }

            // override default maxHits (currently 100)
            //
            try {
                // XXXdmose should really use .autocomplete.maxHits,
                // but there's no UI for that yet
                //
                LDAPSession.maxHits = getPref(autocompleteDirectory + ".maxHits");
            } catch (ex) {
                // if this pref isn't there, or is out of range, no big deal.
                // just let nsLDAPAutoCompleteSession use its default.
            }

            if (!gSessionAdded) {
                // if we make it here, we know that session initialization has
                // succeeded; add the session for all recipients, and
                // remember that we've done so
                let maxRecipients = awGetMaxRecipients();
                for (let i = 1; i <= maxRecipients; i++)
                {
                    let autoCompleteWidget = document.getElementById("addressCol2#" + i);
                    if (autoCompleteWidget)
                    {
                      autoCompleteWidget.addSession(LDAPSession);
                      // ldap searches don't insert a default entry with the default domain appended to it
                      // so reduce the minimum results for a popup to 2 in this case.
                      autoCompleteWidget.minResultsForPopup = 2;

                    }
                 }
                gSessionAdded = true;
            }
        }
    } else {
      if (gCurrentAutocompleteDirectory) {
        // Remove observer on the directory server since we are not doing Ldap
        // autocompletion.
        RemoveDirectorySettingsObserver(gCurrentAutocompleteDirectory);
        gCurrentAutocompleteDirectory = null;
      }
      if (gLDAPSession && gSessionAdded) {
        let maxRecipients = awGetMaxRecipients();
        for (let i = 1; i <= maxRecipients; i++)
          document.getElementById("addressCol2#" + i)
                  .removeSession(gLDAPSession);

        gSessionAdded = false;
      }
    }

    gLDAPSession = LDAPSession;
    gSetupLdapAutocomplete = true;
}

function DoCommandClose()
{
  if (ComposeCanClose()) {

    // Notify the SendListener that Send has been aborted and Stopped
    if (gMsgCompose)
      gMsgCompose.onSendNotPerformed(null, Components.results.NS_ERROR_ABORT);

    // note: if we're not caching this window, this destroys it for us
    MsgComposeCloseWindow(true);
  }

  return false;
}

function DoCommandPrint()
{
  try {
    PrintUtils.print();
  } catch(ex) {dump("#PRINT ERROR: " + ex + "\n");}
}

function ToggleWindowLock()
{
  gWindowLocked = !gWindowLocked;
  updateComposeItems();
}

/* This function will go away soon as now arguments are passed to the window using a object of type nsMsgComposeParams instead of a string */
function GetArgs(originalData)
{
  var args = new Object();

  if (originalData == "")
    return null;

  var data = "";
  var separator = String.fromCharCode(1);

  var quoteChar = "";
  var prevChar = "";
  var nextChar = "";
  for (let i = 0; i < originalData.length; i++, prevChar = aChar)
  {
    var aChar = originalData.charAt(i)
    var aCharCode = originalData.charCodeAt(i)
    if ( i < originalData.length - 1)
      nextChar = originalData.charAt(i + 1);
    else
      nextChar = "";

    if (aChar == quoteChar && (nextChar == "," || nextChar == ""))
    {
      quoteChar = "";
      data += aChar;
    }
    else if ((aCharCode == 39 || aCharCode == 34) && prevChar == "=") //quote or double quote
    {
      if (quoteChar == "")
        quoteChar = aChar;
      data += aChar;
    }
    else if (aChar == ",")
    {
      if (quoteChar == "")
        data += separator;
      else
        data += aChar
    }
    else
      data += aChar
  }

  var pairs = data.split(separator);
//  dump("Compose: argument: {" + data + "}\n");

  for (let i = pairs.length - 1; i >= 0; i--)
  {
    var pos = pairs[i].indexOf('=');
    if (pos == -1)
      continue;
    var argname = pairs[i].substring(0, pos);
    var argvalue = pairs[i].substring(pos + 1);
    if (argvalue.charAt(0) == "'" && argvalue.charAt(argvalue.length - 1) == "'")
      args[argname] = argvalue.substring(1, argvalue.length - 1);
    else
      try {
        args[argname] = decodeURIComponent(argvalue);
      } catch (e) {args[argname] = argvalue;}
    // dump("[" + argname + "=" + args[argname] + "]\n");
  }
  return args;
}

function ComposeFieldsReady()
{
  //If we are in plain text, we need to set the wrap column
  if (! gMsgCompose.composeHTML) {
    try {
      gMsgCompose.editor.QueryInterface(nsIPlaintextEditorMail).wrapWidth
          = gMsgCompose.wrapLength;
    }
    catch (e) {
      dump("### textEditor.wrapWidth exception text: " + e + " - failed\n");
    }
  }
  CompFields2Recipients(gMsgCompose.compFields);
  SetComposeWindowTitle();
  enableEditableFields();
}

// checks if the passed in string is a mailto url, if it is, generates nsIMsgComposeParams
// for the url and returns them.
function handleMailtoArgs(mailtoUrl)
{
  // see if the string is a mailto url....do this by checking the first 7 characters of the string
  if (/^mailto:/i.test(mailtoUrl))
  {
    // if it is a mailto url, turn the mailto url into a MsgComposeParams object....
    var uri = gIOService.newURI(mailtoUrl, null, null);

    if (uri) {
      var composeSvc = Components.classes["@mozilla.org/messengercompose;1"]
                                 .getService(Components.interfaces.nsIMsgComposeService);
      return composeSvc.getParamsForMailto(uri);
    }
  }

  return null;
}

function ComposeStartup(recycled, aParams)
{
  var params = null; // New way to pass parameters to the compose window as a nsIMsgComposeParameters object
  var args = null;   // old way, parameters are passed as a string

  if (aParams)
    params = aParams;
  else if (window.arguments && window.arguments[0]) {
    try {
      if (window.arguments[0] instanceof Components.interfaces.nsIMsgComposeParams)
        params = window.arguments[0];
      else
        params = handleMailtoArgs(window.arguments[0]);
    }
    catch(ex) { dump("ERROR with parameters: " + ex + "\n"); }

    // if still no dice, try and see if the params is an old fashioned list of string attributes
    // XXX can we get rid of this yet?
    if (!params)
    {
      args = GetArgs(window.arguments[0]);
    }
  }

  var identityList = document.getElementById("msgIdentity");

  document.addEventListener("keypress", awDocumentKeyPress, true);

  if (identityList)
    FillIdentityList(identityList);

  if (!params) {
    // This code will go away soon as now arguments are passed to the window using a object of type nsMsgComposeParams instead of a string

    params = Components.classes["@mozilla.org/messengercompose/composeparams;1"].createInstance(Components.interfaces.nsIMsgComposeParams);
    params.composeFields = Components.classes["@mozilla.org/messengercompose/composefields;1"].createInstance(Components.interfaces.nsIMsgCompFields);

    if (args) { //Convert old fashion arguments into params
      var composeFields = params.composeFields;
      if (args.bodyislink == "true")
        params.bodyIsLink = true;
      if (args.type)
        params.type = args.type;
      if (args.format)
        params.format = args.format;
      if (args.originalMsg)
        params.originalMsgURI = args.originalMsg;
      if (args.preselectid)
        params.identity = getIdentityForKey(args.preselectid);
      if (args.to)
        composeFields.to = args.to;
      if (args.cc)
        composeFields.cc = args.cc;
      if (args.bcc)
        composeFields.bcc = args.bcc;
      if (args.newsgroups)
        composeFields.newsgroups = args.newsgroups;
      if (args.subject)
        composeFields.subject = args.subject;
      if (args.attachment)
      {
        var attachmentList = args.attachment.split(",");
        var attachment;
        var localFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
        var ioService = Components.classes["@mozilla.org/network/io-service;1"]
        ioService = ioService.getService(Components.interfaces.nsIIOService);
        var fileHandler = ioService.getProtocolHandler("file").QueryInterface(Components.interfaces.nsIFileProtocolHandler);
        for (let i = 0; i < attachmentList.length; i++)
        {
          var attachmentStr = attachmentList[i];
          attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
          if (/^file:\/\//i.test(attachmentStr))
          {
            attachment.url = attachmentStr;
          }
          else
          {
            localFile.initWithPath(attachmentList[i]);
            attachment.url = fileHandler.getURLSpecFromFile(localFile);;
          }
          composeFields.addAttachment(attachment);
        }
      }
      if (args.newshost)
        composeFields.newshost = args.newshost;
      if (args.body)
         composeFields.body = args.body;
    }
  }

  // " <>" is an empty identity, and most likely not valid
  if (!params.identity || params.identity.identityName == " <>") {
    // no pre selected identity, so use the default account
    var identities = gAccountManager.defaultAccount.identities;
    if (identities.Count() == 0)
      identities = gAccountManager.allIdentities;
    params.identity = identities.QueryElementAt(0, Components.interfaces.nsIMsgIdentity);
  }

  identityList.value = params.identity.key;
  LoadIdentity(true);
  var composeSvc = Components.classes["@mozilla.org/messengercompose;1"]
                             .getService(Components.interfaces.nsIMsgComposeService);
  gMsgCompose = composeSvc.InitCompose(window, params);
  if (gMsgCompose)
  {
    // set the close listener
    gMsgCompose.recyclingListener = gComposeRecyclingListener;

    //Lets the compose object knows that we are dealing with a recycled window
    gMsgCompose.recycledWindow = recycled;

    // Get the <editor> element to startup an editor
    var editorElement = GetCurrentEditorElement();

    document.getElementById("returnReceiptMenu")
            .setAttribute('checked', gMsgCompose.compFields.returnReceipt);
    document.getElementById("dsnMenu")
            .setAttribute('checked', gMsgCompose.compFields.DSN);
    document.getElementById("cmd_attachVCard")
            .setAttribute('checked', gMsgCompose.compFields.attachVCard);
    document.getElementById("menu_inlineSpellCheck")
            .setAttribute('checked', getPref("mail.spellcheck.inline"));

    // If recycle, editor is already created
    if (!recycled)
    {
      var editortype = gMsgCompose.composeHTML ? "htmlmail" : "textmail";
      editorElement.makeEditable(editortype, true);

      // setEditorType MUST be called before setContentWindow
      if (gMsgCompose.composeHTML)
      {
        initLocalFontFaceMenu(document.getElementById("FontFacePopup"));
      }
      else
      {
        // Remove HTML toolbar, format and insert menus as we are editing in
        // plain text mode
        document.getElementById("outputFormatMenu").setAttribute("hidden", true);
        document.getElementById("FormatToolbar").setAttribute("hidden", true);
        document.getElementById("formatMenu").setAttribute("hidden", true);
        document.getElementById("insertMenu").setAttribute("hidden", true);
          document.getElementById("menu_showFormatToolbar").setAttribute("hidden", true);
      }

      // Do setup common to Message Composer and Web Composer
      EditorSharedStartup();
      InitLanguageMenu();
    }

    var msgCompFields = gMsgCompose.compFields;
    if (msgCompFields)
    {
      if (params.bodyIsLink)
      {
        var body = msgCompFields.body;
        if (gMsgCompose.composeHTML)
        {
          var cleanBody;
          try {
            cleanBody = decodeURI(body);
          } catch(e) { cleanBody = body;}

          // XXX : need to do html-escaping here !
          msgCompFields.body = "<BR><A HREF=\"" + body + "\">" + cleanBody + "</A><BR>";
        }
        else
          msgCompFields.body = "\n<" + body + ">\n";
      }

      var subjectValue = msgCompFields.subject;
      GetMsgSubjectElement().value = subjectValue;

      var attachments = msgCompFields.attachments;
      if (attachments.hasMoreElements())
        ChangeAttachmentBucketVisibility(false);

      while (attachments.hasMoreElements()) {
        AddUrlAttachment(attachments.getNext().QueryInterface(Components.interfaces.nsIMsgAttachment));
      }
    }

    var event = document.createEvent('Events');
    event.initEvent('compose-window-init', false, true);
    document.getElementById("msgcomposeWindow").dispatchEvent(event);

    gMsgCompose.RegisterStateListener(stateListener);

    if (recycled)
    {
      InitEditor();

      if (gMsgCompose.composeHTML)
      {
        // Force color picker on toolbar to show document colors
        onFontColorChange();
        onBackgroundColorChange();
      }

      // reset the priorty field for recycled windows
      updatePriorityToolbarButton('Normal');
    }
    else
    {
      // Add an observer to be called when document is done loading,
      // which creates the editor
      try {
        GetCurrentCommandManager().
                addCommandObserver(gMsgEditorCreationObserver, "obs_documentCreated");

        // Load empty page to create the editor
        editorElement.webNavigation.loadURI("about:blank", 0, null, null, null);
      } catch (e) {
        dump(" Failed to startup editor: "+e+"\n");
      }
    }
  }

  gEditingDraft = gMsgCompose.compFields.draftId;

  // finally, see if we need to auto open the address sidebar.
  var sideBarBox = document.getElementById('sidebar-box');
  if (sideBarBox.getAttribute("sidebarVisible") == "true")
  {
    // if we aren't supposed to have the side bar hidden, make sure it is visible
    if (document.getElementById("sidebar").getAttribute("src") == "")
      setTimeout(toggleAddressPicker, 0);   // do this on a delay so we don't hurt perf. on bringing up a new compose window
  }
  gAutoSaveInterval = getPref("mail.compose.autosave") ?
    getPref("mail.compose.autosaveinterval") * 60000 : 0;

  if (gAutoSaveInterval)
    gAutoSaveTimeout = setTimeout(AutoSave, gAutoSaveInterval);

  gAutoSaveKickedIn = false;
}

// The new, nice, simple way of getting notified when a new editor has been created
var gMsgEditorCreationObserver =
{
  observe: function(aSubject, aTopic, aData)
  {
    if (aTopic == "obs_documentCreated")
    {
      var editor = GetCurrentEditor();
      if (editor && GetCurrentCommandManager() == aSubject)
      {
        var editorStyle = editor.QueryInterface(Components.interfaces.nsIEditorStyleSheets);
        // We use addOverrideStyleSheet rather than addStyleSheet so that we get
        // a synchronous load, rather than having a late-finishing async load
        // mark our editor as modified when the user hasn't typed anything yet,
        // but that means the sheet must not @import slow things, especially
        // not over the network.
        editorStyle.addOverrideStyleSheet("chrome://messenger/skin/messageQuotes.css");
        InitEditor();
      }
      // Now that we know this document is an editor, update commands now if
      // the document has focus, or next time it receives focus via
      // CommandUpdate_MsgCompose()
      if (gLastWindowToHaveFocus == document.commandDispatcher.focusedWindow)
        updateComposeItems();
      else
        gLastWindowToHaveFocus = null;
    }
  }
}

function WizCallback(state)
{
  if (state){
    ComposeStartup(false, null);
  }
  else
  {
    MsgComposeCloseWindow(false); // Don't try to recycle a bogus window
//  window.tryToClose=ComposeCanClose;
  }
}

function ComposeLoad()
{
  try {
    var other_headers = getPref("mail.compose.other.header");
  }
  catch (ex) {
    dump("failed to get the mail.compose.other.header pref\n");
  }

  AddMessageComposeOfflineObserver();
  AddDirectoryServerObserver(true);

  try {
    // XXX: We used to set commentColumn on the initial auto complete column after the document has loaded
    // inside of setupAutocomplete. But this happens too late for the first widget and it was never showing
    // the comment field. Try to set it before the document finishes loading:
    if (getPref("mail.autoComplete.commentColumn"))
      document.getElementById('addressCol2#1').showCommentColumn = true;
  }
  catch (ex) {
    // do nothing...
  }

  try {
    SetupCommandUpdateHandlers();
    // This will do migration, or create a new account if we need to.
    // We also want to open the account wizard if no identities are found
    var state = verifyAccounts(WizCallback, true);

    if (other_headers) {
      var selectNode = document.getElementById('addressCol1#1');
      var other_headers_Array = other_headers.split(",");
      for (let i = 0; i < other_headers_Array.length; i++)
        selectNode.appendItem(other_headers_Array[i] + ":", "addr_other");
    }
    if (state)
      ComposeStartup(false, null);
  }
  catch (ex) {
    dump("EX: = " + ex + "\n");
    var bundle = document.getElementById("bundle_composeMsgs");
    var errorTitle = bundle.getString("initErrorDlogTitle");
    var errorMsg = bundle.getFormattedString("initErrorDlogMessage", [""]);

    gPromptService.alert(window, errorTitle, errorMsg);

    MsgComposeCloseWindow(false); // Don't try to recycle a bogus window
    return;
  }
  window.tryToClose=ComposeCanClose;

  // initialize the customizeDone method on the customizeable toolbar
  var toolbox = document.getElementById("compose-toolbox");
  toolbox.customizeDone = function(aEvent) { MailToolboxCustomizeDone(aEvent, "CustomizeComposeToolbar"); };

  var toolbarset = document.getElementById('customToolbars');
  toolbox.toolbarset = toolbarset;

  // Prevent resizing the subject and format toolbar over the addressswidget.
  var headerToolbar = document.getElementById("MsgHeadersToolbar");
  headerToolbar.minHeight = headerToolbar.boxObject.height;
}

function ComposeUnload()
{
  UnloadCommandUpdateHandlers();

  // Stop InlineSpellCheckerUI so personal dictionary is saved
  enableInlineSpellCheck(false);

  EditorCleanup();

  RemoveMessageComposeOfflineObserver();
  RemoveDirectoryServerObserver(null);
  if (gCurrentIdentity)
    RemoveDirectoryServerObserver("mail.identity." + gCurrentIdentity.key);
  if (gCurrentAutocompleteDirectory)
    RemoveDirectorySettingsObserver(gCurrentAutocompleteDirectory);
  if (gMsgCompose)
    gMsgCompose.UnregisterStateListener(stateListener);
  if (gAutoSaveTimeout)
    clearTimeout(gAutoSaveTimeout);
}

function SetDocumentCharacterSet(aCharset)
{
  if (gMsgCompose) {
    gMsgCompose.SetDocumentCharset(aCharset);
    gCharsetTitle = null;
    SetComposeWindowTitle();
  }
  else
    dump("Compose has not been created!\n");
}

function UpdateMailEditCharset()
{
  var send_default_charset = gMsgCompose.compFields.defaultCharacterSet;
//  dump("send_default_charset is " + send_default_charset + "\n");

  var compFieldsCharset = gMsgCompose.compFields.characterSet;
//  dump("gMsgCompose.compFields is " + compFieldsCharset + "\n");

  if (gCharsetConvertManager) {
    var charsetAlias = gCharsetConvertManager.getCharsetAlias(compFieldsCharset);
    if (charsetAlias == "us-ascii")
      compFieldsCharset = "ISO-8859-1";   // no menu item for "us-ascii"
  }

  // charset may have been set implicitly in case of reply/forward
  // or use pref default otherwise
  var menuitem = document.getElementById(send_default_charset == compFieldsCharset ?
                                         send_default_charset : compFieldsCharset);
  if (menuitem)
    menuitem.setAttribute('checked', 'true');

  // Set a document charset to a default mail send charset.
  if (send_default_charset == compFieldsCharset)
    SetDocumentCharacterSet(send_default_charset);
}

function InitCharsetMenuCheckMark()
{
  // Check the menu
  UpdateMailEditCharset();
  // use setTimeout workaround to delay checkmark the menu
  // when onmenucomplete is ready then use it instead of oncreate
  // see bug #78290 for the details
  setTimeout(UpdateMailEditCharset, 0);

}

function GetCharsetUIString()
{
  var charset = gMsgCompose.compFields.characterSet;
  if (gSendDefaultCharset == null) {
    gSendDefaultCharset = gMsgCompose.compFields.defaultCharacterSet;
  }

  charset = charset.toUpperCase();
  if (charset == "US-ASCII")
    charset = "ISO-8859-1";

  if (charset != gSendDefaultCharset) {

    if (gCharsetTitle == null) {
      try {
        // check if we have a converter for this charset
        var charsetAlias = gCharsetConvertManager.getCharsetAlias(charset);
        var encoderList = gCharsetConvertManager.getEncoderList();
        var found = false;
        while (encoderList.hasMore()) {
            if (charsetAlias == encoderList.getNext()) {
                found = true;
                break;
            }
        }
        if (!found)
        {
          dump("no charset converter available for " +  charset + " default charset is used instead\n");
          // set to default charset, no need to show it in the window title
          gMsgCompose.compFields.characterSet = gSendDefaultCharset;
          return "";
        }

        // get a localized string
        gCharsetTitle = gCharsetConvertManager.getCharsetTitle(charsetAlias);
      }
      catch (ex) {
        dump("failed to get a charset title of " + charset + "!\n");
        dump("Exception: " + ex + "\n");
        gCharsetTitle = charset; // just show the charset itself
      }
    }

    return " - " + gCharsetTitle;
  }

  return "";
}

function GenericSendMessage( msgType )
{
  if (gMsgCompose != null)
  {
    var msgCompFields = gMsgCompose.compFields;
    if (msgCompFields)
    {
      Recipients2CompFields(msgCompFields);
      var subject = GetMsgSubjectElement().value;
      msgCompFields.subject = subject;
      Attachments2CompFields(msgCompFields);

      if (msgType == nsIMsgCompDeliverMode.Now ||
          msgType == nsIMsgCompDeliverMode.Later ||
          msgType == nsIMsgCompDeliverMode.Background)
      {
        //Do we need to check the spelling?
        if (getPref("mail.SpellCheckBeforeSend"))
        {
          // We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
          // therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
          SetMsgBodyFrameFocus();
          window.cancelSendMessage = false;
          try {
            window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank",
                    "chrome,close,titlebar,modal", true, true);
          }
          catch(ex){}
          if(window.cancelSendMessage)
            return;
        }

        // Remind the person if there isn't a subject
        if (subject == "")
        {
          var bundle = document.getElementById("bundle_composeMsgs");
          if (gPromptService.confirmEx(
                window,
                bundle.getString("subjectEmptyTitle"),
                bundle.getString("subjectEmptyMessage"),
                (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_0) +
                (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_1),
                bundle.getString("sendWithEmptySubjectButton"),
                bundle.getString("cancelSendingButton"),
                null, null, {value:0}) == 1)
          {
            GetMsgSubjectElement().focus();
            return;
          }
        }

        // Attachment Reminder stuff...
        var bucket = document.getElementById("attachmentBucket");
        var warn = getPref("mail.compose.attachment_reminder");
        if (warn && !bucket.itemCount)
        {
          var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefBranch);
          var keywordsInCsv = prefs.getComplexValue("mail.compose.attachment_reminder_keywords",
                                                    Components.interfaces.nsIPrefLocalizedString).data;
          // And empty string pref is still going to get split to an array of
          // size 1. Avoid that...
          var keywordsArray = (keywordsInCsv) ? keywordsInCsv.split(",") : [];

          var mailBody = document.getElementById("content-frame")
                                 .contentDocument.getElementsByTagName("body")[0];
          var mailBodyNode = mailBody.cloneNode(true);

          // Don't check quoted text from reply.
          var blockquotes = mailBodyNode.getElementsByTagName("blockquote");
          for (let i = 0; i < blockquotes.length; i++)
          {
            blockquotes[i].parentNode.removeChild(blockquotes[i]);
          }
          var mailData = mailBodyNode.textContent;

          function escapeRegxpSpecials(inputString) {
            const specials = [ ".", "\\", "^", "$", "*", "+", "?", , "|",
                               "(", ")" , "[", "]", "{", "}" ];
            var re = new RegExp("(\\"+specials.join("|\\")+")", "g");
            return inputString.replace(re, "\\$1");
          }

          var keywordFound;
          for (let i = 0; i < keywordsArray.length && !keywordFound; i++)
          {
            let kw = escapeRegxpSpecials(keywordsArray[i]);
            let re = new RegExp("(([^\\s]*)\\b|\\s*)" + kw + "\\b", "i");
            let matching = re.exec(mailData);
            // Ignore the match if it was a URL.
            keywordFound = matching && !(/^http|^ftp/i.test(matching[0]));
          }

          if (keywordFound)
          {
            var bundle = document.getElementById("bundle_composeMsgs");
            var flags = gPromptService.BUTTON_POS_0 * gPromptService.BUTTON_TITLE_IS_STRING +
                        gPromptService.BUTTON_POS_1 * gPromptService.BUTTON_TITLE_IS_STRING;
            var hadForgotten = gPromptService.confirmEx(window,
                                 bundle.getString("attachmentReminderTitle"),
                                 bundle.getString("attachmentReminderMsg"),
                                 flags,
                                 bundle.getString("attachmentReminderFalseAlarm"),
                                 bundle.getString("attachmentReminderYesIForgot"),
                                 null, null, {value:0});
            if (hadForgotten)
              return;
          }
        } // End of Attachment Reminder.

        // check if the user tries to send a message to a newsgroup through a mail account
        var currentAccountKey = getCurrentAccountKey();
        var account = gAccountManager.getAccount(currentAccountKey);
        if (!account)
        {
          throw "UNEXPECTED: currentAccountKey '" + currentAccountKey +
              "' has no matching account!";
        }
        var servertype = account.incomingServer.type;

        if (servertype != "nntp" && msgCompFields.newsgroups != "")
        {
          // default to ask user if the pref is not set
          var dontAskAgain = getPref("mail.compose.dontWarnMail2Newsgroup");

          if (!dontAskAgain)
          {
            var checkbox = {value:false};
            var bundle = document.getElementById("bundle_composeMsgs");
            var okToProceed = gPromptService.confirmCheck(
                                  window,
                                  bundle.getString("sendMsgTitle"),
                                  bundle.getString("recipientDlogMessage"),
                                  bundle.getString("CheckMsg"),
                                  checkbox);

            if (!okToProceed)
              return;

            if (checkbox.value) {
              var branch = Components.classes["@mozilla.org/preferences-service;1"]
                                     .getService(Components.interfaces.nsIPrefBranch);

              branch.setBoolPref(kDontAskAgainPref, true);
            }
          }

          // remove newsgroups to prevent news_p to be set
          // in nsMsgComposeAndSend::DeliverMessage()
          msgCompFields.newsgroups = "";
        }

        // Before sending the message, check what to do with HTML message, eventually abort.
        var convert = DetermineConvertibility();
        var action = DetermineHTMLAction(convert);
        // check if e-mail addresses are complete, in case user
        // has turned off autocomplete to local domain.
        if (!CheckValidEmailAddress(msgCompFields.to, msgCompFields.cc, msgCompFields.bcc))
          return;

        if (action == nsIMsgCompSendFormat.AskUser)
        {
          var recommAction = (convert == nsIMsgCompConvertible.No)
                             ? nsIMsgCompSendFormat.AskUser
                             : nsIMsgCompSendFormat.PlainText;
          var result2 = {action:recommAction,
                         convertible:convert,
                         abort:false};
          window.openDialog("chrome://messenger/content/messengercompose/askSendFormat.xul",
                            "askSendFormatDialog", "chrome,modal,titlebar,centerscreen",
                            result2);
          if (result2.abort)
            return;
          action = result2.action;
        }

        // we will remember the users "send format" decision
        // in the address collector code (see nsAbAddressCollector::CollectAddress())
        // by using msgCompFields.forcePlainText and msgCompFields.useMultipartAlternative
        // to determine the nsIAbPreferMailFormat (unknown, plaintext, or html)
        // if the user sends both, we remember html.
        switch (action)
        {
          case nsIMsgCompSendFormat.PlainText:
            msgCompFields.forcePlainText = true;
            msgCompFields.useMultipartAlternative = false;
            break;
          case nsIMsgCompSendFormat.HTML:
            msgCompFields.forcePlainText = false;
            msgCompFields.useMultipartAlternative = false;
            break;
          case nsIMsgCompSendFormat.Both:
            msgCompFields.forcePlainText = false;
            msgCompFields.useMultipartAlternative = true;
            break;
           default: dump("\###SendMessage Error: invalid action value\n"); return;
        }
      }

      // hook for extra compose pre-processing
      var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
      observerService.notifyObservers(window, "mail:composeOnSend", null);

      var originalCharset = gMsgCompose.compFields.characterSet;
      // Check if the headers of composing mail can be converted to a mail charset.
      if (msgType == nsIMsgCompDeliverMode.Now ||
        msgType == nsIMsgCompDeliverMode.Later ||
        msgType == nsIMsgCompDeliverMode.Background ||
        msgType == nsIMsgCompDeliverMode.Save ||
        msgType == nsIMsgCompDeliverMode.SaveAsDraft ||
        msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft ||
        msgType == nsIMsgCompDeliverMode.SaveAsTemplate)
      {
        var fallbackCharset = new Object;
        // Check encoding, switch to UTF-8 if the default encoding doesn't fit
        // and disable_fallback_to_utf8 isn't set for this encoding.
        if (!gMsgCompose.checkCharsetConversion(getCurrentIdentity(), fallbackCharset))
        {
          var disableFallback = false;
          try
          {
            disableFallback = getPref("mailnews.disable_fallback_to_utf8." + originalCharset);
          }
          catch (e) {}
          if (disableFallback)
            msgCompFields.needToCheckCharset = false;
          else
            fallbackCharset.value = "UTF-8";
        }

        if (fallbackCharset &&
            fallbackCharset.value && fallbackCharset.value != "")
          gMsgCompose.SetDocumentCharset(fallbackCharset.value);
      }
      try {

        // just before we try to send the message, fire off the compose-send-message event for listeners
        // such as smime so they can do any pre-security work such as fetching certificates before sending
        var event = document.createEvent('UIEvents');
        event.initEvent('compose-send-message', false, true);
        var msgcomposeWindow = document.getElementById("msgcomposeWindow");
        msgcomposeWindow.setAttribute("msgtype", msgType);
        msgcomposeWindow.dispatchEvent(event);
        if (event.getPreventDefault())
          throw Components.results.NS_ERROR_ABORT;

        gAutoSaving = (msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft);
        // disable the ui if we're not auto-saving
        if (!gAutoSaving)
        {
          gWindowLocked = true;
          disableEditableFields();
          updateComposeItems();
        }
        // if we're auto saving, mark the body as not changed here, and not
        // when the save is done, because the user might change it between now
        // and when the save is done.
        else
          SetContentAndBodyAsUnmodified();

        var progress = Components.classes["@mozilla.org/messenger/progress;1"].createInstance(Components.interfaces.nsIMsgProgress);
        if (progress)
        {
          progress.registerListener(progressListener);
          gSendOrSaveOperationInProgress = true;
        }
        msgWindow.domWindow = window;
        msgWindow.rootDocShell.allowAuth = true;
        gMsgCompose.SendMsg(msgType, getCurrentIdentity(), currentAccountKey, msgWindow, progress);
      }
      catch (ex) {
        dump("failed to SendMsg: " + ex + "\n");
        gWindowLocked = false;
        enableEditableFields();
        updateComposeItems();
      }
      if (gMsgCompose && originalCharset != gMsgCompose.compFields.characterSet)
        SetDocumentCharacterSet(gMsgCompose.compFields.characterSet);
    }
  }
  else
    dump("###SendMessage Error: composeAppCore is null!\n");
}

function CheckValidEmailAddress(to, cc, bcc)
{
  var invalidStr = null;
  // crude check that the to, cc, and bcc fields contain at least one '@'.
  // We could parse each address, but that might be overkill.
  if (to.length > 0 && (to.indexOf("@") <= 0 || to.indexOf("@") == to.length - 1))
    invalidStr = to;
  else if (cc.length > 0 && (cc.indexOf("@") <= 0 || cc.indexOf("@") == cc.length - 1))
    invalidStr = cc;
  else if (bcc.length > 0 && (bcc.indexOf("@") <= 0 || bcc.indexOf("@") == bcc.length - 1))
    invalidStr = bcc;
  if (invalidStr)
  {
    var bundle = document.getElementById("bundle_composeMsgs");
    var errorTitle = bundle.getString("sendMsgTitle");
    var errorMsg = bundle.getFormattedString("addressInvalid", [invalidStr], 1);
    if (gPromptService)
      gPromptService.alert(window, errorTitle, errorMsg);
    return false;
  }
  return true;
}

function SendMessage()
{
  let sendInBackground =
    Components.classes["@mozilla.org/preferences-service;1"]
              .getService(Components.interfaces.nsIPrefBranch)
              .getBoolPref("mailnews.sendInBackground");

  GenericSendMessage(sendInBackground ?
                     nsIMsgCompDeliverMode.Background :
                     nsIMsgCompDeliverMode.Now);
}

function SendMessageWithCheck()
{
    var warn = getPref("mail.warn_on_send_accel_key");

    if (warn) {
        var checkValue = {value:false};
        var bundle = document.getElementById("bundle_composeMsgs");
        var buttonPressed = gPromptService.confirmEx(window,
              bundle.getString('sendMessageCheckWindowTitle'),
              bundle.getString('sendMessageCheckLabel'),
              (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_0) +
              (gPromptService.BUTTON_TITLE_CANCEL * gPromptService.BUTTON_POS_1),
              bundle.getString('sendMessageCheckSendButtonLabel'),
              null, null,
              bundle.getString('CheckMsg'),
              checkValue);
        if (buttonPressed != 0) {
            return;
        }
        if (checkValue.value) {
            var branch = Components.classes["@mozilla.org/preferences-service;1"]
                                   .getService(Components.interfaces.nsIPrefBranch);

            branch.setBoolPref("mail.warn_on_send_accel_key", false);
        }
    }

  let sendInBackground =
    Components.classes["@mozilla.org/preferences-service;1"]
              .getService(Components.interfaces.nsIPrefBranch)
              .getBoolPref("mailnews.sendInBackground");

  GenericSendMessage(gIsOffline ? nsIMsgCompDeliverMode.Later :
                     (sendInBackground ?
                      nsIMsgCompDeliverMode.Background :
                      nsIMsgCompDeliverMode.Now));
}

function SendMessageLater()
{
  GenericSendMessage(nsIMsgCompDeliverMode.Later);
}

function Save()
{
  switch (defaultSaveOperation)
  {
    case "file"     : SaveAsFile(false);      break;
    case "template" : SaveAsTemplate(false);  break;
    default         : SaveAsDraft(false);     break;
  }
}

function SaveAsFile(saveAs)
{
  var subject = GetMsgSubjectElement().value;
  GetCurrentEditor().setDocumentTitle(subject);

  if (gMsgCompose.bodyConvertible() == nsIMsgCompConvertible.Plain)
    SaveDocument(saveAs, false, "text/plain");
  else
    SaveDocument(saveAs, false, "text/html");
  defaultSaveOperation = "file";
}

function SaveAsDraft()
{
  gAutoSaveKickedIn = false;
  gEditingDraft = true;

  GenericSendMessage(nsIMsgCompDeliverMode.SaveAsDraft);
  defaultSaveOperation = "draft";
}

function SaveAsTemplate()
{
  gAutoSaveKickedIn = false;
  gEditingDraft = false;

  GenericSendMessage(nsIMsgCompDeliverMode.SaveAsTemplate);
  defaultSaveOperation = "template";
}

// Sets the additional FCC, in addition to the default FCC.
function MessageFcc(aFolder)
{
  if (!gMsgCompose)
    return;

  var msgCompFields = gMsgCompose.compFields;
  if (!msgCompFields)
    return;

  // Get the uri for the folder to FCC into.
  var fccURI = aFolder.URI;
  msgCompFields.fcc2 = (msgCompFields.fcc2 == fccURI) ? "nocopy://" : fccURI;
}

function updatePriorityMenu()
{
  if (gMsgCompose)
  {
    var msgCompFields = gMsgCompose.compFields;
    if (msgCompFields && msgCompFields.priority)
    {
      var priorityMenu = document.getElementById('priorityMenu' );
      priorityMenu.getElementsByAttribute( "checked", 'true' )[0].removeAttribute('checked');
      priorityMenu.getElementsByAttribute( "value", msgCompFields.priority )[0].setAttribute('checked', 'true');
    }
  }
}

function updatePriorityToolbarButton(newPriorityValue)
{
  var prioritymenu = document.getElementById('priorityMenu-button');
  if (prioritymenu)
    prioritymenu.value = newPriorityValue;
}

function PriorityMenuSelect(target)
{
  if (gMsgCompose)
  {
    var msgCompFields = gMsgCompose.compFields;
    if (msgCompFields)
      msgCompFields.priority = target.getAttribute('value');

    // keep priority toolbar button in synch with possible changes via the menu item
    updatePriorityToolbarButton(target.getAttribute('value'));
  }
}

function OutputFormatMenuSelect(target)
{
  if (gMsgCompose)
  {
    var msgCompFields = gMsgCompose.compFields;
    var toolbar = document.getElementById("FormatToolbar");
    var format_menubar = document.getElementById("formatMenu");
    var insert_menubar = document.getElementById("insertMenu");
    var show_menuitem = document.getElementById("menu_showFormatToolbar");

    if (msgCompFields)
      switch (target.getAttribute('id'))
      {
        case "format_auto":  gSendFormat = nsIMsgCompSendFormat.AskUser;     break;
        case "format_plain": gSendFormat = nsIMsgCompSendFormat.PlainText;   break;
        case "format_html":  gSendFormat = nsIMsgCompSendFormat.HTML;        break;
        case "format_both":  gSendFormat = nsIMsgCompSendFormat.Both;        break;
      }
    gHideMenus = (gSendFormat == nsIMsgCompSendFormat.PlainText);
    format_menubar.hidden = gHideMenus;
    insert_menubar.hidden = gHideMenus;
    show_menuitem.hidden = gHideMenus;
    toolbar.hidden = gHideMenus ||
      (show_menuitem.getAttribute("checked") == "false");
  }
}

// walk through the recipients list and add them to the inline spell checker ignore list
function addRecipientsToIgnoreList(aAddressesToAdd)
{
  if (InlineSpellCheckerUI.enabled)
  {
    // break the list of potentially many recipients back into individual names
    var hdrParser = Components.classes["@mozilla.org/messenger/headerparser;1"].getService(Components.interfaces.nsIMsgHeaderParser);
    var emailAddresses = {};
    var names = {};
    var fullNames = {};
    var numAddresses = hdrParser.parseHeadersWithArray(aAddressesToAdd, emailAddresses, names, fullNames);
    var tokenizedNames = new Array();

    // each name could consist of multiple word delimited by either commas or spaces. i.e. Green Lantern
    // or Lantern,Green. Tokenize on comma first, then tokenize again on spaces.
    for (name in names.value)
    {
      var splitNames = names.value[name].split(',');
      for (let i = 0; i < splitNames.length; i++)
      {
        // now tokenize off of white space
        var splitNamesFromWhiteSpaceArray = splitNames[i].split(' ');
        for (let whiteSpaceIndex = 0; whiteSpaceIndex < splitNamesFromWhiteSpaceArray.length; whiteSpaceIndex++)
          if (splitNamesFromWhiteSpaceArray[whiteSpaceIndex])
            tokenizedNames.push(splitNamesFromWhiteSpaceArray[whiteSpaceIndex]);
      }
    }

    InlineSpellCheckerUI.mInlineSpellChecker.ignoreWords(tokenizedNames, tokenizedNames.length);
  }
}

function InitLanguageMenu()
{
  var languageMenuList = document.getElementById('languageMenuList');
  if (!languageMenuList)
    return;

  var spellChecker = Components.classes['@mozilla.org/spellchecker/engine;1']
                               .getService(mozISpellCheckingEngine);
  var o1 = {};
  var o2 = {};

  // Get the list of dictionaries from
  // the spellchecker.

  spellChecker.getDictionaryList(o1, o2);

  var dictList = o1.value;
  var count    = o2.value;

  // If dictionary count hasn't changed then no need to update the menu.
  if (sDictCount == count)
    return;

  // Store current dictionary count.
  sDictCount = count;

  // Load the string bundle that will help us map
  // RFC 1766 strings to UI strings.
  var languageBundle = document.getElementById("languageBundle");
  var isoStrArray;
  var langId;
  var langLabel;

  for (let i = 0; i < count; i++)
  {
    try
    {
      langId = dictList[i];
      isoStrArray = dictList[i].split("-");

      if (languageBundle && isoStrArray[0])
        langLabel = languageBundle.getString(isoStrArray[0].toLowerCase());

      // the user needs to be able to distinguish between the UK English dictionary
      // and say the United States English Dictionary. If we have a isoStr value then
      // wrap it in parentheses and append it to the menu item string. i.e.
      // English (US) and English (UK)
      if (!langLabel)
        langLabel = langId;
      // if we have a language ID like US or UK, append it to the menu item, and any sub-variety
      else if (isoStrArray.length > 1 && isoStrArray[1]) {
        langLabel += ' (' + isoStrArray[1];
        if (isoStrArray.length > 2 && isoStrArray[2])
          langLabel += '-' + isoStrArray[2];
        langLabel += ')';
      }
    }
    catch (ex)
    {
      // getString throws an exception when a key is not found in the
      // bundle. In that case, just use the original dictList string.
      langLabel = langId;
    }
    dictList[i] = [langLabel, langId];
  }

  // sort by locale-aware collation
  dictList.sort(
    function compareFn(a, b)
    {
      return a[0].localeCompare(b[0]);
    }
  );

  // Remove any languages from the list.
  while (languageMenuList.hasChildNodes())
    languageMenuList.removeChild(languageMenuList.firstChild);

  for (let i = 0; i < count; i++)
  {
    var item = document.createElement("menuitem");
    item.setAttribute("label", dictList[i][0]);
    item.setAttribute("value", dictList[i][1]);
    item.setAttribute('type', 'radio');
    languageMenuList.appendChild(item);
  }
}

function OnShowDictionaryMenu(aTarget)
{
  InitLanguageMenu();
  var curLang = getPref("spellchecker.dictionary", true);
  var languages = aTarget.getElementsByAttribute("value", curLang);
  if (languages.length > 0)
    languages[0].setAttribute("checked", true);
}

function ChangeLanguage(event)
{
  // We need to change the dictionary language and if we are using inline spell check,
  // recheck the message

  var spellChecker = Components.classes['@mozilla.org/spellchecker/engine;1']
                               .getService(mozISpellCheckingEngine);
  if (spellChecker.dictionary != event.target.value)
  {
    spellChecker.dictionary = event.target.value;
    var str = Components.classes["@mozilla.org/supports-string;1"]
                        .createInstance(nsISupportsString);
    str.data = event.target.value;
    var branch = Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch);

    branch.setComplexValue("spellchecker.dictionary", nsISupportsString, str);

    // now check the document over again with the new dictionary
    if (InlineSpellCheckerUI.enabled)
      InlineSpellCheckerUI.mInlineSpellChecker.spellCheckRange(null);
  }
  event.stopPropagation();
}

function ToggleReturnReceipt(target)
{
    var msgCompFields = gMsgCompose.compFields;
    if (msgCompFields)
    {
        msgCompFields.returnReceipt = ! msgCompFields.returnReceipt;
        target.setAttribute('checked', msgCompFields.returnReceipt);
        gReceiptOptionChanged = true;
    }
}

function ToggleDSN(target)
{
    var msgCompFields = gMsgCompose.compFields;
    if (msgCompFields)
    {
        msgCompFields.DSN = ! msgCompFields.DSN;
        target.setAttribute('checked', msgCompFields.DSN);
        gDSNOptionChanged = true;
    }
}

function ToggleAttachVCard(target)
{
  var msgCompFields = gMsgCompose.compFields;
  if (msgCompFields)
  {
    msgCompFields.attachVCard = ! msgCompFields.attachVCard;
    target.setAttribute('checked', msgCompFields.attachVCard);
    gAttachVCardOptionChanged = true;
  }
}

function queryISupportsArray(supportsArray, iid) {
    var result = new Array;
    let count = supportsArray.Count();
    for (let i = 0; i < count; i++)
      result[i] = supportsArray.QueryElementAt(i, iid);

    return result;
}

function ClearIdentityListPopup(popup)
{
  if (popup)
    while (popup.hasChildNodes())
      popup.removeChild(popup.lastChild);
}

function FillIdentityList(menulist)
{
  var mgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                      .getService(Components.interfaces.nsIMsgAccountManager);
  var accounts = queryISupportsArray(mgr.accounts,
                                     Components.interfaces.nsIMsgAccount);

  // Ugly hack to work around bug 41133. :-(
  accounts = accounts.filter(function isNonSuckyAccount(a) { return !!a.incomingServer; });
  function sortAccounts(a, b) {
    if (a.key == mgr.defaultAccount.key)
      return -1;
    if (b.key == mgr.defaultAccount.key)
      return 1;
    var aIsNews = a.incomingServer.type == "nntp";
    var bIsNews = b.incomingServer.type == "nntp";
    if (aIsNews && !bIsNews)
      return 1;
    if (bIsNews && !aIsNews)
      return -1;

    var aIsLocal = a.incomingServer.type == "none";
    var bIsLocal = b.incomingServer.type == "none";
    if (aIsLocal && !bIsLocal)
      return 1;
    if (bIsLocal && !aIsLocal)
      return -1;
    return 0;
  }
  accounts.sort(sortAccounts);

  for each (var account in accounts) {
    var identites = queryISupportsArray(account.identities,
                                        Components.interfaces.nsIMsgIdentity);
    for each (var identity in identites) {
      var item = menulist.appendItem(identity.identityName, identity.key,
                                     account.incomingServer.prettyName);
      item.setAttribute("accountkey", account.key);
    }
  }
}

function getCurrentIdentity()
{
    // fill in Identity combobox
    var identityList = document.getElementById("msgIdentity");

    var identityKey = identityList.value;

    //dump("Looking for identity " + identityKey + "\n");
    var identity = gAccountManager.getIdentity(identityKey);

    return identity;
}

function getCurrentAccountKey()
{
    // get the accounts key
    var identityList = document.getElementById("msgIdentity");
    return identityList.selectedItem.getAttribute("accountkey");
}

function getIdentityForKey(key)
{
    return gAccountManager.getIdentity(key);
}

function AdjustFocus()
{
  //dump("XXX adjusting focus\n");
  var element = awGetInputElement(awGetNumberOfRecipients());
  if (element.value == "") {
      //dump("XXX focus on address\n");
      awSetFocus(awGetNumberOfRecipients(), element);
  }
  else
  {
      element = GetMsgSubjectElement();
      if (element.value == "") {
        //dump("XXX focus on subject\n");
        element.focus();
      }
      else {
        //dump("XXX focus on body\n");
        SetMsgBodyFrameFocus();
      }
  }
}

function SetComposeWindowTitle()
{
  var newTitle = GetMsgSubjectElement().value;

  var bundle = document.getElementById("bundle_composeMsgs");
  if (newTitle == "" )
    newTitle = bundle.getString("defaultSubject");

  newTitle += GetCharsetUIString();
  document.title = bundle.getString("windowTitlePrefix") + " " + newTitle;
}

// Check for changes to document and allow saving before closing
// This is hooked up to the OS's window close widget (e.g., "X" for Windows)
function ComposeCanClose()
{
  if (gSendOrSaveOperationInProgress)
  {
    var result;

    if (gPromptService)
    {
      var brandBundle = document.getElementById("brandBundle");
      var brandShortName = brandBundle.getString("brandShortName");
      var bundle = document.getElementById("bundle_composeMsgs");
      var promptTitle = bundle.getString("quitComposeWindowTitle");
      var promptMsg = bundle.getFormattedString("quitComposeWindowMessage2",
                                                [brandShortName], 1);
      var quitButtonLabel = bundle.getString("quitComposeWindowQuitButtonLabel2");
      var waitButtonLabel = bundle.getString("quitComposeWindowWaitButtonLabel2");

      result = gPromptService.confirmEx(window, promptTitle, promptMsg,
          (gPromptService.BUTTON_TITLE_IS_STRING*gPromptService.BUTTON_POS_0) +
          (gPromptService.BUTTON_TITLE_IS_STRING*gPromptService.BUTTON_POS_1),
          waitButtonLabel, quitButtonLabel, null, null, {value:0});

      if (result == 1)
      {
        gMsgCompose.abort();
        return true;
      }
      return false;
    }
  }

  // Returns FALSE only if user cancels save action
  if (gContentChanged || gMsgCompose.bodyModified || gAutoSaveKickedIn)
  {
    // call window.focus, since we need to pop up a dialog
    // and therefore need to be visible (to prevent user confusion)
    window.focus();
    if (gPromptService)
    {
      var bundle = document.getElementById("bundle_composeMsgs");
      result = gPromptService.confirmEx(window,
                              bundle.getString("saveDlogTitle"),
                              bundle.getString("saveDlogMessage"),
                              (gPromptService.BUTTON_TITLE_SAVE * gPromptService.BUTTON_POS_0) +
                              (gPromptService.BUTTON_TITLE_CANCEL * gPromptService.BUTTON_POS_1) +
                              (gPromptService.BUTTON_TITLE_DONT_SAVE * gPromptService.BUTTON_POS_2),
                              null, null, null,
                              null, {value:0});
      switch (result)
      {
        case 0: //Save
          gCloseWindowAfterSave = true;
          GenericSendMessage(nsIMsgCompDeliverMode.AutoSaveAsDraft);
          return false;
        case 1: //Cancel
          return false;
        case 2: //Don't Save
          // don't delete the draft if we didn't start off editing a draft
          // and the user hasn't explicitly saved it.
          if (!gEditingDraft && gAutoSaveKickedIn)
            RemoveDraft();
          break;
      }
    }

    SetContentAndBodyAsUnmodified();
  }

  return true;
}

function RemoveDraft()
{
  try
  {
    var draftUri = gMsgCompose.compFields.draftId;
    var msgKey = draftUri.substr(draftUri.indexOf('#') + 1);
    var rdf = Components.classes['@mozilla.org/rdf/rdf-service;1']
                        .getService(Components.interfaces.nsIRDFService);

    var folder = rdf.GetResource(gMsgCompose.savedFolderURI)
                    .QueryInterface(Components.interfaces.nsIMsgFolder);
    try {
      if (folder.flags & Components.interfaces.nsMsgFolderFlags.Drafts)
      {
        var msgs = Components.classes["@mozilla.org/array;1"].
            createInstance(Components.interfaces.nsIMutableArray);
        msgs.appendElement(folder.GetMessageHeader(msgKey), false);
        folder.deleteMessages(msgs, null, true, false, null, false);
      }
    }
    catch (ex) // couldn't find header - perhaps an imap folder.
    {
      var imapFolder = folder.QueryInterface(Components.interfaces.nsIMsgImapMailFolder);
      var keyArray = new Array;
      keyArray[0] = msgKey;
      imapFolder.storeImapFlags(8, true, keyArray, 1, null);
    }
  } catch (ex) {}
}

function SetContentAndBodyAsUnmodified()
{
  gMsgCompose.bodyModified = false;
  gContentChanged = false;
}

function ReleaseAutoCompleteState()
{
  let maxRecipients = awGetMaxRecipients();
  for (let i = 1; i <= maxRecipients; i++)
    document.getElementById("addressCol2#" + i).removeSession(gLDAPSession);

  gSessionAdded = false;
  gLDAPSession = null;
}

function MsgComposeCloseWindow(recycleIt)
{
  if (gMsgCompose)
    gMsgCompose.CloseWindow(recycleIt);
  else
    window.close();
}

function GetLastAttachDirectory()
{
  var lastDirectory;

  try {
    var branch = Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch);
    lastDirectory = branch.getComplexValue(kComposeAttachDirPrefName, Components.interfaces.nsILocalFile);
  }
  catch (ex) {
    // this will fail the first time we attach a file
    // as we won't have a pref value.
    lastDirectory = null;
  }

  return lastDirectory;
}

// attachedLocalFile must be a nsILocalFile
function SetLastAttachDirectory(attachedLocalFile)
{
  try {
    var file = attachedLocalFile.QueryInterface(Components.interfaces.nsIFile);
    var parent = file.parent.QueryInterface(Components.interfaces.nsILocalFile);

    var branch = Components.classes["@mozilla.org/preferences-service;1"]
                           .getService(Components.interfaces.nsIPrefBranch);
    branch.setComplexValue(kComposeAttachDirPrefName, Components.interfaces.nsILocalFile, parent);
  }
  catch (ex) {
    dump("error: SetLastAttachDirectory failed: " + ex + "\n");
  }
}

function AttachFile()
{
  //Get file using nsIFilePicker and convert to URL
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  var bundle = document.getElementById("bundle_composeMsgs");
  fp.init(window, bundle.getString("chooseFileToAttach"),
          nsIFilePicker.modeOpenMultiple);

  var lastDirectory = GetLastAttachDirectory();
  if (lastDirectory)
    fp.displayDirectory = lastDirectory;

  fp.appendFilters(nsIFilePicker.filterAll);
  if (fp.show() == nsIFilePicker.returnOK)
  {
    let attachments = fp.files;
    if (!attachments || !attachments.hasMoreElements())
      return;
    let file;
    do {
      file = attachments.getNext().QueryInterface(Components.interfaces.nsILocalFile);
      AddFileAttachment(file);
    } while (attachments.hasMoreElements())
    SetLastAttachDirectory(file);
  }
}
/**
 * Add a file object as attachment. This is mostly just a helper function to
 * wrap a file into an nsIMsgAttachment object with it's URL set.
 * @param file the nsIFile object to add as attachment
 */
function AddFileAttachment(file)
{
  var fileHandler = Components.classes["@mozilla.org/network/io-service;1"]
                              .getService(Components.interfaces.nsIIOService)
                              .getProtocolHandler("file")
                              .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  var attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                             .createInstance(Components.interfaces.nsIMsgAttachment);

  attachment.url = fileHandler.getURLSpecFromFile(file);
  AddUrlAttachment(attachment);
}

/**
 * Add an attachment object as attachment. The attachment URL must be set.
 * @param attachment the nsIMsgAttachment object to add as attachment
 */
function AddUrlAttachment(attachment)
{
  if (!(attachment && attachment.url) ||
      DuplicateFileAlreadyAttached(attachment.url))
    return;

  if (!attachment.name)
    attachment.name = gMsgCompose.AttachmentPrettyName(attachment.url, null);

  var bundle = document.getElementById("bundle_composeMsgs");

  // For security reasons, don't allow *-message:// uris to leak out.
  // We don't want to reveal the .slt path (for mailbox://), or the username
  // or hostname.
  if (/^mailbox-message:|^imap-message:|^news-message:/i.test(attachment.name))
    attachment.name = bundle.getString("messageAttachmentSafeName");
  // Don't allow file or mail/news protocol uris to leak out either.
  else if (/^file:|^mailbox:|^imap:|^s?news:/i.test(attachment.name))
    attachment.name = bundle.getString("partAttachmentSafeName");

  var bucket = document.getElementById("attachmentBucket");
  var item = bucket.appendItem(attachment.name, "");
  item.attachment = attachment; // Full attachment object stored here.
  try {
    item.setAttribute("tooltiptext", decodeURI(attachment.url));
  }
  catch(e) {
    item.setAttribute("tooltiptext", attachment.url);
  }
  item.setAttribute("class", "listitem-iconic");

  // For local file urls, we are better off using the full file url because
  // moz-icon will actually resolve the file url and get the right icon from
  // the file url. All other urls, we should try to extract the file name from
  // them. This fixes issues were an icon wasn't showing up if you dragged a
  // web url that had a query or reference string after the file name and for
  // mailnews urls were the filename is hidden in the url as a &filename= part.
  var url = gIOService.newURI(attachment.url, null, null);
  if (url instanceof Components.interfaces.nsIURL &&
      url.fileName && !url.schemeIs("file"))
    item.setAttribute("image", "moz-icon://" + url.fileName);
  else
    item.setAttribute("image", "moz-icon:" + attachment.url);

  ChangeAttachmentBucketVisibility(false);
  gContentChanged = true;
}

function SelectAllAttachments()
{
  var bucketList = document.getElementById("attachmentBucket");
  if (bucketList)
    bucketList.selectAll();
}

function MessageHasAttachments()
{
  var bucketList = document.getElementById("attachmentBucket");
  if (bucketList) {
    return (bucketList && bucketList.getRowCount() && (bucketList == top.document.commandDispatcher.focusedElement));
  }
  return false;
}

function MessageGetNumSelectedAttachments()
{
  var bucketList = document.getElementById("attachmentBucket");
  return (bucketList) ? bucketList.selectedItems.length : 0;
}

function AttachPage()
{
   if (gPromptService)
   {
      var result = {value:"http://"};
      var bundle = document.getElementById("bundle_composeMsgs");
      if (gPromptService.prompt(window,
                                bundle.getString("attachPageDlogTitle"),
                                bundle.getString("attachPageDlogMessage"),
                                result,
                                null,
                                {value:0}))
      {
        var attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                                   .createInstance(Components.interfaces.nsIMsgAttachment);
        attachment.url = result.value;
        AddUrlAttachment(attachment);
      }
   }
}

/**
 * Check if the given fileURL already exists in the attachment bucket.
 * @param fileURL the URL (as a String) of the file to check
 * @return true if the fileURL is already attached
 */
function DuplicateFileAlreadyAttached(fileURL)
{
  var bucket = document.getElementById('attachmentBucket');
  let rowCount = bucket.getRowCount();
  for (let i = 0; i < rowCount; i++)
  {
    let attachment = bucket.getItemAtIndex(i).attachment;
    if (attachment && attachment.url == fileURL)
      return true;
  }
  return false;
}

function Attachments2CompFields(compFields)
{
  var bucket = document.getElementById('attachmentBucket');

  //First, we need to clear all attachment in the compose fields
  compFields.removeAttachments();

  let rowCount = bucket.getRowCount();
  for (let i = 0; i < rowCount; i++)
  {
    let attachment = bucket.getItemAtIndex(i).attachment;
    if (attachment)
      compFields.addAttachment(attachment);
  }
}

function RemoveAllAttachments()
{
  var child;
  var bucket = document.getElementById("attachmentBucket");
  while (bucket.getRowCount())
  {
    child = bucket.removeItemAt(bucket.getRowCount() - 1);
    // Let's release the attachment object hold by the node else it won't go away until the window is destroyed
    child.attachment = null;
  }

  ChangeAttachmentBucketVisibility(true);
}

function ChangeAttachmentBucketVisibility(aHideBucket)
{
  document.getElementById("attachments-box").collapsed = aHideBucket;
  document.getElementById("attachmentbucket-sizer").collapsed = aHideBucket;
}

function RemoveSelectedAttachment()
{
  var child;
  var bucket = document.getElementById("attachmentBucket");
  if (bucket.selectedItems.length > 0) {
    for (let i = bucket.selectedCount - 1; i >= 0; i--)
    {
      child = bucket.removeItemAt(bucket.getIndexOfItem(bucket.getSelectedItem(i)));
      // Let's release the attachment object held by the node else it won't go away until the window is destroyed
      child.attachment = null;
    }
    gContentChanged = true;
  }
}

function RenameSelectedAttachment()
{
  var bucket = document.getElementById("attachmentBucket");
  if (bucket.selectedItems.length != 1)
    return; // not one attachment selected

  var bundle = document.getElementById("bundle_composeMsgs");
  var item = bucket.getSelectedItem(0);
  var attachmentName = {value: item.attachment.name};
  if (gPromptService.prompt(
                     window,
                     bundle.getString("renameAttachmentTitle"),
                     bundle.getString("renameAttachmentMessage"),
                     attachmentName,
                     null,
                     {value: 0}))
  {
    var modifiedAttachmentName = attachmentName.value;
    if (modifiedAttachmentName == "")
      return; // name was not filled, bail out

    item.label = modifiedAttachmentName;
    item.attachment.name = modifiedAttachmentName;
    gContentChanged = true;
  }
}

function FocusOnFirstAttachment()
{
  var bucketList = document.getElementById("attachmentBucket");

  if (bucketList && bucketList.getRowCount())
    bucketList.selectedIndex = 0;
}

function AttachmentElementHasItems()
{
  var element = document.getElementById("attachmentBucket");
  return element ? element.getRowCount() : 0;
}

function OpenSelectedAttachment()
{
  var child;
  var bucket = document.getElementById("attachmentBucket");
  if (bucket.selectedItems.length == 1)
  {
    var attachmentUrl = bucket.getSelectedItem(0).attachment.url;

    var messagePrefix = /^mailbox-message:|^imap-message:|^news-message:/i;
    if (messagePrefix.test(attachmentUrl))
    {
      // we must be dealing with a forwarded attachment, treat this special
      var messenger = Components.classes["@mozilla.org/messenger;1"].createInstance();
      messenger = messenger.QueryInterface(Components.interfaces.nsIMessenger);
      var msgHdr = messenger.messageServiceFromURI(attachmentUrl).messageURIToMsgHdr(attachmentUrl);
      if (msgHdr)
      {
        var folderUri = msgHdr.folder.folderURL;
        window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank", "all,chrome,dialog=no,status,toolbar",
                          attachmentUrl, folderUri, null );
      }
    }
    else
    {
      // turn the url into a nsIURL object then open it

      var url = gIOService.newURI(attachmentUrl, null, null);
      url = url.QueryInterface( Components.interfaces.nsIURL );

      if (url)
      {
        var channel = gIOService.newChannelFromURI(url);
        if (channel)
        {
          var uriLoader = Components.classes["@mozilla.org/uriloader;1"].getService(Components.interfaces.nsIURILoader);
          uriLoader.openURI(channel, true, new nsAttachmentOpener());
        } // if channel
      } // if url
    }
  } // if one attachment selected
}

function nsAttachmentOpener()
{
}

nsAttachmentOpener.prototype =
{
  QueryInterface: function(iid)
  {
    if (iid.equals(Components.interfaces.nsIURIContentListener) ||
        iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
        iid.equals(Components.interfaces.nsISupports))
        return this;
    throw Components.results.NS_NOINTERFACE;
  },

  onStartURIOpen: function(uri)
  {
    return;
  },

  doContent: function(contentType, isContentPreferred, request, contentHandler)
  {
    return;
  },

  isPreferred: function(contentType, desiredContentType)
  {
    return;
  },

  canHandleContent: function(contentType, isContentPreferred, desiredContentType)
  {
    return false;
  },

  getInterface: function(iid)
  {
    if (iid.equals(Components.interfaces.nsIDOMWindowInternal))
      return window;
    else
      return this.QueryInterface(iid);
  },

  loadCookie: null,
  parentContentListener: null
}

function DetermineHTMLAction(convertible)
{
    var obj;
    if (! gMsgCompose.composeHTML)
    {
        try {
          obj = new Object;
          gMsgCompose.checkAndPopulateRecipients(true, false, obj);
        } catch(ex) {
          dump("gMsgCompose.checkAndPopulateRecipients failed: " + ex + "\n");
        }
        return nsIMsgCompSendFormat.PlainText;
    }

    if (gSendFormat == nsIMsgCompSendFormat.AskUser)
    {
        //Well, before we ask, see if we can figure out what to do for ourselves

        var noHtmlRecipients;
        var noHtmlnewsgroups;
        var preferFormat;

        //Check the address book for the HTML property for each recipient
        try {
          obj = new Object;
          preferFormat = gMsgCompose.checkAndPopulateRecipients(true, true, obj);
          noHtmlRecipients = obj.value;
        } catch(ex) {
          dump("gMsgCompose.checkAndPopulateRecipients failed: " + ex + "\n");
          var msgCompFields = gMsgCompose.compFields;
          noHtmlRecipients = msgCompFields.to + "," + msgCompFields.cc + "," + msgCompFields.bcc;
          preferFormat = nsIAbPreferMailFormat.unknown;
        }
        // dump("DetermineHTMLAction: preferFormat = " + preferFormat + ", noHtmlRecipients are " + noHtmlRecipients + "\n");

        //Check newsgroups now...
        noHtmlnewsgroups = gMsgCompose.compFields.newsgroups;

        if (noHtmlRecipients != "" || noHtmlnewsgroups != "")
        {
            if (convertible == nsIMsgCompConvertible.Plain)
              return nsIMsgCompSendFormat.PlainText;

            if (noHtmlnewsgroups == "")
            {
                switch (preferFormat)
                {
                  case nsIAbPreferMailFormat.plaintext :
                    return nsIMsgCompSendFormat.PlainText;

                  default :
                    //See if a preference has been set to tell us what to do. Note that we do not honor that
                    //preference for newsgroups. Only for e-mail addresses.
                    var action = getPref("mail.default_html_action");
                    switch (action)
                    {
                        case nsIMsgCompSendFormat.PlainText    :
                        case nsIMsgCompSendFormat.HTML         :
                        case nsIMsgCompSendFormat.Both         :
                            return action;
                    }
                }
            }
            return nsIMsgCompSendFormat.AskUser;
        }
        else
            return nsIMsgCompSendFormat.HTML;
    }
    else
    {
      try {
        obj = new Object;
        gMsgCompose.checkAndPopulateRecipients(true, false, obj);
      } catch(ex) {
          dump("gMsgCompose.checkAndPopulateRecipients failed: " + ex + "\n");
      }
    }

    return gSendFormat;
}

function DetermineConvertibility()
{
    if (!gMsgCompose.composeHTML)
        return nsIMsgCompConvertible.Plain;

    try {
        return gMsgCompose.bodyConvertible();
    } catch(ex) {}
    return nsIMsgCompConvertible.No;
}

function LoadIdentity(startup)
{
    var identityElement = document.getElementById("msgIdentity");
    var prevIdentity = gCurrentIdentity;

    if (identityElement) {
        var idKey = identityElement.value;
        gCurrentIdentity = gAccountManager.getIdentity(idKey);

        // set the  account name on the menu list value.
        if (identityElement.selectedItem)
          identityElement.setAttribute('accountname', identityElement.selectedItem.getAttribute('accountname'));

        let maxRecipients = awGetMaxRecipients();
        for (let i = 1; i <= maxRecipients; i++)
          awGetInputElement(i).setAttribute("autocompletesearchparam", idKey);

        if (!startup && prevIdentity && idKey != prevIdentity.key)
        {
          var prefstring = "mail.identity." + prevIdentity.key;
          RemoveDirectoryServerObserver(prefstring);
          var prevReplyTo = prevIdentity.replyTo;
          var prevBcc = "";
          var prevReceipt = prevIdentity.requestReturnReceipt;
          var prevDSN = prevIdentity.DSN;
          var prevAttachVCard = prevIdentity.attachVCard;

          if (prevIdentity.doBcc)
            prevBcc += prevIdentity.doBccList;

          var newReplyTo = gCurrentIdentity.replyTo;
          var newBcc = "";
          var newReceipt = gCurrentIdentity.requestReturnReceipt;
          var newDSN = gCurrentIdentity.DSN;
          var newAttachVCard = gCurrentIdentity.attachVCard;

          if (gCurrentIdentity.doBcc)
            newBcc += gCurrentIdentity.doBccList;

          var needToCleanUp = false;
          var msgCompFields = gMsgCompose.compFields;

          if (!gReceiptOptionChanged &&
              prevReceipt == msgCompFields.returnReceipt &&
              prevReceipt != newReceipt)
          {
            msgCompFields.returnReceipt = newReceipt;
            document.getElementById("returnReceiptMenu").setAttribute('checked',msgCompFields.returnReceipt);
          }

          if (!gDSNOptionChanged &&
              prevDSN == msgCompFields.DSN &&
              prevDSN != newDSN)
          {
            msgCompFields.DSN = newDSN;
            document.getElementById("dsnMenu").setAttribute('checked',msgCompFields.DSN);
          }

          if (!gAttachVCardOptionChanged &&
              prevAttachVCard == msgCompFields.attachVCard &&
              prevAttachVCard != newAttachVCard)
          {
            msgCompFields.attachVCard = newAttachVCard;
            document.getElementById("cmd_attachVCard").setAttribute('checked',msgCompFields.attachVCard);
          }

          if (newReplyTo != prevReplyTo)
          {
            needToCleanUp = true;
            if (prevReplyTo != "")
              awRemoveRecipients(msgCompFields, "addr_reply", prevReplyTo);
            if (newReplyTo != "")
              awAddRecipients(msgCompFields, "addr_reply", newReplyTo);
          }

          if (newBcc != prevBcc)
          {
            needToCleanUp = true;
            if (prevBcc != "")
              awRemoveRecipients(msgCompFields, "addr_bcc", prevBcc);
            if (newBcc != "")
              awAddRecipients(msgCompFields, "addr_bcc", newBcc);
          }

          if (needToCleanUp)
            awCleanupRows();

          try {
            gMsgCompose.identity = gCurrentIdentity;
          } catch (ex) { dump("### Cannot change the identity: " + ex + "\n");}

          var event = document.createEvent('Events');
          event.initEvent('compose-from-changed', false, true);
          document.getElementById("msgcomposeWindow").dispatchEvent(event);
        }

      AddDirectoryServerObserver(false);
      if (!startup) {
          if (getPref("mail.autoComplete.highlightNonMatches"))
            document.getElementById('addressCol2#1').highlightNonMatches = true;

          try {
              setupLdapAutocompleteSession();
          } catch (ex) {
              // catch the exception and ignore it, so that if LDAP setup
              // fails, the entire compose window doesn't end up horked
          }

          addRecipientsToIgnoreList(gCurrentIdentity.identityName);  // only do this if we aren't starting up....it gets done as part of startup already
      }
    }
}

function setupAutocomplete()
{
  var autoCompleteWidget = document.getElementById("addressCol2#1");
  // When autocompleteToMyDomain is off there is no default entry with the domain
  // appended so reduce the minimum results for a popup to 2 in this case.
  if (!gCurrentIdentity.autocompleteToMyDomain)
    autoCompleteWidget.minResultsForPopup = 2;

  // if the pref is set to turn on the comment column, honor it here.
  // this element then gets cloned for subsequent rows, so they should
  // honor it as well
  //
  try
  {
    if (getPref("mail.autoComplete.highlightNonMatches"))
      autoCompleteWidget.highlightNonMatches = true;

    if (getPref("mail.autoComplete.commentColumn"))
      autoCompleteWidget.showCommentColumn = true;
  } catch (ex)
  {
      // if we can't get this pref, then don't show the columns (which is
      // what the XUL defaults to)
  }

  if (!gSetupLdapAutocomplete)
  {
    try
    {
          setupLdapAutocompleteSession();
    } catch (ex)
    {
          // catch the exception and ignore it, so that if LDAP setup
          // fails, the entire compose window doesn't end up horked
      }
  }
}

function subjectKeyPress(event)
{
  switch(event.keyCode) {
  case KeyEvent.DOM_VK_TAB:
    if (!event.shiftKey) {
      SetMsgBodyFrameFocus();
      event.preventDefault();
    }
    break;
  case KeyEvent.DOM_VK_RETURN:
    SetMsgBodyFrameFocus();
    break;
  }
}

function AttachmentBucketClicked(event)
{
  event.currentTarget.focus();

  if (event.button != 0)
    return;

  if (event.originalTarget.localName == "listboxbody")
    goDoCommand('cmd_attachFile');
  else if (event.originalTarget.localName == "listitem" && event.detail == 2)
    OpenSelectedAttachment();
}

// we can drag and drop addresses, files, messages and urls into the compose envelope
var envelopeDragObserver = {

  canHandleMultipleItems: true,

  onDrop: function (aEvent, aData, aDragSession)
    {
      var dataList = aData.dataList;
      var dataListLength = dataList.length;
      var errorTitle;
      var attachment;
      var errorMsg;

      for (let i = 0; i < dataListLength; i++)
      {
        var item = dataList[i].first;
        var prettyName;
        var rawData = item.data;

        // We could be dropping an attachment OR an address, check and do the right thing..

        if (item.flavour.contentType == "text/x-moz-url" ||
            item.flavour.contentType == "text/x-moz-message" ||
            item.flavour.contentType == "application/x-moz-file")
        {
          if (item.flavour.contentType == "application/x-moz-file")
          {
            var fileHandler = Components.classes["@mozilla.org/network/io-service;1"]
                                        .getService(Components.interfaces.nsIIOService)
                                        .getProtocolHandler("file")
                                        .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
            rawData = fileHandler.getURLSpecFromFile(rawData);
          }
          else
          {
            var separator = rawData.indexOf("\n");
            if (separator != -1)
            {
              prettyName = rawData.substr(separator+1);
              rawData = rawData.substr(0,separator);
            }
          }

          if (DuplicateFileAlreadyAttached(rawData))
          {
            dump("Skipping file "+rawData+"; already attached!\n");
          }
          else
          {
            var isValid = true;
            if (item.flavour.contentType == "text/x-moz-url") {
              // if this is a url (or selected text)
              // see if it's a valid url by checking
              // if we can extract a scheme
              // using the ioservice
              //
              // also skip mailto:, since it doesn't make sense
              // to attach and send mailto urls
              try {
                var scheme = gIOService.extractScheme(rawData);
                // don't attach mailto: urls
                if (scheme == "mailto")
                  isValid = false;
              }
              catch (ex) {
                isValid = false;
              }
            }

            if (isValid) {
              attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                                     .createInstance(Components.interfaces.nsIMsgAttachment);
              attachment.url = rawData;
              attachment.name = prettyName;
              AddUrlAttachment(attachment);
            }
          }
        }
        else if (item.flavour.contentType == "text/x-moz-address")
        {
          // process the address
          if (rawData)
            DropRecipient(aEvent.target, rawData);
        }
      }
    },

  onDragOver: function (aEvent, aFlavour, aDragSession)
    {
      if (aFlavour.contentType != "text/x-moz-address")
      {
        // make sure the attachment box is visible during drag over
        var attachmentBox = document.getElementById("attachments-box");
        if (attachmentBox.collapsed)
          ChangeAttachmentBucketVisibility(false);
      }
      else
      {
          DragAddressOverTargetControl(aEvent);
      }
    },

  onDragExit: function (aEvent, aDragSession)
    {
    },

  getSupportedFlavours: function ()
    {
      var flavourSet = new FlavourSet();
      flavourSet.appendFlavour("text/x-moz-url");
      flavourSet.appendFlavour("text/x-moz-message");
      flavourSet.appendFlavour("application/x-moz-file", "nsIFile");
      flavourSet.appendFlavour("text/x-moz-address");
      return flavourSet;
    }
};

function DisplaySaveFolderDlg(folderURI)
{
  try
  {
    var showDialog = gCurrentIdentity.showSaveMsgDlg;
  }
  catch (e)
  {
    return;
  }

  if (showDialog){
    var msgfolder = GetMsgFolderFromUri(folderURI, true);
    if (!msgfolder)
      return;
    var checkbox = {value:0};
    var bundle = document.getElementById("bundle_composeMsgs");
    var SaveDlgTitle = bundle.getString("SaveDialogTitle");
    var dlgMsg = bundle.getFormattedString("SaveDialogMsg",
                                           [msgfolder.name,
                                            msgfolder.server.prettyName]);

    var CheckMsg = bundle.getString("CheckMsg");
    gPromptService.alertCheck(window, SaveDlgTitle, dlgMsg,
                              bundle.getString("CheckMsg"), checkbox);
    try {
          gCurrentIdentity.showSaveMsgDlg = !checkbox.value;
    }//try
    catch (e) {
    return;
    }//catch

  }//if
  return;
}

function SetMsgAddressingWidgetTreeElementFocus()
{
  var element = awGetInputElement(awGetNumberOfRecipients());
  awSetFocus(awGetNumberOfRecipients(), element);
}

function SetMsgIdentityElementFocus()
{
  GetMsgIdentityElement().focus();
}

function SetMsgSubjectElementFocus()
{
  GetMsgSubjectElement().focus();
}

function SetMsgAttachmentElementFocus()
{
  GetMsgAttachmentElement().focus();
  FocusOnFirstAttachment();
}

function SetMsgBodyFrameFocus()
{
  // window.content.focus() fails to blur the currently focused element
  document.commandDispatcher
          .advanceFocusIntoSubtree(document.getElementById("appcontent"));
}

function GetMsgAddressingWidgetTreeElement()
{
  if (!gMsgAddressingWidgetTreeElement)
    gMsgAddressingWidgetTreeElement = document.getElementById("addressingWidgetTree");

  return gMsgAddressingWidgetTreeElement;
}

function GetMsgIdentityElement()
{
  if (!gMsgIdentityElement)
    gMsgIdentityElement = document.getElementById("msgIdentity");

  return gMsgIdentityElement;
}

function GetMsgSubjectElement()
{
  if (!gMsgSubjectElement)
    gMsgSubjectElement = document.getElementById("msgSubject");

  return gMsgSubjectElement;
}

function GetMsgAttachmentElement()
{
  if (!gMsgAttachmentElement)
    gMsgAttachmentElement = document.getElementById("attachmentBucket");

  return gMsgAttachmentElement;
}

function GetMsgHeadersToolbarElement()
{
  if (!gMsgHeadersToolbarElement)
    gMsgHeadersToolbarElement = document.getElementById("MsgHeadersToolbar");

  return gMsgHeadersToolbarElement;
}

function WhichElementHasFocus()
{
  var msgIdentityElement             = GetMsgIdentityElement();
  var msgAddressingWidgetTreeElement = GetMsgAddressingWidgetTreeElement();
  var msgSubjectElement              = GetMsgSubjectElement();
  var msgAttachmentElement           = GetMsgAttachmentElement();

  if (top.document.commandDispatcher.focusedWindow == content)
    return content;

  var currentNode = top.document.commandDispatcher.focusedElement;
  while (currentNode)
  {
    if (currentNode == msgIdentityElement ||
        currentNode == msgAddressingWidgetTreeElement ||
        currentNode == msgSubjectElement ||
        currentNode == msgAttachmentElement)
      return currentNode;

    currentNode = currentNode.parentNode;
  }

  return null;
}

// Function that performs the logic of switching focus from
// one element to another in the mail compose window.
// The default element to switch to when going in either
// direction (shift or no shift key pressed), is the
// AddressingWidgetTreeElement.
//
// The only exception is when the MsgHeadersToolbar is
// collapsed, then the focus will always be on the body of
// the message.
function SwitchElementFocus(event)
{
  var focusedElement = WhichElementHasFocus();

  if (event && event.shiftKey)
  {
    if (focusedElement == gMsgAddressingWidgetTreeElement)
      SetMsgIdentityElementFocus();
    else if (focusedElement == gMsgIdentityElement)
      SetMsgBodyFrameFocus();
    else if (focusedElement == content)
    {
      // only set focus to the attachment element if there
      // are any attachments.
      if (AttachmentElementHasItems())
        SetMsgAttachmentElementFocus();
      else
        SetMsgSubjectElementFocus();
    }
    else if (focusedElement == gMsgAttachmentElement)
      SetMsgSubjectElementFocus();
    else
      SetMsgAddressingWidgetTreeElementFocus();
  }
  else
  {
    if (focusedElement == gMsgAddressingWidgetTreeElement)
      SetMsgSubjectElementFocus();
    else if (focusedElement == gMsgSubjectElement)
    {
      // only set focus to the attachment element if there
      // are any attachments.
      if (AttachmentElementHasItems())
        SetMsgAttachmentElementFocus();
      else
        SetMsgBodyFrameFocus();
    }
    else if (focusedElement == gMsgAttachmentElement)
      SetMsgBodyFrameFocus();
    else if (focusedElement == content)
      SetMsgIdentityElementFocus();
    else
      SetMsgAddressingWidgetTreeElementFocus();
  }
}

function toggleAddressPicker()
{
  var sidebarBox = document.getElementById("sidebar-box");
  var sidebarSplitter = document.getElementById("sidebar-splitter");
  var elt = document.getElementById("viewAddressPicker");
  if (sidebarBox.hidden)
  {
    sidebarBox.hidden = false;
    sidebarSplitter.hidden = false;
    elt.setAttribute("checked","true");

    var sidebar = document.getElementById("sidebar");
    var sidebarUrl = sidebar.getAttribute("src");
    // if we have yet to initialize the src url on the sidebar than go ahead and do so now...
    // we do this lazily here, so we don't spend time when bringing up the compose window loading the address book
    // data sources. Only when the user opens the address picker do we set the src url for the sidebar...
    if (sidebarUrl == "")
      sidebar.setAttribute("src", "chrome://messenger/content/addressbook/abContactsPanel.xul");

    sidebarBox.setAttribute("sidebarVisible", "true");
  }
  else
  {
    sidebarBox.hidden = true;
    sidebarSplitter.hidden = true;
    sidebarBox.setAttribute("sidebarVisible", "false");
    elt.removeAttribute("checked");
  }
}

// public method called by the address picker sidebar
function AddRecipient(recipientType, address)
{
  awAddRecipient(recipientType, address);
}

function loadHTMLMsgPrefs()
{
  var fontFace;
  var fontSize;
  var textColor;
  var bgColor;

  try {
    fontFace = getPref("msgcompose.font_face", true);
    doStatefulCommand('cmd_fontFace', fontFace);
  } catch (e) {}

  try {
    fontSize = getPref("msgcompose.font_size");
    EditorSetFontSize(fontSize);
  } catch (e) {}

  var bodyElement = GetBodyElement();

  try {
    textColor = getPref("msgcompose.text_color");
    if (!bodyElement.getAttribute("text"))
    {
    bodyElement.setAttribute("text", textColor);
    gDefaultTextColor = textColor;
    document.getElementById("cmd_fontColor").setAttribute("state", textColor);
    onFontColorChange();
    }
  } catch (e) {}

  try {
    bgColor = getPref("msgcompose.background_color");
    if (!bodyElement.getAttribute("bgcolor"))
    {
    bodyElement.setAttribute("bgcolor", bgColor);
    gDefaultBackgroundColor = bgColor;
    document.getElementById("cmd_backgroundColor").setAttribute("state", bgColor);
    onBackgroundColorChange();
    }
  } catch (e) {}
}

function AutoSave()
{
  if (gMsgCompose.editor && (gContentChanged || gMsgCompose.bodyModified)
      && !gSendOrSaveOperationInProgress)
  {
    GenericSendMessage(nsIMsgCompDeliverMode.AutoSaveAsDraft);
    gAutoSaveKickedIn = true;
  }

  gAutoSaveTimeout = setTimeout(AutoSave, gAutoSaveInterval);
}

function InitEditor()
{
  var editor = GetCurrentEditor();
  editor.QueryInterface(nsIEditorStyleSheets);
  // We use addOverrideStyleSheet rather than addStyleSheet so that we get
  // a synchronous load, rather than having a late-finishing async load
  // mark our editor as modified when the user hasn't typed anything yet,
  // but that means the sheet must not @import slow things, especially
  // not over the network.
  editor.addOverrideStyleSheet("chrome://messenger/content/composerOverlay.css");
  gMsgCompose.initEditor(editor, window.content);

  InlineSpellCheckerUI.init(editor);
  enableInlineSpellCheck(getPref("mail.spellcheck.inline"));
  document.getElementById('menu_inlineSpellCheck').setAttribute('disabled', !InlineSpellCheckerUI.canSpellCheck);
}

function enableInlineSpellCheck(aEnableInlineSpellCheck)
{
  InlineSpellCheckerUI.enabled = aEnableInlineSpellCheck;
  document.getElementById('msgSubject').setAttribute('spellcheck', aEnableInlineSpellCheck);
}

function getMailToolbox()
{
  return document.getElementById("compose-toolbox");
}

function getPref(aPrefName, aIsComplex) {
  const Ci = Components.interfaces;
  const prefB = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Ci.nsIPrefBranch);
  if (aIsComplex) {
      return prefB.getComplexValue(aPrefName, Ci.nsISupportsString).data;
  }
  switch (prefB.getPrefType(aPrefName)) {
    case Ci.nsIPrefBranch.PREF_BOOL:
      return prefB.getBoolPref(aPrefName);
    case Ci.nsIPrefBranch.PREF_INT:
      return prefB.getIntPref(aPrefName);
    case Ci.nsIPrefBranch.PREF_STRING:
      return prefB.getCharPref(aPrefName);
    default: // includes nsIPrefBranch.PREF_INVALID
      return null;
  }
}
