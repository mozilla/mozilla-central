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
Components.utils.import("resource:///modules/activity/activityModules.js");
Components.utils.import("resource://gre/modules/PluralForm.jsm");
Components.utils.import("resource:///modules/attachmentChecker.js");

Components.utils.import("resource:///modules/MailUtils.js");
Components.utils.import("resource:///modules/errUtils.js");
Components.utils.import("resource:///modules/iteratorUtils.jsm");
Components.utils.import("resource://gre/modules/InlineSpellChecker.jsm");
Components.utils.import("resource://gre/modules/Services.jsm")
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource:///modules/cloudFileAccounts.js");

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

var gMessenger = Components.classes["@mozilla.org/messenger;1"]
                           .createInstance(Components.interfaces.nsIMessenger)

var gSpellChecker = new InlineSpellChecker();

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
var gRemindLater;
var gComposeType;

// i18n globals
var gSendDefaultCharset;
var gCharsetTitle;
var gCharsetConvertManager;
var _gComposeBundle;
function getComposeBundle() {
  // That one has to be lazy. Getting a reference to an element with a XBL
  // binding attached will cause the XBL constructors to fire if they haven't
  // already. If we get a reference to the compose bundle at script load-time,
  // this will cause the XBL constructor that's responsible for the personas to
  // fire up, thus executing the personas code while the DOM is not fully built.
  // Since this <script> comes before the <statusbar>, the Personas code will
  // fail.
  if (!_gComposeBundle)
    _gComposeBundle = document.getElementById("bundle_composeMsgs");
  return _gComposeBundle;
}

var gLastWindowToHaveFocus;
var gReceiptOptionChanged;
var gDSNOptionChanged;
var gAttachVCardOptionChanged;

var gMailSession;
var gAutoSaveInterval;
var gAutoSaveTimeout;
var gAutoSaveKickedIn;
var gEditingDraft;
var gAttachmentsSize;
var gNumUploadingAttachments;

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
  gRemindLater = false;

  gLastWindowToHaveFocus = null;
  gReceiptOptionChanged = false;
  gDSNOptionChanged = false;
  gAttachVCardOptionChanged = false;
  gAttachmentsSize = 0;
  gNumUploadingAttachments = 0;
}
InitializeGlobalVariables();

function ReleaseGlobalVariables()
{
  gAccountManager = null;
  gIOService = null;
  gPromptService = null;
  gCurrentIdentity = null;
  gCurrentAutocompleteDirectory = null;
  if (gLDAPSession) {
    gLDAPSession = null;
    Components.utils.forceGC();
  }
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

    // Reset the Customize Toolbars panel/sheet if open.
    if (getMailToolbox().customizing && gCustomizeSheet)
      document.getElementById("customizeToolbarSheetIFrame")
              .contentWindow.finishToolbarCustomization();

    // Stop gSpellChecker so personal dictionary is saved
    enableInlineSpellCheck(false);
    // clear any suggestions in the context menu
    gSpellChecker.clearSuggestionsFromMenu();
    gSpellChecker.clearDictionaryListFromMenu();

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

var gSendListener = {
  // nsIMsgSendListener
  onStartSending: function (aMsgID, aMsgSize) {},
  onProgress: function (aMsgID, aProgress, aProgressMax) {},
  onStatus: function (aMsgID, aMsg) {},
  onStopSending: function (aMsgID, aStatus, aMsg, aReturnFile) {
    if (Components.isSuccessCode(aStatus))
      Services.obs.notifyObservers(null, "mail:composeSendSucceeded", null);
  },
  onGetDraftFolderURI: function (aFolderURI) {},
  onSendNotPerformed: function (aMsgID, aStatus) {},
};

// all progress notifications are done through the nsIWebProgressListener implementation...
var progressListener = {
    onStateChange: function(aWebProgress, aRequest, aStateFlags, aStatus)
    {
      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_START)
      {
        document.getElementById('compose-progressmeter').setAttribute( "mode", "undetermined" );
        document.getElementById("statusbar-progresspanel").collapsed = false;
      }

      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
      {
        gSendOrSaveOperationInProgress = false;
        document.getElementById('compose-progressmeter').setAttribute( "mode", "normal" );
        document.getElementById('compose-progressmeter').setAttribute( "value", 0 );
        document.getElementById("statusbar-progresspanel").collapsed = true;
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

    onLocationChange: function(aWebProgress, aRequest, aLocation, aFlags)
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

var defaultController = {
  commands: {
    cmd_attachFile: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        AttachFile();
      }
    },

    cmd_attachCloud: {
      isEnabled: function() {
        // Hide the command entirely if there are no cloud accounts or
        // the feature is disbled.
        let cmd = document.getElementById("cmd_attachCloud");
        cmd.hidden = !Services.prefs.getBoolPref("mail.cloud_files.enabled")
                     || (cloudFileAccounts.accounts.length == 0);
        return !cmd.hidden;
      },
      doCommand: function() {
        // We should never actually call this, since the <command> node calls
        // a different function.
      }
    },

    cmd_attachPage: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        AttachPage();
      }
    },

    cmd_close: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        DoCommandClose();
      }
    },

    cmd_saveDefault: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        Save();
      }
    },

    cmd_saveAsFile: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        SaveAsFile(true);
      }
    },

    cmd_saveAsDraft: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        SaveAsDraft();
      }
    },

    cmd_saveAsTemplate: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        SaveAsTemplate();
      }
    },

    cmd_sendButton: {
      isEnabled: function() {
        return !gWindowLocked && !gNumUploadingAttachments;
      },
      doCommand: function() {
        if (gIOService && gIOService.offline)
          SendMessageLater();
        else
          SendMessage();
      }
    },

    cmd_sendNow: {
      isEnabled: function() {
        return !gWindowLocked && !gIsOffline && !gNumUploadingAttachments;
      },
      doCommand: function() {
        SendMessage();
      }
    },

    cmd_sendLater: {
      isEnabled: function() {
        return !gWindowLocked && !gNumUploadingAttachments;
      },
      doCommand: function() {
        SendMessageLater();
      }
    },

    cmd_sendWithCheck: {
      isEnabled: function() {
        return !gWindowLocked && !gNumUploadingAttachments;
      },
      doCommand: function() {
        SendMessageWithCheck();
      }
    },

    cmd_printSetup: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        PrintUtils.showPageSetup();
      }
    },

    cmd_print: {
      isEnabled: function() {
        return !gWindowLocked;
      },
      doCommand: function() {
        DoCommandPrint();
      }
    },

    cmd_delete: {
      isEnabled: function() {
        let cmdDelete = document.getElementById("cmd_delete");
        let textValue = cmdDelete.getAttribute("valueDefault");
        let accesskeyValue = cmdDelete.getAttribute("valueDefaultAccessKey");

        cmdDelete.setAttribute("label", textValue);
        cmdDelete.setAttribute("accesskey", accesskeyValue);

        return false;
      },
      doCommand: function() {
      }
    },

    cmd_account: {
      isEnabled: function() {
        return true;
      },
      doCommand: function() {
        MsgAccountManager(null);
      }
    },

    cmd_showFormatToolbar: {
      isEnabled: function() {
        return gMsgCompose && gMsgCompose.composeHTML;
      },
      doCommand: function() {
        goToggleToolbar("FormatToolbar", "menu_showFormatToolbar");
      }
    },

    cmd_quoteMessage: {
      isEnabled: function() {
        let selectedURIs = GetSelectedMessages();
        return (selectedURIs && selectedURIs.length > 0)
      },
      doCommand: function() {
        QuoteSelectedMessage();
      }
    },
  },

  supportsCommand: function(aCommand) {
    return (aCommand in this.commands);
  },

  isCommandEnabled: function(aCommand) {
    if (!this.supportsCommand(aCommand))
      return false;
    return this.commands[aCommand].isEnabled();
  },

  doCommand: function(aCommand) {
    if (!this.supportsCommand(aCommand))
      return;
    var cmd = this.commands[aCommand];
    if (!cmd.isEnabled())
      return;
    cmd.doCommand();
  },

  onEvent: function(event) {},
};

var attachmentBucketController = {
  commands: {
    cmd_selectAll: {
      isEnabled: function() {
        return true;
      },
      doCommand: function() {
        document.getElementById("attachmentBucket").selectAll();
      }
    },

    cmd_delete: {
      isEnabled: function() {
        let selectedCount = MessageGetNumSelectedAttachments();
        let cmdDelete = document.getElementById("cmd_delete");
        let textValue = getComposeBundle().getString("removeAttachmentMsgs");
        textValue = PluralForm.get(selectedCount, textValue);
        let accesskeyValue = cmdDelete.getAttribute("valueRemoveAttachmentAccessKey");
        cmdDelete.setAttribute("label", textValue);
        cmdDelete.setAttribute("accesskey", accesskeyValue);

        return selectedCount > 0;
      },
      doCommand: function() {
        RemoveSelectedAttachment();
      }
    },

    cmd_openAttachment: {
      isEnabled: function() {
        return MessageGetNumSelectedAttachments() == 1;
      },
      doCommand: function() {
        OpenSelectedAttachment();
      }
    },

    cmd_renameAttachment: {
      isEnabled: function() {
        return MessageGetNumSelectedAttachments() == 1;
      },
      doCommand: function() {
        RenameSelectedAttachment();
      }
    },

    cmd_convertCloud: {
      isEnabled: function() {
        // Hide the command entirely if Filelink is disabled, or if there are
        // no cloud accounts.
        let cmd = document.getElementById("cmd_convertCloud");

        cmd.hidden = (!Services.prefs.getBoolPref("mail.cloud_files.enabled") ||
                      cloudFileAccounts.accounts.length == 0);
        if (cmd.hidden)
          return false;

        let bucket = document.getElementById("attachmentBucket");
        for (let [,item] in Iterator(bucket.selectedItems)) {
          if (item.uploading)
            return false;
        }
        return true;
      },
      doCommand: function() {
        // We should never actually call this, since the <command> node calls
        // a different function.
      }
    },

    cmd_convertAttachment: {
      isEnabled: function() {
        if (!Services.prefs.getBoolPref("mail.cloud_files.enabled"))
          return false;

        let bucket = document.getElementById("attachmentBucket");
        for (let [,item] in Iterator(bucket.selectedItems)) {
          if (item.uploading)
            return false;
        }
        return true;
      },
      doCommand: function() {
        convertSelectedToRegularAttachment();
      }
    },

    cmd_cancelUpload: {
      isEnabled: function() {
        let cmd = document.getElementById("context_cancelUpload");

        // If Filelink is disabled, hide this menuitem and bailout.
        if (!Services.prefs.getBoolPref("mail.cloud_files.enabled")) {
          cmd.hidden = true;
          return false;
        }

        let bucket = document.getElementById("attachmentBucket");
        for (let [,item] in Iterator(bucket.selectedItems)) {
          if (item.uploading)
            return true;
        }

        // Hide the command entirely if the selected attachments aren't cloud
        // files.
        // For some reason, the hidden property isn't propagating from the cmd
        // to the menuitem.
        cmd.hidden = true;
        return false;
      },
      doCommand: function() {
        let fileHandler = Services.io.getProtocolHandler("file")
                                  .QueryInterface(Components.interfaces.nsIFileProtocolHandler);

        let bucket = document.getElementById("attachmentBucket");
        for (let [,item] in Iterator(bucket.selectedItems)) {
          if (item.uploading) {
            let file = fileHandler.getFileFromURLSpec(item.attachment.url);
            item.cloudProvider.cancelFileUpload(file);
          }
        }
      },
    },
  },

  supportsCommand: function(aCommand) {
    return (aCommand in this.commands);
  },

  isCommandEnabled: function(aCommand) {
    if (!this.supportsCommand(aCommand))
      return false;
    return this.commands[aCommand].isEnabled();
  },

  doCommand: function(aCommand) {
    if (!this.supportsCommand(aCommand))
      return;
    var cmd = this.commands[aCommand];
    if (!cmd.isEnabled())
      return;
    cmd.doCommand();
  },

  onEvent: function(event) {},
};

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
  let attachmentBucket = document.getElementById("attachmentBucket");

  top.controllers.appendController(defaultController);
  attachmentBucket.controllers.appendController(attachmentBucketController);

  document.getElementById("optionsMenuPopup")
          .addEventListener("popupshowing", updateOptionItems, true);
}

function UnloadCommandUpdateHandlers()
{
  let attachmentBucket = document.getElementById("attachmentBucket");

  document.getElementById("optionsMenuPopup")
          .removeEventListener("popupshowing", updateOptionItems, true);

  attachmentBucket.controllers.removeController(attachmentBucketController);
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
    // Workaround to update 'Quote' toolbar button. (See bug 609926.)
    goUpdateCommand("cmd_quoteMessage");
  } catch(e) {}
}

function openEditorContextMenu(popup)
{
  gSpellChecker.clearSuggestionsFromMenu();
  gSpellChecker.initFromEvent(document.popupRangeParent, document.popupRangeOffset);
  var onMisspelling = gSpellChecker.overMisspelling;
  document.getElementById('spellCheckSuggestionsSeparator').hidden = !onMisspelling;
  document.getElementById('spellCheckAddToDictionary').hidden = !onMisspelling;
  document.getElementById('spellCheckIgnoreWord').hidden = !onMisspelling;
  var separator = document.getElementById('spellCheckAddSep');
  separator.hidden = !onMisspelling;
  document.getElementById('spellCheckNoSuggestions').hidden = !onMisspelling ||
      gSpellChecker.addSuggestionsToMenu(popup, separator, 5);

  // We ought to do that, otherwise changing dictionaries will have no effect!
  // InlineSpellChecker only registers callbacks for entries that are not the
  // current dictionary, so if we changed dictionaries in the meanwhile, we must
  // rebuild the list so that the right callbacks are registered in the Language
  // menu.
  gSpellChecker.clearDictionaryListFromMenu();
  let dictMenu = document.getElementById("spellCheckDictionariesMenu");
  let dictSep = document.getElementById("spellCheckLanguageSeparator");
  gSpellChecker.addDictionaryListToMenu(dictMenu, dictSep);

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

function updateAttachmentItems()
{
  goUpdateCommand("cmd_attachCloud");
  goUpdateCommand("cmd_convertCloud");
  goUpdateCommand("cmd_convertAttachment");
  goUpdateCommand("cmd_cancelUpload");
  goUpdateCommand("cmd_delete");
  goUpdateCommand("cmd_renameAttachment");
  goUpdateCommand("cmd_selectAll");
  goUpdateCommand("cmd_openAttachment");
}

/**
 * Update all the commands for sending a message to reflect their current state.
 */
function updateSendCommands()
{
  goUpdateCommand("cmd_sendButton");
  goUpdateCommand("cmd_sendNow");
  goUpdateCommand("cmd_sendLater");
  goUpdateCommand("cmd_sendWithCheck");
}

function addAttachCloudMenuItems(aParentMenu)
{
  while (aParentMenu.hasChildNodes())
    aParentMenu.removeChild(aParentMenu.lastChild);

  for (let [,cloudProvider] in Iterator(cloudFileAccounts.accounts)) {
    let item = document.createElement("menuitem");
    let iconClass = cloudProvider.iconClass;
    item.cloudProvider = cloudProvider;
    item.setAttribute("label", cloudFileAccounts.getDisplayName(cloudProvider));

    if (iconClass) {
      item.setAttribute("class", "menu-iconic");
      item.setAttribute("image", iconClass);
    }
    aParentMenu.appendChild(item);
  }
}

function addConvertCloudMenuItems(aParentMenu, aAfterNodeId, aRadioGroup)
{
  let attachment = document.getElementById("attachmentBucket").selectedItem;
  let afterNode = document.getElementById(aAfterNodeId);
  while (afterNode.nextSibling)
    aParentMenu.removeChild(afterNode.nextSibling);

  if (!attachment.sendViaCloud) {
    let item = document.getElementById("context_convertAttachment");
    item.setAttribute("checked", "true");
  }

  for (let [,cloudProvider] in Iterator(cloudFileAccounts.accounts)) {
    let item = document.createElement("menuitem");
    let iconClass = cloudProvider.iconClass;
    item.cloudProvider = cloudProvider;
    item.setAttribute("label", cloudFileAccounts.getDisplayName(cloudProvider));
    item.setAttribute("type", "radio");
    item.setAttribute("name", aRadioGroup);

    if (attachment.cloudProvider &&
        attachment.cloudProvider.accountKey == cloudProvider.accountKey) {
      item.setAttribute("checked", "true");
    }
    else if (iconClass) {
      item.setAttribute("class", "menu-iconic");
      item.setAttribute("image", iconClass);
    }

    aParentMenu.appendChild(item);
  }
}

function uploadListener(aAttachment, aFile, aCloudProvider)
{
  this.attachment = aAttachment;
  this.file = aFile;
  this.cloudProvider = aCloudProvider;

  // Notify the UI that we're starting the upload process: disable send commands
  // and show a "connecting" icon for the attachment.
  this.attachment.sendViaCloud = true;
  gNumUploadingAttachments++;
  updateSendCommands();

  let bucket = document.getElementById("attachmentBucket");
  let item = bucket.findItemForAttachment(this.attachment);
  if (item) {
    item.image = "chrome://messenger/skin/icons/connecting.png";
    item.setAttribute("tooltiptext",
      getComposeBundle().getFormattedString("cloudFileUploadingTooltip", [
        cloudFileAccounts.getDisplayName(this.cloudProvider)
      ]));
    item.uploading = true;
    item.cloudProvider = this.cloudProvider;
  }
}

uploadListener.prototype = {
  onStartRequest: function uploadListener_onStartRequest(aRequest, aContext) {
    let bucket = document.getElementById("attachmentBucket");
    let item = bucket.findItemForAttachment(this.attachment);
    if (item)
      item.image = "chrome://messenger/skin/icons/loading.png";
  },

  onStopRequest: function uploadListener_onStopRequest(aRequest, aContext,
                                                       aStatusCode) {
    let bucket = document.getElementById("attachmentBucket");
    let attachmentItem = bucket.findItemForAttachment(this.attachment);

    if (Components.isSuccessCode(aStatusCode)) {
      let originalUrl = this.attachment.url;
      this.attachment.contentLocation = this.cloudProvider.urlForFile(this.file);
      this.attachment.cloudProviderKey = this.cloudProvider.accountKey;
      if (attachmentItem) {
        // Update relevant bits on the attachment list item.
        if (!attachmentItem.originalUrl)
          attachmentItem.originalUrl = originalUrl;
        attachmentItem.setAttribute("tooltiptext",
          getComposeBundle().getFormattedString("cloudFileUploadedTooltip", [
            cloudFileAccounts.getDisplayName(this.cloudProvider)
          ]));
        attachmentItem.uploading = false;

        // Set the icon for the attachment.
        let iconClass = this.cloudProvider.iconClass;
        if (iconClass)
          attachmentItem.image = iconClass;
        else {
          // Should we use a generic "cloud" icon here? Or an overlay icon?
          // I think the provider should provide an icon, end of story.
          attachmentItem.image = null;
        }
      }

      let event = document.createEvent("Events");
      event.initEvent("attachment-uploaded", true, true);
      attachmentItem.dispatchEvent(event);
    }
    else if (aStatusCode == this.cloudProvider.uploadCanceled) {
      attachmentItem.setAttribute("tooltiptext", attachmentItem.attachment.url);
      attachmentItem.image = null;
    }
    else {
      let title;
      let msg;
      let displayName = cloudFileAccounts.getDisplayName(this.cloudProvider);
      let bundle = getComposeBundle();

      switch (aStatusCode) {
      case this.cloudProvider.authErr:
        title = bundle.getString("errorCloudFileAuth.title");
        msg = bundle.getFormattedString("errorCloudFileAuth.message",
                                        [displayName]);
        break;
      case this.cloudProvider.uploadErr:
        title = bundle.getString("errorCloudFileUpload.title");
        msg = bundle.getFormattedString("errorCloudFileUpload.message",
                                        [displayName,
                                         this.attachment.name]);
        break;
      case this.cloudProvider.uploadWouldExceedQuota:
        title = bundle.getString("errorCloudFileQuota.title");
        msg = bundle.getFormattedString("errorCloudFileQuota.message",
                                        [displayName,
                                         this.attachment.name]);
        break;
      case this.cloudProvider.uploadExceedsFileLimit:
        title = bundle.getString("errorCloudFileLimit.title");
        msg = bundle.getFormattedString("errorCloudFileLimit.message",
                                        [displayName,
                                         this.attachment.name]);
        break;
      default:
        title = bundle.getString("errorCloudFileOther.title");
        msg = bundle.getFormattedString("errorCloudFileOther.message",
                                        [displayName]);
        break;
      }

      // TODO: support actions other than "Upgrade"
      const prompt = Services.prompt;
      let url = this.cloudProvider.providerUrlForError(aStatusCode);
      let flags = prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_OK;
      if (url)
        flags += prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_IS_STRING;
      if (prompt.confirmEx(window, title, msg, flags, null,
                           bundle.getString("errorCloudFileUpgrade.label"),
                           null, null, {})) {
        openLinkExternally(url);
      }

      if (attachmentItem) {
        // Remove the loading throbber.
        attachmentItem.image = null;
      }
    }

    gNumUploadingAttachments--;
    updateSendCommands();
  },

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIRequestObserver,
                                         Components.interfaces.nsISupportsWeakReference])
};

function deletionListener(aAttachment, aCloudProvider)
{
  this.attachment = aAttachment;
  this.cloudProvider = aCloudProvider;
}

deletionListener.prototype = {
  onStartRequest: function deletionListener_onStartRequest(aRequest, aContext) {
  },

  onStopRequest: function deletionListener_onStopRequest(aRequest, aContext,
                                                         aStatusCode) {
    if (!Components.isSuccessCode(aStatusCode)) {
      let displayName = cloudFileAccounts.getDisplayName(this.cloudProvider);
      Services.prompt.alert(window,
        getComposeBundle().getString("errorCloudFileDeletion.title"),
        getComposeBundle().getFormattedString("errorCloudFileDeletion.message",
                                              [displayName,
                                               this.attachment.name]));
    }
  },

  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsIRequestObserver,
                                         Components.interfaces.nsISupportsWeakReference])
};

/**
 * Prompt the user for a list of files to attach via a cloud provider.
 *
 * @param aProvider the cloud provider to upload the files to
 */
function attachToCloud(aProvider)
{
  // We need to let the user pick local file(s) to upload to the cloud and
  // gather url(s) to those files.
  var fp = Components.classes["@mozilla.org/filepicker;1"]
                     .createInstance(nsIFilePicker);
  fp.init(window, getComposeBundle().getFormattedString(
            "chooseFileToAttachViaCloud",
            [cloudFileAccounts.getDisplayName(aProvider)]),
          nsIFilePicker.modeOpenMultiple);

  var lastDirectory = GetLastAttachDirectory();
  if (lastDirectory)
    fp.displayDirectory = lastDirectory;

  let files = [];

  fp.appendFilters(nsIFilePicker.filterAll);
  if (fp.show() == nsIFilePicker.returnOK)
  {
    if (!fp.files)
      return;

    let files = [f for (f in fixIterator(fp.files,
                                         Components.interfaces.nsILocalFile))];
    let attachments = [FileToAttachment(f) for each (f in files)];

    let i = 0;
    let items = AddAttachments(attachments, function(aItem) {
      let listener = new uploadListener(attachments[i], files[i], aProvider);
      aProvider.uploadFile(files[i], listener);
      i++;
    });

    SetLastAttachDirectory(files[files.length-1]);
  }
}

/**
 * Convert an array of attachments to cloud attachments.
 *
 * @param aItems an array of <attachmentitem>s containing the attachments in
 *        question
 * @param aProvider the cloud provider to upload the files to
 */
function convertListItemsToCloudAttachment(aItems, aProvider)
{
  let fileHandler = Services.io.getProtocolHandler("file")
                            .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  let convertedAttachments = Components.classes["@mozilla.org/array;1"]
                                       .createInstance(Components.interfaces.nsIMutableArray);

  for (let [,item] in Iterator(aItems)) {
    let url = item.attachment.url;

    if (item.attachment.sendViaCloud) {
      if (item.cloudProvider && item.cloudProvider == aProvider)
        continue;
      url = item.originalUrl;
    }

    let file = fileHandler.getFileFromURLSpec(url);
    if (item.cloudProvider) {
      item.cloudProvider.deleteFile(
        file, new deletionListener(item.attachment, item.cloudProvider));
    }

    aProvider.uploadFile(file,
                         new uploadListener(item.attachment, file, aProvider));
    convertedAttachments.appendElement(item.attachment, false);
  }

  Services.obs.notifyObservers(convertedAttachments,
                               "mail:attachmentsConverted",
                               aProvider.accountKey);
}

/**
 * Convert the selected attachments to cloud attachments.
 *
 * @param aProvider the cloud provider to upload the files to
 */
function convertSelectedToCloudAttachment(aProvider)
{
  let bucket = document.getElementById("attachmentBucket");
  convertListItemsToCloudAttachment(bucket.selectedItems, aProvider);
}

/**
 * Convert an array of nsIMsgAttachments to cloud attachments.
 *
 * @param aAttachments an array of nsIMsgAttachments
 * @param aProvider the cloud provider to upload the files to
 */
function convertToCloudAttachment(aAttachments, aProvider)
{
  let bucket = document.getElementById("attachmentBucket");
  let items = [];
  for (let [,attachment] in Iterator(aAttachments)) {
    let item = bucket.findItemForAttachment(attachment);
    if (item)
      items.push(item);
  }

  convertListItemsToCloudAttachment(items, aProvider);
}

/**
 * Convert an array of attachments to regular (non-cloud) attachments.
 *
 * @param aItems an array of <attachmentitem>s containing the attachments in
 *        question
 */
function convertListItemsToRegularAttachment(aItems)
{
  let fileHandler = Services.io.getProtocolHandler("file")
                            .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  let convertedAttachments = Components.classes["@mozilla.org/array;1"]
                                       .createInstance(Components.interfaces.nsIMutableArray);

  for (let [,item] in Iterator(aItems)) {
    if (!item.attachment.sendViaCloud || !item.cloudProvider)
      continue;

    let file = fileHandler.getFileFromURLSpec(item.originalUrl);
    try {
      // This will fail for drafts, but we can still send the message
      // with a normal attachment.
      item.cloudProvider.deleteFile(
        file, new deletionListener(item.attachment, item.cloudProvider));
    }
    catch (ex) {
       Components.utils.reportError(ex);
    }

    item.attachment.url = item.originalUrl;
    item.setAttribute("tooltiptext", item.attachment.url);
    item.attachment.sendViaCloud = false;

    delete item.cloudProvider;
    delete item.originalUrl;
    item.image = null;

    convertedAttachments.appendElement(item.attachment, false);
  }
  let bucket = document.getElementById("attachmentBucket");
  let event = document.createEvent("CustomEvent");
  event.initCustomEvent("attachments-converted", true, true, convertedAttachments);
  bucket.dispatchEvent(event);

  Services.obs.notifyObservers(convertedAttachments,
                               "mail:attachmentsConverted", null);
                               
  // We leave the content location in for the notifications because
  // it may be needed to identify the attachment. But clear it out now.
  for (let [,item] in Iterator(aItems))
    delete item.attachment.contentLocation;
}

/**
 * Convert the selected attachments to regular (non-cloud) attachments.
 */
function convertSelectedToRegularAttachment()
{
  let bucket = document.getElementById("attachmentBucket");
  convertListItemsToRegularAttachment(bucket.selectedItems);
}

/**
 * Convert an array of nsIMsgAttachments to regular (non-cloud) attachments.
 *
 * @param aAttachments an array of nsIMsgAttachments
 */
function convertToRegularAttachment(aAttachments)
{
  let bucket = document.getElementById("attachmentBucket");
  let items = [];
  for (let [,attachment] in Iterator(aAttachments)) {
    let item = bucket.findItemForAttachment(attachment);
    if (item)
      items.push(item);
  }

  convertListItemsToRegularAttachment(items);
}

function updateOptionItems()
{
  goUpdateCommand("cmd_quoteMessage");
}

/* messageComposeOfflineQuitObserver is notified whenever the network
 * connection status has switched to offline, or when the application
 * has received a request to quit.
 */
var messageComposeOfflineQuitObserver =
{
  observe: function(aSubject, aTopic, aData)
  {
    // sanity checks
    if (aTopic == "network:offline-status-changed")
    {
      gIsOffline = aData == "offline";
      MessageComposeOfflineStateChanged(gIsOffline);

      try {
        setupLdapAutocompleteSession();
      } catch (ex) {
        // catch the exception and ignore it, so that if LDAP setup
        // fails, the entire compose window stuff doesn't get aborted
      }
    }
    // check whether to veto the quit request (unless another observer already
    // did)
    else if (aTopic == "quit-application-requested"
        && (aSubject instanceof Components.interfaces.nsISupportsPRBool)
        && !aSubject.data)
      aSubject.data = !ComposeCanClose();
  }
}

function AddMessageComposeOfflineQuitObserver()
{
  Services.obs.addObserver(messageComposeOfflineQuitObserver,
                           "network:offline-status-changed", false);
  Services.obs.addObserver(messageComposeOfflineQuitObserver,
                           "quit-application-requested", false);

  gIsOffline = gIOService.offline;
  // set the initial state of the send button
  MessageComposeOfflineStateChanged(gIsOffline);
}

function RemoveMessageComposeOfflineQuitObserver()
{
  Services.obs.removeObserver(messageComposeOfflineQuitObserver,
                              "network:offline-status-changed");
  Services.obs.removeObserver(messageComposeOfflineQuitObserver,
                              "quit-application-requested");
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
                         .getService(Components.interfaces.nsIPrefBranch);
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
                         .getService(Components.interfaces.nsIPrefBranch);
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
                         .getService(Components.interfaces.nsIPrefBranch);
  branch.addObserver(gCurrentAutocompleteDirectory, directoryServerObserver,
                     false);
}

function RemoveDirectorySettingsObserver(prefstring)
{
  var branch = Components.classes["@mozilla.org/preferences-service;1"]
                         .getService(Components.interfaces.nsIPrefBranch);
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

var attachmentWorker = new Worker("resource:///modules/attachmentChecker.js");

attachmentWorker.lastMessage = null;

attachmentWorker.onerror = function(error)
{
  dump("Attachment Notification Worker error!!! " + error.message + "\n");
  throw error;
};


attachmentWorker.onmessage = function(event)
{
  let keywordsFound = event.data;
  let msg = null;
  let nBox = document.getElementById("attachmentNotificationBox");
  let notification = nBox.getNotificationWithValue("1");
  let removeNotification = false;

  if (keywordsFound.length > 0) {
    msg = document.createElement("hbox");
    msg.setAttribute("flex", "100");

    msg.onclick = function(event)
    {
      openOptionsDialog("paneCompose");
    };

    let msgText = document.createElement("label");
    msg.appendChild(msgText);
    msgText.id = "attachmentReminderText";
    msgText.setAttribute("crop", "end");
    msgText.setAttribute("flex", "1");
    let textValue = getComposeBundle().getString("attachmentReminderKeywordsMsgs");
    textValue = PluralForm.get(keywordsFound.length, textValue)
                          .replace("#1", keywordsFound.length);
    msgText.setAttribute("value", textValue);

    let keywords = keywordsFound.join(", ");
    let msgKeywords = document.createElement("label");
    msg.appendChild(msgKeywords);
    msgKeywords.id = "attachmentKeywords";
    msgKeywords.setAttribute("crop", "end");
    msgKeywords.setAttribute("flex", "1000");
    msgKeywords.setAttribute("value", keywords);

    if (notification) {
      let description = notification.querySelector("#attachmentReminderText");
      description.setAttribute("value", msgText.getAttribute("value"));
      description = notification.querySelector("#attachmentKeywords")
      description.setAttribute("value", keywords);
      msg = null;
    }
    if (keywords == this.lastMessage) {
      // The user closed the notification, and we have nothing new to say.
      msg = null;
    }
    this.lastMessage = keywords;
  }
  else {
    removeNotification = true;
    this.lastMessage = null;
  }
  if (notification && removeNotification)
    nBox.removeNotification(notification);
  if (msg) {
    var addButton = {
      accessKey : getComposeBundle().getString("addAttachmentButton.accessskey"),
      label: getComposeBundle().getString("addAttachmentButton"),
      callback: function (aNotificationBar, aButton)
      {
        goDoCommand("cmd_attachFile");
      }
    };

    var remindButton = {
      accessKey : getComposeBundle().getString("remindLaterButton.accessskey"),
      label: getComposeBundle().getString("remindLaterButton"),
      callback: function (aNotificationBar, aButton)
      {
        gRemindLater = true;
      }
    };

    notification = nBox.appendNotification("", "1",
                                 /* fake out the image so we can do it in CSS */
                                 "null",
                                 nBox.PRIORITY_WARNING_MEDIUM,
                                 [addButton, remindButton]);
    let buttons = notification.childNodes[0];
    notification.insertBefore(msg, buttons);
  }
  CheckForAttachmentNotification.shouldFire = true;
};

/**
 * Determine whether we should show the attachment notification or not.
 *
 * @param async Whether we should run the regex checker asynchronously or not.
 * @return true if we should show the attachment notification
 */
function ShouldShowAttachmentNotification(async)
{
  let bucket = document.getElementById("attachmentBucket");
  let warn = getPref("mail.compose.attachment_reminder");
  if (warn && !bucket.itemCount) {
    let prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefBranch);
    let keywordsInCsv = prefs.getComplexValue(
                             "mail.compose.attachment_reminder_keywords",
                             Components.interfaces.nsIPrefLocalizedString).data;
    let mailBody = document.getElementById("content-frame")
                           .contentDocument.getElementsByTagName("body")[0];
    let mailBodyNode = mailBody.cloneNode(true);

    // Don't check quoted text from reply.
    let blockquotes = mailBodyNode.getElementsByTagName("blockquote");
    for (let i = blockquotes.length - 1; i >= 0; i--) {
      blockquotes[i].parentNode.removeChild(blockquotes[i]);
    }
    // For plaintext composition the quotes we need to find and exclude are
    // normally <span _moz_quote="true">. If editor.quotesPreformatted is
    // set we should exclude <pre _moz_quote="true"> nodes instead.
    if (!getPref("editor.quotesPreformatted")) {
      let spans = mailBodyNode.getElementsByTagName("span");
      for (let i = spans.length - 1; i >= 0; i--) {
        if (spans[i].hasAttribute("_moz_quote"))
          spans[i].parentNode.removeChild(spans[i]);
      }
    }
    else {
      let pres = mailBodyNode.getElementsByTagName("pre");
      for (let i = pres.length - 1; i >= 0; i--) {
        if (pres[i].hasAttribute("_moz_quote"))
          pres[i].parentNode.removeChild(pres[i]);
      }
    }

    // Ignore signature (html compose mode).
    let sigs = mailBodyNode.getElementsByClassName("moz-signature");
    for (let i = sigs.length - 1; i >= 0; i--) {
      sigs[i].parentNode.removeChild(sigs[i]);
    }

    // Replace brs with line breaks so node.textContent won't pull foo<br>bar
    // together to foobar.
    let brs = mailBodyNode.getElementsByTagName("br");
    for (let i = brs.length - 1; i >= 0; i--) {
      brs[i].parentNode.replaceChild(mailBodyNode.ownerDocument.createTextNode("\n"), brs[i]);
    }

    // Ignore signature (plain text compose mode).
    let mailData = mailBodyNode.textContent;
    let sigIndex = mailData.indexOf("-- \n");
    if (sigIndex > 0)
      mailData = mailData.substring(0, sigIndex);

    // Ignore forwarded messages (plain text and html compose mode).
    let fwdText = getComposeBundle().getString("mailnews.reply_header_originalmessage");
    let fwdIndex = mailData.indexOf(fwdText);
    if (fwdIndex > 0)
      mailData = mailData.substring(0, fwdIndex);

    if (!async)
      return GetAttachmentKeywords(mailData, keywordsInCsv).length != 0;
    attachmentWorker.postMessage([mailData, keywordsInCsv]);
    return true;
  }
  return false;
}

/**
 * Check for attachment keywords, and display a notification if it's
 * appropriate.
 */
function CheckForAttachmentNotification(event)
{
  if (!CheckForAttachmentNotification.shouldFire || gRemindLater)
    return;
  if (!event)
    attachmentWorker.lastMessage = null;
  CheckForAttachmentNotification.shouldFire = false;
  let nBox = document.getElementById("attachmentNotificationBox");
  let notification = nBox.getNotificationWithValue("1");
  let removeNotification = false;

  if (!ShouldShowAttachmentNotification(true)) {
    removeNotification = true;
    CheckForAttachmentNotification.shouldFire = true;
  }

  if (notification && removeNotification)
    nBox.removeNotification(notification);
};

CheckForAttachmentNotification.shouldFire = true;

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

  // Set a sane starting width/height for all resolutions on new profiles.
  // Do this before the window loads.
  if (!document.documentElement.hasAttribute("width"))
  {
    // Prefer 860x800.
    let defaultHeight = (screen.availHeight >= 800) ? 800 : screen.availHeight;
    let defaultWidth = (screen.availWidth >= 860) ? 860 : screen.availWidth;

    // On small screens, default to maximized state.
    if (defaultHeight <= 600)
      document.documentElement.setAttribute("sizemode", "maximized");

    document.documentElement.setAttribute("width", defaultWidth);
    document.documentElement.setAttribute("height", defaultHeight);
    // Make sure we're safe at the left/top edge of screen
    document.documentElement.setAttribute("screenX", screen.availLeft);
    document.documentElement.setAttribute("screenY", screen.availTop);
  }

  var identityList = document.getElementById("msgIdentity");

  document.addEventListener("keypress", awDocumentKeyPress, true);
  var contentFrame = document.getElementById("content-frame");
  contentFrame.addEventListener("click", CheckForAttachmentNotification, true);

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
        let attachmentList = args.attachment.split(",");
        let commandLine = Components.classes["@mozilla.org/toolkit/command-line;1"]
                                    .createInstance();
        for (let [,attachmentName] in Iterator(attachmentList))
        {
          // resolveURI does all the magic around working out what the
          // attachment is, including web pages, and generating the correct uri.
          let uri = commandLine.resolveURI(attachmentName);
          let attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                                     .createInstance(Components.interfaces.nsIMsgAttachment);
          // If uri is for a file and it exists set the attachment size.
          if (uri instanceof Components.interfaces.nsIFileURL)
          {
            if (uri.file.exists())
              attachment.size = uri.file.fileSize;
            else
              attachment = null;
          }

          // Only want to attach if a file that exists or it is not a file.
          if (attachment)
          {
            attachment.url = uri.spec;
            composeFields.addAttachment(attachment);
          }
          else
          {
            let title = getComposeBundle().getString("errorFileAttachTitle");
            let msg = getComposeBundle().getFormattedString("errorFileAttachMessage",
                                                        [attachmentName]);
            gPromptService.alert(window, title, msg);
          }
        }
      }
      if (args.newshost)
        composeFields.newshost = args.newshost;
      if (args.body)
         composeFields.body = args.body;
    }
  }

  gComposeType = params.type;

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

  // Get the <editor> element to startup an editor
  var editorElement = GetCurrentEditorElement();
  gMsgCompose = composeSvc.initCompose(params, window, editorElement.docShell);
  if (gMsgCompose)
  {
    // set the close listener
    gMsgCompose.recyclingListener = gComposeRecyclingListener;
    gMsgCompose.addMsgSendListener(gSendListener);
    //Lets the compose object knows that we are dealing with a recycled window
    gMsgCompose.recycledWindow = recycled;

    document.getElementById("returnReceiptMenu")
            .setAttribute('checked', gMsgCompose.compFields.returnReceipt);
    document.getElementById("dsnMenu")
            .setAttribute('checked', gMsgCompose.compFields.DSN);
    document.getElementById("cmd_attachVCard")
            .setAttribute('checked', gMsgCompose.compFields.attachVCard);

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

      AddAttachments(msgCompFields.attachments);
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

  Components.classes["@mozilla.org/messenger/services/session;1"]
            .getService(Components.interfaces.nsIMsgMailSession)
            .AddMsgWindow(msgWindow);
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
        try {
          editorStyle.addOverrideStyleSheet("chrome://messenger/skin/messageQuotes.css");
        } catch (e if ((e instanceof Components.interfaces.nsIException) &&
                  (e.result == Components.results.NS_ERROR_INVALID_POINTER))) {
          // See Bug 517919 for discussion of why this exception is thrown
          // (at time of writing, on pinstripe, there is no messageQuotes.css)
          dump("addOverrideStyleSheet in MsgComposeCommands.js threw an exception, hopefully due to a missing stylesheet\n");
        }
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
    // The account wizard is still closing so we can't close just yet
    setTimeout(MsgComposeCloseWindow, 0, false); // Don't recycle a bogus window
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

  AddMessageComposeOfflineQuitObserver();
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
    Components.utils.reportError(ex);
    gPromptService.alert(window, getComposeBundle().getString("initErrorDlogTitle"),
                         getComposeBundle().getString("initErrorDlgMessage"));

    MsgComposeCloseWindow(false); // Don't try to recycle a bogus window
    return;
  }

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

  // Stop gSpellChecker so personal dictionary is saved
  enableInlineSpellCheck(false);

  EditorCleanup();

  if (gMsgCompose)
    gMsgCompose.removeMsgSendListener(gSendListener);

  RemoveMessageComposeOfflineQuitObserver();
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

// Add-ons can override this to customize the behavior.
function DoSpellCheckBeforeSend()
{
  return getPref("mail.SpellCheckBeforeSend");
}

/**
 * Handles message sending operations.
 * @param msgType nsIMsgCompDeliverMode of the operation.
 */
function GenericSendMessage(msgType)
{
  var msgCompFields = gMsgCompose.compFields;

  Recipients2CompFields(msgCompFields);
  var subject = GetMsgSubjectElement().value;
  msgCompFields.subject = subject;
  Attachments2CompFields(msgCompFields);

  let sending = msgType == nsIMsgCompDeliverMode.Now ||
      msgType == nsIMsgCompDeliverMode.Later ||
      msgType == nsIMsgCompDeliverMode.Background;
  if (sending)
  {
    // Do we need to check the spelling?
    if (DoSpellCheckBeforeSend())
    {
      // We disable spellcheck for the following -subject line, attachment
      // pane, identity and addressing widget therefore we need to explicitly
      // focus on the mail body when we have to do a spellcheck.
      SetMsgBodyFrameFocus();
      window.cancelSendMessage = false;
      window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank",
                        "chrome,close,titlebar,modal", true, true);

      if (window.cancelSendMessage)
        return;
    }

    // Strip trailing spaces and long consecutive WSP sequences from the
    // subject line to prevent getting only WSP chars on a folded line.
    var fixedSubject = subject.replace(/\s{74,}/g, "    ")
                              .replace(/\s*$/, "");
    if (fixedSubject != subject)
    {
      subject = fixedSubject;
      msgCompFields.subject = fixedSubject;
      GetMsgSubjectElement().value = fixedSubject;
    }

    // Remind the person if there isn't a subject
    if (subject == "")
    {
      if (gPromptService.confirmEx(
            window,
            getComposeBundle().getString("subjectEmptyTitle"),
            getComposeBundle().getString("subjectEmptyMessage"),
            (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_0) +
            (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_1),
            getComposeBundle().getString("sendWithEmptySubjectButton"),
            getComposeBundle().getString("cancelSendingButton"),
            null, null, {value:0}) == 1)
      {
        GetMsgSubjectElement().focus();
        return;
      }
    }

    // Alert the user if
    //  - the button to remind about attachments was clicked, or
    //  - the aggressive pref is set and the notification was not dismissed
    // and the message (still) contains attachment keywords.
    if ((gRemindLater || (getPref("mail.compose.attachment_reminder_aggressive") &&
          document.getElementById("attachmentNotificationBox").currentNotification)) &&
        ShouldShowAttachmentNotification(false)) {
      var flags = gPromptService.BUTTON_POS_0 * gPromptService.BUTTON_TITLE_IS_STRING +
                  gPromptService.BUTTON_POS_1 * gPromptService.BUTTON_TITLE_IS_STRING;
      var hadForgotten = gPromptService.confirmEx(window,
                            getComposeBundle().getString("attachmentReminderTitle"),
                            getComposeBundle().getString("attachmentReminderMsg"),
                            flags,
                            getComposeBundle().getString("attachmentReminderFalseAlarm"),
                            getComposeBundle().getString("attachmentReminderYesIForgot"),
                            null, null, {value:0});
      if (hadForgotten)
        return;
    }

    // Check if the user tries to send a message to a newsgroup through a mail
    // account.
    var currentAccountKey = getCurrentAccountKey();
    var account = gAccountManager.getAccount(currentAccountKey);
    if (!account)
    {
      throw new Error("currentAccountKey '" + currentAccountKey +
                      "' has no matching account!");
    }
    if (account.incomingServer.type != "nntp" && msgCompFields.newsgroups != "")
    {
      const kDontAskAgainPref = "mail.compose.dontWarnMail2Newsgroup";
      // default to ask user if the pref is not set
      var dontAskAgain = getPref(kDontAskAgainPref);
      if (!dontAskAgain)
      {
        var checkbox = {value:false};
        var okToProceed = gPromptService.confirmCheck(
                              window,
                              getComposeBundle().getString("noNewsgroupSupportTitle"),
                              getComposeBundle().getString("recipientDlogMessage"),
                              getComposeBundle().getString("CheckMsg"),
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

    // Before sending the message, check what to do with HTML message,
    // eventually abort.
    var convert = DetermineConvertibility();
    var action = DetermineHTMLAction(convert);
    // Check if e-mail addresses are complete, in case user turned off
    // autocomplete to local domain.
    if (!CheckValidEmailAddress(msgCompFields.to, msgCompFields.cc, msgCompFields.bcc))
      return;

    if (action == nsIMsgCompSendFormat.AskUser)
    {
      var recommAction = (convert == nsIMsgCompConvertible.No)
                          ? nsIMsgCompSendFormat.AskUser
                          : nsIMsgCompSendFormat.PlainText;
      var result2 = {action:recommAction, convertible:convert, abort:false};
      window.openDialog("chrome://messenger/content/messengercompose/askSendFormat.xul",
                        "askSendFormatDialog", "chrome,modal,titlebar,centerscreen",
                        result2);
      if (result2.abort)
        return;
      action = result2.action;
    }

    // We will remember the users "send format" decision in the address 
    // collector code (see nsAbAddressCollector::CollectAddress())
    // by using msgCompFields.forcePlainText and msgCompFields.useMultipartAlternative
    // to determine the nsIAbPreferMailFormat (unknown, plaintext, or html).
    // If the user sends both, we remember html.
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
      default:
        throw new Error("Invalid nsIMsgCompSendFormat action; action=" + action);
    }
  }

  // hook for extra compose pre-processing
  Services.obs.notifyObservers(window, "mail:composeOnSend", null);

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
    // Just before we try to send the message, fire off the
    // compose-send-message event for listeners such as smime so they can do
    // any pre-security work such as fetching certificates before sending.
    var event = document.createEvent("UIEvents");
    event.initEvent("compose-send-message", false, true);
    var msgcomposeWindow = document.getElementById("msgcomposeWindow");
    msgcomposeWindow.setAttribute("msgtype", msgType);
    msgcomposeWindow.dispatchEvent(event);
    if (event.defaultPrevented)
      throw Components.results.NS_ERROR_ABORT;

    gAutoSaving = (msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft);
    // disable the ui if we're not auto-saving
    if (!gAutoSaving)
    {
      gWindowLocked = true;
      disableEditableFields();
      updateComposeItems();
    }
    // If we're auto saving, mark the body as not changed here, and not
    // when the save is done, because the user might change it between now
    // and when the save is done.
    else
    {
      SetContentAndBodyAsUnmodified();
    }

    var progress = Components.classes["@mozilla.org/messenger/progress;1"]
                             .createInstance(Components.interfaces.nsIMsgProgress);
    if (progress)
    {
      progress.registerListener(progressListener);
      gSendOrSaveOperationInProgress = true;
    }
    msgWindow.domWindow = window;
    msgWindow.rootDocShell.allowAuth = true;
    gMsgCompose.SendMsg(msgType, getCurrentIdentity(),
                        getCurrentAccountKey(), msgWindow, progress);
  }
  catch (ex) {
    Components.utils.reportError("GenericSendMessage FAILED: " + ex);
    gWindowLocked = false;
    enableEditableFields();
    updateComposeItems();
  }
  if (originalCharset != gMsgCompose.compFields.characterSet)
    SetDocumentCharacterSet(gMsgCompose.compFields.characterSet);
}

function CheckValidEmailAddress(to, cc, bcc)
{
  var invalidStr = null;
  // crude check that the to, cc, and bcc fields contain at least one '@'.
  // We could parse each address, but that might be overkill.
  if (to.length > 0 && (to.indexOf("@") <= 0 && to.toLowerCase() != "postmaster" || to.indexOf("@") == to.length - 1))
    invalidStr = to;
  else if (cc.length > 0 && (cc.indexOf("@") <= 0 && cc.toLowerCase() != "postmaster" || cc.indexOf("@") == cc.length - 1))
    invalidStr = cc;
  else if (bcc.length > 0 && (bcc.indexOf("@") <= 0 && bcc.toLowerCase() != "postmaster" || bcc.indexOf("@") == bcc.length - 1))
    invalidStr = bcc;
  if (invalidStr)
  {
    if (gPromptService)
      gPromptService.alert(window, getComposeBundle().getString("addressInvalidTitle"),
                           getComposeBundle().getFormattedString("addressInvalid",
                                                     [invalidStr], 1));
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
        var buttonPressed = gPromptService.confirmEx(window,
              getComposeBundle().getString('sendMessageCheckWindowTitle'),
              getComposeBundle().getString('sendMessageCheckLabel'),
              (gPromptService.BUTTON_TITLE_IS_STRING * gPromptService.BUTTON_POS_0) +
              (gPromptService.BUTTON_TITLE_CANCEL * gPromptService.BUTTON_POS_1),
              getComposeBundle().getString('sendMessageCheckSendButtonLabel'),
              null, null,
              getComposeBundle().getString('CheckMsg'),
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
  if (gSpellChecker.enabled)
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

    gSpellChecker.mInlineSpellChecker.ignoreWords(tokenizedNames, tokenizedNames.length);
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
      isoStrArray = dictList[i].split(/[-_]/);

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
  var spellChecker = gSpellChecker.mInlineSpellChecker.spellChecker;
  var curLang = spellChecker.GetCurrentDictionary();
  var languages = aTarget.getElementsByAttribute("value", curLang);
  if (languages.length > 0)
    languages[0].setAttribute("checked", true);
}

function ChangeLanguage(event)
{
  // We need to change the dictionary language and if we are using inline spell check,
  // recheck the message

  var spellChecker = gSpellChecker.mInlineSpellChecker.spellChecker;
  if (spellChecker.GetCurrentDictionary() != event.target.value)
  {
    spellChecker.SetCurrentDictionary(event.target.value);

    // now check the document over again with the new dictionary
    if (gSpellChecker.enabled)
      gSpellChecker.mInlineSpellChecker.spellCheckRange(null);
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
  var identityKey = document.getElementById("msgIdentity").value;
  return gAccountManager.getIdentity(identityKey);
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

  if (newTitle == "" )
    newTitle = getComposeBundle().getString("defaultSubject");

  newTitle += GetCharsetUIString();
  document.title = getComposeBundle().getString("windowTitlePrefix") + " " + newTitle;
}

// Check for changes to document and allow saving before closing
// This is hooked up to the OS's window close widget (e.g., "X" for Windows)
function ComposeCanClose()
{
  // Do this early, so ldap sessions have a better chance to
  // cleanup after themselves.
  ReleaseAutoCompleteState();
  if (gSendOrSaveOperationInProgress)
  {
    var result;

    if (gPromptService)
    {
      var brandBundle = document.getElementById("brandBundle");
      var brandShortName = brandBundle.getString("brandShortName");
      var promptTitle = getComposeBundle().getString("quitComposeWindowTitle");
      var promptMsg = getComposeBundle().getFormattedString("quitComposeWindowMessage2",
                                                [brandShortName], 1);
      var quitButtonLabel = getComposeBundle().getString("quitComposeWindowQuitButtonLabel2");
      var waitButtonLabel = getComposeBundle().getString("quitComposeWindowWaitButtonLabel2");

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
      result = gPromptService.confirmEx(window,
                              getComposeBundle().getString("saveDlogTitle"),
                              getComposeBundle().getString("saveDlogMessage"),
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
  gSetupLdapAutocomplete = false;
  if (gLDAPSession) {
    gLDAPSession = null;
    // We're trying to force ldap sessions to get cleaned up as
    // soon as possible so they don't hang on shutdown.
    Components.utils.forceGC();
  }
}

function MsgComposeCloseWindow(recycleIt)
{
  Components.classes["@mozilla.org/messenger/services/session;1"]
            .getService(Components.interfaces.nsIMsgMailSession)
            .RemoveMsgWindow(msgWindow);
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
  fp.init(window, getComposeBundle().getString("chooseFileToAttach"),
          nsIFilePicker.modeOpenMultiple);

  var lastDirectory = GetLastAttachDirectory();
  if (lastDirectory)
    fp.displayDirectory = lastDirectory;

  fp.appendFilters(nsIFilePicker.filterAll);
  if (fp.show() == nsIFilePicker.returnOK)
  {
    if (!fp.files)
      return;
    let file;
    let attachments = [];

    for (file in fixIterator(fp.files, Components.interfaces.nsILocalFile))
      attachments.push(FileToAttachment(file));

    AddAttachments(attachments);
    SetLastAttachDirectory(file);
  }
}

/**
 * Convert an nsILocalFile instance into an nsIMsgAttachment.
 *
 * @param file the nsILocalFile
 * @return an attachment pointing to the file
 */
function FileToAttachment(file)
{
  let fileHandler = Services.io.getProtocolHandler("file")
                            .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
  let attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                             .createInstance(Components.interfaces.nsIMsgAttachment);

  attachment.url = fileHandler.getURLSpecFromFile(file);
  attachment.size = file.fileSize;
  return attachment;
}

/**
 * Add a list of attachment objects as attachments. The attachment URLs must be
 * set.
 *
 * @param aAttachments an iterable list of nsIMsgAttachment objects to add as
 *        attachments. Anything iterable with fixIterator is accepted.
 * @param aCallback an optional callback function called immediately after
 *        adding each attachment. Takes one argument: the newly-added
 *        <attachmentitem> node.
 */
function AddAttachments(aAttachments, aCallback)
{
  let bucket = document.getElementById("attachmentBucket");
  let addedAttachments = Components.classes["@mozilla.org/array;1"]
                                   .createInstance(Components.interfaces.nsIMutableArray);
  let items = [];

  for (let attachment in fixIterator(aAttachments,
                                     Components.interfaces.nsIMsgAttachment)) {
    if (!(attachment && attachment.url) ||
        DuplicateFileAlreadyAttached(attachment.url))
      continue;

    if (!attachment.name)
      attachment.name = gMsgCompose.AttachmentPrettyName(attachment.url, null);

    // For security reasons, don't allow *-message:// uris to leak out.
    // We don't want to reveal the .slt path (for mailbox://), or the username
    // or hostname.
    if (/^mailbox-message:|^imap-message:|^news-message:/i.test(attachment.name))
      attachment.name = getComposeBundle().getString("messageAttachmentSafeName");
    // Don't allow file or mail/news protocol uris to leak out either.
    else if (/^file:|^mailbox:|^imap:|^s?news:/i.test(attachment.name))
      attachment.name = getComposeBundle().getString("partAttachmentSafeName");

    let item = bucket.appendItem(attachment);
    addedAttachments.appendElement(attachment, false);

    if (attachment.size != -1)
      gAttachmentsSize += attachment.size;

    try {
      item.setAttribute("tooltiptext", decodeURI(attachment.url));
    }
    catch(e) {
      item.setAttribute("tooltiptext", attachment.url);
    }
    item.addEventListener("command", OpenSelectedAttachment, false);

    if (attachment.sendViaCloud) {
      try {
        let cloudProvider = cloudFileAccounts.getAccount(attachment.cloudProviderKey);
        item.cloudProvider = cloudProvider;
        item.image = cloudProvider.iconClass;
        item.originalUrl = attachment.url;
      } catch (ex) {dump(ex);}
    }
    else {
      // For local file urls, we are better off using the full file url because
      // moz-icon will actually resolve the file url and get the right icon from
      // the file url. All other urls, we should try to extract the file name from
      // them. This fixes issues where an icon wasn't showing up if you dragged a
      // web url that had a query or reference string after the file name and for
      // mailnews urls where the filename is hidden in the url as a &filename=
      // part.
      var url = gIOService.newURI(attachment.url, null, null);
      if (url instanceof Components.interfaces.nsIURL &&
          url.fileName && !url.schemeIs("file"))
        item.image = "moz-icon://" + url.fileName;
      else
        item.image = "moz-icon:" + attachment.url;
      }

    items.push(item);

    if (aCallback)
      aCallback(item);

    CheckForAttachmentNotification(null);
  }

  if (addedAttachments.length) {
    gContentChanged = true;

    UpdateAttachmentBucket(true);
    let event = document.createEvent("CustomEvent");
    event.initCustomEvent("attachments-added", true, true, addedAttachments);
    bucket.dispatchEvent(event);
  }

  return items;
}

/**
 * Add a file object as attachment. This is mostly just a helper function to
 * wrap a file into an nsIMsgAttachment object with it's URL set. Note: this
 * function is DEPRECATED. Use AddAttachments and FileToAttachment instead.
 *
 * @param file the nsIFile object to add as attachment
 */
function AddFileAttachment(file)
{
  AddAttachments([FileToAttachment(file)]);
}

/**
 * Add an attachment object as attachment. The attachment URL must be set. Note:
 * this function is DEPRECATED. Use AddAttachments instead.
 *
 * @param attachment the nsIMsgAttachment object to add as attachment
 */
function AddUrlAttachment(attachment)
{
  AddAttachments([attachment]);
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
      if (gPromptService.prompt(window,
                                getComposeBundle().getString("attachPageDlogTitle"),
                                getComposeBundle().getString("attachPageDlogMessage"),
                                result,
                                null,
                                {value:0}))
      {
        var attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                                   .createInstance(Components.interfaces.nsIMsgAttachment);
        attachment.url = result.value;
        AddAttachments([attachment]);
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
  let bucket = document.getElementById("attachmentBucket");
  let removedAttachments = Components.classes["@mozilla.org/array;1"]
                                     .createInstance(Components.interfaces.nsIMutableArray);

  while (bucket.getRowCount())
  {
    let child = bucket.removeItemAt(bucket.getRowCount() - 1);

    removedAttachments.appendElement(child.attachment, false);
    // Let's release the attachment object hold by the node else it won't go
    // away until the window is destroyed
    child.attachment = null;
  }

  let event = document.createEvent("CustomEvent");
  event.initCustomEvent("attachments-removed", true, true, removedAttachments);
  bucket.dispatchEvent(event);

  UpdateAttachmentBucket(false);
  CheckForAttachmentNotification(null);
}

/**
 * Display/hide and update the content of the attachment bucket (specifically
 * the total file size of the attachments and the number of current attachments)
 *
 * @param aShowBucket true if the bucket should be shown, false otherwise
 */
function UpdateAttachmentBucket(aShowBucket)
{
  if (aShowBucket) {
    var count = document.getElementById("attachmentBucket").getRowCount();

    var words = getComposeBundle().getString("attachmentCount");
    var countStr = PluralForm.get(count, words).replace("#1", count);

    document.getElementById("attachmentBucketCount").value = countStr;
    document.getElementById("attachmentBucketSize").value =
      gMessenger.formatFileSize(gAttachmentsSize);
  }

  document.getElementById("attachments-box").collapsed = !aShowBucket;
  document.getElementById("attachmentbucket-sizer").collapsed = !aShowBucket;
}

function RemoveSelectedAttachment()
{
  let bucket = document.getElementById("attachmentBucket");
  if (bucket.selectedItems.length > 0) {
    let fileHandler = Services.io.getProtocolHandler("file")
                              .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    let removedAttachments = Components.classes["@mozilla.org/array;1"]
                                       .createInstance(Components.interfaces.nsIMutableArray);

    for (let i = bucket.selectedCount - 1; i >= 0; i--) {
      let item = bucket.removeItemAt(bucket.getIndexOfItem(bucket.getSelectedItem(i)));
      if (item.attachment.size != -1) {
        gAttachmentsSize -= item.attachment.size;
        UpdateAttachmentBucket(true);
      }

      if (item.attachment.sendViaCloud && item.cloudProvider) {
        let file = fileHandler.getFileFromURLSpec(item.originalUrl);
        item.cloudProvider.deleteFile(
          file, new deletionListener(item.attachment, item.cloudProvider));
      }

      removedAttachments.appendElement(item.attachment, false);
      // Let's release the attachment object held by the node else it won't go
      // away until the window is destroyed
      item.attachment = null;
    }

    gContentChanged = true;

    let event = document.createEvent("CustomEvent");
    event.initCustomEvent("attachments-removed", true, true,
                          removedAttachments);
    bucket.dispatchEvent(event);
  }
  CheckForAttachmentNotification(null);
}

function RenameSelectedAttachment()
{
  var bucket = document.getElementById("attachmentBucket");
  if (bucket.selectedItems.length != 1)
    return; // not one attachment selected

  var item = bucket.getSelectedItem(0);
  var attachmentName = {value: item.attachment.name};
  if (gPromptService.prompt(
                     window,
                     getComposeBundle().getString("renameAttachmentTitle"),
                     getComposeBundle().getString("renameAttachmentMessage"),
                     attachmentName,
                     null,
                     {value: 0}))
  {
    if (attachmentName.value == "")
      return; // name was not filled, bail out

    let originalName = item.attachment.name;
    item.attachment.name = attachmentName.value;
    item.setAttribute("name", attachmentName.value);

    gContentChanged = true;

    let event = document.createEvent("CustomEvent");
    event.initCustomEvent("attachment-renamed", true, true, originalName);
    item.dispatchEvent(event);
  }
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
      var msgHdr = gMessenger.messageServiceFromURI(attachmentUrl).messageURIToMsgHdr(attachmentUrl);
      if (msgHdr)
        MailUtils.openMessageInNewWindow(msgHdr);
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
    return false;
  },

  doContent: function(contentType, isContentPreferred, request, contentHandler)
  {
    return false;
  },

  isPreferred: function(contentType, desiredContentType)
  {
    return false;
  },

  canHandleContent: function(contentType, isContentPreferred, desiredContentType)
  {
    return false;
  },

  getInterface: function(iid)
  {
    if (iid.equals(Components.interfaces.nsIDOMWindow))
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
          var prevCc = "";
          var prevBcc = "";
          var prevReceipt = prevIdentity.requestReturnReceipt;
          var prevDSN = prevIdentity.DSN;
          var prevAttachVCard = prevIdentity.attachVCard;

          if (prevIdentity.doCc)
            prevCc += prevIdentity.doCcList;

          if (prevIdentity.doBcc)
            prevBcc += prevIdentity.doBccList;

          var newReplyTo = gCurrentIdentity.replyTo;
          var newCc = "";
          var newBcc = "";
          var newReceipt = gCurrentIdentity.requestReturnReceipt;
          var newDSN = gCurrentIdentity.DSN;
          var newAttachVCard = gCurrentIdentity.attachVCard;

          if (gCurrentIdentity.doCc)
            newCc += gCurrentIdentity.doCcList;

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

          if (newCc != prevCc)
          {
            needToCleanUp = true;
            if (prevCc != "")
              awRemoveRecipients(msgCompFields, "addr_cc", prevCc);
            if (newCc != "")
              awAddRecipients(msgCompFields, "addr_cc", newCc);
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
  if (event.keyCode == KeyEvent.DOM_VK_RETURN)
    SetMsgBodyFrameFocus();
}

function AttachmentBucketClicked(event)
{
  let boundTarget = document.getBindingParent(event.originalTarget);
  if (event.button == 0 && boundTarget.localName == "scrollbox")
    goDoCommand('cmd_attachFile');
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
      var attachments = [];

      for (let i = 0; i < dataListLength; i++)
      {
        var item = dataList[i].first;
        var prettyName;
        var size;
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

            size = rawData.fileSize;
            rawData = fileHandler.getURLSpecFromFile(rawData);
          }
          else if (item.flavour.contentType == "text/x-moz-message")
          {
            size = gMessenger.messageServiceFromURI(rawData)
                             .messageURIToMsgHdr(rawData).messageSize;
          }
          else
          {
            var pieces = rawData.split("\n");
            rawData = pieces[0];
            if (pieces.length > 1)
              prettyName = pieces[1];
            if (pieces.length > 2)
              size = parseInt(pieces[2]);
          }

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
            let attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                                       .createInstance(Components.interfaces.nsIMsgAttachment);
            attachment.url = rawData;
            attachment.name = prettyName;

            if (size !== undefined)
              attachment.size = size;

            attachments.push(attachment);
          }
        }
        else if (item.flavour.contentType == "text/x-moz-address")
        {
          // process the address
          if (rawData)
            DropRecipient(aEvent.target, rawData);
        }
      }

      if (attachments.length)
        AddAttachments(attachments);
    },

  onDragOver: function (aEvent, aFlavour, aDragSession)
    {
      if (aFlavour.contentType != "text/x-moz-address")
      {
        // make sure the attachment box is visible during drag over
        var attachmentBox = document.getElementById("attachments-box");
        UpdateAttachmentBucket(true);
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
      flavourSet.appendFlavour("text/x-moz-message");
      flavourSet.appendFlavour("application/x-moz-file", "nsIFile");
      flavourSet.appendFlavour("text/x-moz-address");
      flavourSet.appendFlavour("text/x-moz-url");
      return flavourSet;
    }
};

var attachmentBucketDNDObserver = {
  onDragStart: function (aEvent, aAttachmentData, aDragAction)
  {
    var target = aEvent.target;

    if (target.localName == "attachmentitem")
      aAttachmentData.data = CreateAttachmentTransferData(target.attachment);
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
    var SaveDlgTitle = getComposeBundle().getString("SaveDialogTitle");
    var dlgMsg = bundle.getFormattedString("SaveDialogMsg",
                                           [msgfolder.name,
                                            msgfolder.server.prettyName]);

    var CheckMsg = bundle.getString("CheckMsg");
    gPromptService.alertCheck(window, SaveDlgTitle, dlgMsg,
                              getComposeBundle().getString("CheckMsg"), checkbox);
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
    gMsgAddressingWidgetTreeElement = document.getElementById("addressingWidget");

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

const gAttachmentNotifier =
{
  event: {
    notify: function(timer)
    {
      CheckForAttachmentNotification(true);
    }
  },

  timer: Components.classes["@mozilla.org/timer;1"]
                   .createInstance(Components.interfaces.nsITimer),

  EditAction: function EditAction()
  {
    this.timer.cancel();
    this.timer.initWithCallback(this.event, 500,
                                Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  }
};

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

  // We always go through this function everytime we init an editor, be it a
  // recycled editor, or a fresh one. First step is making sure we can spell
  // check.
  gSpellChecker.init(editor);
  document.getElementById('menu_inlineSpellCheck')
          .setAttribute('disabled', !gSpellChecker.canSpellCheck);
  document.getElementById('spellCheckEnable')
          .setAttribute('disabled', !gSpellChecker.canSpellCheck);
  // If canSpellCheck = false, then hidden = false, i.e. show it so that we can
  // still add dictionaries. Else, hide that.
  document.getElementById('spellCheckAddDictionariesMain')
          .setAttribute('hidden', gSpellChecker.canSpellCheck);
  // Then, we enable related UI entries.
  enableInlineSpellCheck(getPref("mail.spellcheck.inline"));
  let dictMenu = document.getElementById("spellCheckDictionariesMenu");
  let dictSep = document.getElementById("spellCheckLanguageSeparator");
  gSpellChecker.addDictionaryListToMenu(dictMenu, dictSep);

  editor.addEditorObserver(gAttachmentNotifier);
}

// This function modifies gSpellChecker and updates the UI accordingly. It's
// called either at startup (see InitEditor above), or when the user clicks on
// one of the two menu items that allow them to toggle the spellcheck feature
// (either context menu or Options menu).
function enableInlineSpellCheck(aEnableInlineSpellCheck)
{
  gSpellChecker.enabled = aEnableInlineSpellCheck;
  document.getElementById('msgSubject').setAttribute('spellcheck', aEnableInlineSpellCheck);
  document.getElementById("menu_inlineSpellCheck")
          .setAttribute('checked', aEnableInlineSpellCheck);
  document.getElementById("spellCheckEnable")
          .setAttribute('checked', aEnableInlineSpellCheck);
  document.getElementById('spellCheckDictionaries')
          .setAttribute('hidden', !aEnableInlineSpellCheck);
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
