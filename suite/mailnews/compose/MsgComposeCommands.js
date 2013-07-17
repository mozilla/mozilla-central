/* -*- Mode: C++; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/folderUtils.jsm");
Components.utils.import("resource:///modules/iteratorUtils.jsm");

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
const mozISpellCheckingEngine = Components.interfaces.mozISpellCheckingEngine;

/**
 * In order to distinguish clearly globals that are initialized once when js load (static globals) and those that need to be
 * initialize every time a compose window open (globals), I (ducarroz) have decided to prefix by s... the static one and
 * by g... the other one. Please try to continue and repect this rule in the future. Thanks.
 */
/**
 * static globals, need to be initialized only once
 */
var sMsgComposeService = Components.classes["@mozilla.org/messengercompose;1"].getService(Components.interfaces.nsIMsgComposeService);
var sComposeMsgsBundle;
var sBrandBundle;

var sRDF = null;
var sNameProperty = null;
var sDictCount = 0;

/* Create message window object. This is use by mail-offline.js and therefore should not be renamed. We need to avoid doing
   this kind of cross file global stuff in the future and instead pass this object as parameter when needed by function
   in the other js file.
*/
var msgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
                          .createInstance(Components.interfaces.nsIMsgWindow);
var gMessenger = Components.classes["@mozilla.org/messenger;1"]
                           .createInstance(Components.interfaces.nsIMessenger);

/**
 * Global variables, need to be re-initialized every time mostly because we need to release them when the window close
 */
var gHideMenus;
var gMsgCompose;
var gAccountManager;
var gWindowLocked;
var gContentChanged;
var gAutoSaving;
var gCurrentIdentity;
var defaultSaveOperation;
var gSendOrSaveOperationInProgress;
var gCloseWindowAfterSave;
var gSavedSendNowKey;
var gSendFormat;
var gLogComposePerformance;

var gMsgIdentityElement;
var gMsgAddressingWidgetElement;
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

  gMsgCompose = null;
  gWindowLocked = false;
  gContentChanged = false;
  gCurrentIdentity = null;
  defaultSaveOperation = "draft";
  gSendOrSaveOperationInProgress = false;
  gAutoSaving = false;
  gCloseWindowAfterSave = false;
  gSavedSendNowKey = null;
  gSendFormat = nsIMsgCompSendFormat.AskUser;
  gSendDefaultCharset = null;
  gCharsetTitle = null;
  gCharsetConvertManager = Components.classes['@mozilla.org/charset-converter-manager;1'].getService(Components.interfaces.nsICharsetConverterManager);
  gMailSession = Components.classes["@mozilla.org/messenger/services/session;1"].getService(Components.interfaces.nsIMsgMailSession);
  gHideMenus = false;
  // We are storing the value of the bool logComposePerformance inorder to avoid logging unnecessarily.
  if (sMsgComposeService)
    gLogComposePerformance = sMsgComposeService.logComposePerformance;

  gLastWindowToHaveFocus = null;
  gReceiptOptionChanged = false;
  gDSNOptionChanged = false;
  gAttachVCardOptionChanged = false;
}
InitializeGlobalVariables();

function ReleaseGlobalVariables()
{
  gAccountManager = null;
  gCurrentIdentity = null;
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
    awResetAllRows();
    RemoveAllAttachments();

    // We need to clear the identity popup menu in case the user will change them. It will be rebuilded later in ComposeStartup
    ClearIdentityListPopup(document.getElementById("msgIdentityPopup"));

    //Clear the subject
    GetMsgSubjectElement().value = "";
    SetComposeWindowTitle();

    SetContentAndBodyAsUnmodified();
    disableEditableFields();
    ReleaseGlobalVariables();

    // Clear the focus
    awGetInputElement(1).removeAttribute('focused');

    //Reset Boxes size
    document.getElementById("compose-toolbox").removeAttribute("height");
    document.getElementById("appcontent").removeAttribute("height");
    document.getElementById("addresses-box").removeAttribute("width");
    document.getElementById("attachments-box").removeAttribute("width");

    //Reset menu options
    document.getElementById("format_auto").setAttribute("checked", "true");

    //Reset toolbars that could be hidden
    if (gHideMenus) {
      document.getElementById("formatMenu").hidden = false;
      document.getElementById("insertMenu").hidden = false;
      var showFormat = document.getElementById("menu_showFormatToolbar")
      showFormat.hidden = false;
      if (showFormat.getAttribute("checked") == "true")
        document.getElementById("FormatToolbar").hidden = false;
    }

    //Reset the Customize Toolbars panel/sheet if open.
    if (getMailToolbox().customizing && gCustomizeSheet)
      document.getElementById("customizeToolbarSheetIFrame")
              .contentWindow.finishToolbarCustomization();

    // Stop InlineSpellCheckerUI so personal dictionary is saved
    EnableInlineSpellCheck(false);
    // clear any suggestions in the context menu
    InlineSpellCheckerUI.clearSuggestionsFromMenu();
    InlineSpellCheckerUI.clearDictionaryListFromMenu();

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
    // Reset focus to avoid undesirable visual effect when reopening the window

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
        document.getElementById('navigator-throbber').setAttribute("busy", "true");
        document.getElementById('compose-progressmeter').setAttribute( "mode", "undetermined" );
        document.getElementById("statusbar-progresspanel").collapsed = false;
      }

      if (aStateFlags & Components.interfaces.nsIWebProgressListener.STATE_STOP)
      {
        gSendOrSaveOperationInProgress = false;
        document.getElementById('navigator-throbber').removeAttribute("busy");
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
      case "cmd_save":
      case "cmd_saveAsFile":
      case "cmd_saveAsDraft":
      case "cmd_saveAsTemplate":
      case "cmd_sendButton":
      case "cmd_sendNow":
      case "cmd_sendWithCheck":
      case "cmd_sendLater":
      case "cmd_printSetup":
      case "cmd_print":

      //Edit Menu
      case "cmd_account":
      case "cmd_preferences":

      //Options Menu
      case "cmd_selectAddress":
      case "cmd_outputFormat":
      case "cmd_quoteMessage":
        return true;

      default:
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
      case "cmd_save":
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
        return !(gWindowLocked || Services.io.offline);

      //Edit Menu
      case "cmd_account":
      case "cmd_preferences":
        return true;

      //Options Menu
      case "cmd_selectAddress":
        return !gWindowLocked;
      case "cmd_outputFormat":
        return composeHTML;
      case "cmd_quoteMessage":
        var selectedURIs = GetSelectedMessages();
        if (selectedURIs && selectedURIs.length > 0)
          return true;
        return false;

      default:
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
      case "cmd_save"               : Save();                 break;
      case "cmd_saveAsFile"         : SaveAsFile(true);       break;
      case "cmd_saveAsDraft"        : SaveAsDraft();          break;
      case "cmd_saveAsTemplate"     : SaveAsTemplate();       break;
      case "cmd_sendButton"         :
        if (defaultController.isCommandEnabled(command))
        {
          if (Services.io.offline)
            SendMessageLater();
          else
            SendMessage();
        }
        break;
      case "cmd_sendNow"            : if (defaultController.isCommandEnabled(command)) SendMessage();          break;
      case "cmd_sendWithCheck"   : if (defaultController.isCommandEnabled(command)) SendMessageWithCheck();          break;
      case "cmd_sendLater"          : if (defaultController.isCommandEnabled(command)) SendMessageLater();     break;
      case "cmd_printSetup"         : PrintUtils.showPageSetup(); break;
      case "cmd_print"              : PrintUtils.print(); break;

      //Edit Menu
      case "cmd_account"            : MsgAccountManager(null); break;
      case "cmd_preferences"        : DoCommandPreferences(); break;

      //Options Menu
      case "cmd_selectAddress"      : if (defaultController.isCommandEnabled(command)) SelectAddress();         break;
      case "cmd_quoteMessage"       : if (defaultController.isCommandEnabled(command)) QuoteSelectedMessage();  break;
      default:
        return;
    }
  },

  onEvent: function(event)
  {
  }
};

var gAttachmentBucketController =
{
  supportsCommand: function(aCommand)
  {
    switch (aCommand)
    {
      case "cmd_delete":
      case "cmd_renameAttachment":
      case "cmd_selectAll":
      case "cmd_openAttachment":
        return true;
      default:
        return false;
    }
  },

  isCommandEnabled: function(aCommand)
  {
    switch (aCommand)
    {
      case "cmd_delete":
        return MessageGetNumSelectedAttachments() > 0;
      case "cmd_renameAttachment":
        return MessageGetNumSelectedAttachments() == 1;
      case "cmd_selectAll":
        return MessageHasAttachments();
      case "cmd_openAttachment":
        return MessageGetNumSelectedAttachments() == 1;
      default:
        return false;
    }
  },

  doCommand: function(aCommand)
  {
    switch (aCommand)
    {
      case "cmd_delete":
        if (MessageGetNumSelectedAttachments() > 0)
          RemoveSelectedAttachment();
        break;
      case "cmd_renameAttachment":
        if (MessageGetNumSelectedAttachments() == 1)
          RenameSelectedAttachment();
        break;
      case "cmd_selectAll":
        if (MessageHasAttachments())
          SelectAllAttachments();
        break;
      case "cmd_openAttachment":
        if (MessageGetNumSelectedAttachments() == 1)
          OpenSelectedAttachment();
        break;
      default:
        return;
    }
  },

  onEvent: function(event)
  {
  }
};

function QuoteSelectedMessage()
{
  var selectedURIs = GetSelectedMessages();
  if (selectedURIs)
    for (let i = 0; i < selectedURIs.length; i++)
      gMsgCompose.quoteMessage(selectedURIs[i]);
}

function GetSelectedMessages()
{
  var mailWindow = gMsgCompose && Services.wm.getMostRecentWindow("mail:3pane");
  return mailWindow && mailWindow.gFolderDisplay.selectedMessageUris;
}

function SetupCommandUpdateHandlers()
{
  top.controllers.appendController(defaultController);

  let attachmentBucket = document.getElementById("attachmentBucket");
  attachmentBucket.controllers.appendController(gAttachmentBucketController);

  document.getElementById("optionsMenuPopup")
          .addEventListener("popupshowing", updateOptionItems, true);
}

function UnloadCommandUpdateHandlers()
{
  document.getElementById("optionsMenuPopup")
          .removeEventListener("popupshowing", updateOptionItems, true);

  top.controllers.removeController(defaultController);

  let attachmentBucket = document.getElementById("attachmentBucket");
  attachmentBucket.controllers.removeController(gAttachmentBucketController);
}

function CommandUpdate_MsgCompose()
{
  var focusedWindow = top.document.commandDispatcher.focusedWindow;

  // we're just setting focus to where it was before
  if (focusedWindow == gLastWindowToHaveFocus) {
    return;
  }

  gLastWindowToHaveFocus = focusedWindow;

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
  } catch(e) {}
}

function openEditorContextMenu(popup)
{
  gContextMenu = new nsContextMenu(popup);
  if (gContextMenu.shouldDisplay)
  {
    // If message body context menu then focused element should be content.
    var showPasteExtra =
        top.document.commandDispatcher.focusedWindow == content;
    gContextMenu.showItem("context-pasteNoFormatting", showPasteExtra);
    gContextMenu.showItem("context-pasteQuote", showPasteExtra);
    if (showPasteExtra)
    {
      goUpdateCommand("cmd_pasteNoFormatting");
      goUpdateCommand("cmd_pasteQuote");
    }
    return true;
  }
  return false;
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

function updateOptionItems()
{
  goUpdateCommand("cmd_quoteMessage");
}

var messageComposeOfflineQuitObserver = {
  observe: function(aSubject, aTopic, aState) {
    // sanity checks
    if (aTopic == "network:offline-status-changed")
    {
      MessageComposeOfflineStateChanged(aState == "offline");
    }
    // check whether to veto the quit request (unless another observer already
    // did)
    else if (aTopic == "quit-application-requested" &&
             aSubject instanceof Components.interfaces.nsISupportsPRBool &&
             !aSubject.data)
      aSubject.data = !ComposeCanClose();
  }
}

function AddMessageComposeOfflineQuitObserver()
{
  Services.obs.addObserver(messageComposeOfflineQuitObserver,
                           "network:offline-status-changed", false);
  Services.obs.addObserver(messageComposeOfflineQuitObserver,
                           "quit-application-requested", false);

  // set the initial state of the send button
  MessageComposeOfflineStateChanged(Services.io.offline);
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
    var sendNowMenuItem = document.getElementById("menu_sendNow");

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

function DoCommandPreferences()
{
  goPreferences('composing_messages_pane');
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
    var uri = Services.io.newURI(mailtoUrl, null, null);

    if (uri)
      return sMsgComposeService.getParamsForMailto(uri);
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

  var identityList = GetMsgIdentityElement();

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
        var commandLine = Components.classes["@mozilla.org/toolkit/command-line;1"]
                                    .createInstance();
        for (let i = 0; i < attachmentList.length; i++)
        {
          let attachmentStr = attachmentList[i];
          let uri = commandLine.resolveURI(attachmentStr);
          let attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"]
                                     .createInstance(Components.interfaces.nsIMsgAttachment);

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
            let title = sComposeMsgsBundle.getString("errorFileAttachTitle");
            let msg = sComposeMsgsBundle.getFormattedString("errorFileAttachMessage",
                                                            [attachmentStr]);
            Services.prompt.alert(window, title, msg);
          }
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
    if (identities.length == 0)
      identities = gAccountManager.allIdentities;
    params.identity = identities.queryElementAt(0, Components.interfaces.nsIMsgIdentity);
  }

  identityList.value = params.identity.key;
  LoadIdentity(true);
  if (sMsgComposeService)
  {
    // Get the <editor> element to startup an editor
    var editorElement = GetCurrentEditorElement();
    gMsgCompose = sMsgComposeService.initCompose(params, window,
                                                 editorElement.docShell);
    if (gMsgCompose)
    {
      // set the close listener
      gMsgCompose.recyclingListener = gComposeRecyclingListener;

      //Lets the compose object knows that we are dealing with a recycled window
      gMsgCompose.recycledWindow = recycled;

      if (!editorElement)
      {
        dump("Failed to get editor element!\n");
        return;
      }

      document.getElementById("returnReceiptMenu")
              .setAttribute("checked", gMsgCompose.compFields.returnReceipt);
      document.getElementById("dsnMenu")
              .setAttribute('checked', gMsgCompose.compFields.DSN);
      document.getElementById("cmd_attachVCard")
              .setAttribute("checked", gMsgCompose.compFields.attachVCard);
      document.getElementById("menu_inlineSpellCheck")
              .setAttribute("checked", getPref("mail.spellcheck.inline"));

      // If recycle, editor is already created
      if (!recycled)
      {
        try {
          var editortype = gMsgCompose.composeHTML ? "htmlmail" : "textmail";
          editorElement.makeEditable(editortype, true);
        } catch (e) { dump(" FAILED TO START EDITOR: "+e+"\n"); }

        // setEditorType MUST be call before setContentWindow
        if (gMsgCompose.composeHTML)
        {
          initLocalFontFaceMenu(document.getElementById("FontFacePopup"));
        }
        else
        {
          //Remove HTML toolbar, format and insert menus as we are editing in plain text mode
          document.getElementById("outputFormatMenu").setAttribute("hidden", true);
          document.getElementById("FormatToolbar").setAttribute("hidden", true);
          document.getElementById("formatMenu").setAttribute("hidden", true);
          document.getElementById("insertMenu").setAttribute("hidden", true);
          document.getElementById("menu_showFormatToolbar").setAttribute("hidden", true);
        }

        // Do setup common to Message Composer and Web Composer
        EditorSharedStartup();
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
        while (attachments.hasMoreElements()) {
          AddAttachment(attachments.getNext().QueryInterface(Components.interfaces.nsIMsgAttachment));
        }
      }

      var event = document.createEvent('Events');
      event.initEvent('compose-window-init', false, true);
      document.getElementById("msgcomposeWindow").dispatchEvent(event);

      gMsgCompose.RegisterStateListener(stateListener);

      if (recycled)
      {
        InitEditor(GetCurrentEditor());

        if (gMsgCompose.composeHTML)
        {
          // Force color picker on toolbar to show document colors
          onFontColorChange();
          onBackgroundColorChange();
          // XXX todo: reset paragraph select to "Body Text"
        }
      }
      else
      {
        // Add an observer to be called when document is done loading,
        //   which creates the editor
        try {
          GetCurrentCommandManager().
                addCommandObserver(gMsgEditorCreationObserver, "obs_documentCreated");

          // Load empty page to create the editor
          editorElement.webNavigation.loadURI("about:blank", // uri string
                               0,                            // load flags
                               null,                         // referrer
                               null,                         // post-data stream
                               null);
        } catch (e) {
          dump(" Failed to startup editor: "+e+"\n");
        }
      }
    }
  }

  // create URI of the folder from draftId
  var draftId = msgCompFields.draftId;
  var folderURI = draftId.substring(0, draftId.indexOf("#")).replace("-message", "");

  try {
    const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    var folder = sRDF.GetResource(folderURI);

    gEditingDraft = (folder instanceof Components.interfaces.nsIMsgFolder) &&
                    (folder.flags & nsMsgFolderFlags.Drafts);
  }
  catch (ex) {
    gEditingDraft = false;
  }

  gAutoSaveKickedIn = false;

  gAutoSaveInterval = getPref("mail.compose.autosave")
    ? getPref("mail.compose.autosaveinterval") * 60000
    : 0;

  if (gAutoSaveInterval)
    gAutoSaveTimeout = setTimeout(AutoSave, gAutoSaveInterval);
}

// The new, nice, simple way of getting notified when a new editor has been created
var gMsgEditorCreationObserver =
{
  observe: function(aSubject, aTopic, aData)
  {
    if (aTopic == "obs_documentCreated")
    {
      var editor = GetCurrentEditor();
      var commandManager = GetCurrentCommandManager();
      if (editor && commandManager == aSubject)
        InitEditor(editor);
      // Now that we know this document is an editor, update commands now if
      // the document has focus, or next time it receives focus via
      // CommandUpdate_MsgCompose()
      if (gLastWindowToHaveFocus == document.commandDispatcher.focusedWindow)
        updateComposeItems();
      else
        gLastWindowToHaveFocus = null;

      commandManager.removeCommandObserver(this, "obs_documentCreated");
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
  sComposeMsgsBundle = document.getElementById("bundle_composeMsgs");
  sBrandBundle = document.getElementById("brandBundle");

  var otherHeaders = getPref("mail.compose.other.header");

  sRDF = Components.classes['@mozilla.org/rdf/rdf-service;1']
                   .getService(Components.interfaces.nsIRDFService);
  sNameProperty = sRDF.GetResource("http://home.netscape.com/NC-rdf#Name?sort=true");

  AddMessageComposeOfflineQuitObserver();

  if (gLogComposePerformance)
    sMsgComposeService.TimeStamp("Start initializing the compose window (ComposeLoad)", false);

  try {
    SetupCommandUpdateHandlers();
    // This will do migration, or create a new account if we need to.
    // We also want to open the account wizard if no identities are found
    var state = verifyAccounts(WizCallback, true);

    if (otherHeaders) {
      var selectNode = document.getElementById('addressCol1#1');
      var otherHeaders_Array = otherHeaders.split(",");
      for (let i = 0; i < otherHeaders_Array.length; i++)
        selectNode.appendItem(otherHeaders_Array[i] + ":", "addr_other");
    }
    if (state)
      ComposeStartup(false, null);
  }
  catch (ex) {
    Components.utils.reportError(ex);
    var errorTitle = sComposeMsgsBundle.getString("initErrorDlogTitle");
    var errorMsg = sComposeMsgsBundle.getString("initErrorDlgMessage");
    Services.prompt.alert(window, errorTitle, errorMsg);

    MsgComposeCloseWindow(false); // Don't try to recycle a bogus window
    return;
  }
  if (gLogComposePerformance)
    sMsgComposeService.TimeStamp("Done with the initialization (ComposeLoad). Waiting on editor to load about:blank", false);

  // Before and after callbacks for the customizeToolbar code
  var mailToolbox = getMailToolbox();
  mailToolbox.customizeInit = MailToolboxCustomizeInit;
  mailToolbox.customizeDone = MailToolboxCustomizeDone;
  mailToolbox.customizeChange = MailToolboxCustomizeChange;
}

function ComposeUnload()
{
  UnloadCommandUpdateHandlers();

  // Stop InlineSpellCheckerUI so personal dictionary is saved
  EnableInlineSpellCheck(false);

  EditorCleanup();

  RemoveMessageComposeOfflineQuitObserver();

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
  setTimeout(UpdateMailEditCharset, 50);

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
        if (DoSpellCheckBeforeSend())
        {
          // We disable spellcheck for the following -subject line, attachment pane, identity and addressing widget
          // therefore we need to explicitly focus on the mail body when we have to do a spellcheck.
          SetMsgBodyFrameFocus();
          window.cancelSendMessage = false;
          try {
            window.openDialog("chrome://editor/content/EdSpellCheck.xul", "_blank",
                    "chrome,close,titlebar,modal", true, true, false);
          }
          catch(ex){}
          if(window.cancelSendMessage)
            return;
        }

        // Check if we have a subject, else ask user for confirmation
        if (subject == "")
        {
          var result = {value:sComposeMsgsBundle.getString("defaultSubject")};
          if (Services.prompt.prompt(window,
                  sComposeMsgsBundle.getString("sendMsgTitle"),
                  sComposeMsgsBundle.getString("subjectDlogMessage"),
                  result, null, {value:0}))
          {
            msgCompFields.subject = result.value;
            var subjectInputElem = GetMsgSubjectElement();
            subjectInputElem.value = result.value;
          }
          else
            return;
        }

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
          const kDontAskAgainPref = "mail.compose.dontWarnMail2Newsgroup";
          // default to ask user if the pref is not set
          var dontAskAgain = getPref(kDontAskAgainPref);
          if (!dontAskAgain)
          {
            var checkbox = {value:false};
            var okToProceed = Services.prompt.confirmCheck(
                                  window,
                                  sComposeMsgsBundle.getString("sendMsgTitle"),
                                  sComposeMsgsBundle.getString("recipientDlogMessage"),
                                  sComposeMsgsBundle.getString("CheckMsg"),
                                  checkbox);

            if (!okToProceed)
              return;
          }
          if (checkbox.value)
            Services.prefs.setBoolPref(kDontAskAgainPref, true);

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
        // just before we try to send the message, fire off the compose-send-message event for listeners
        // such as smime so they can do any pre-security work such as fetching certificates before sending
        var event = document.createEvent('UIEvents');
        event.initEvent('compose-send-message', false, true);
        var msgcomposeWindow = document.getElementById("msgcomposeWindow");
        msgcomposeWindow.setAttribute("msgtype", msgType);
        msgcomposeWindow.dispatchEvent(event);
        if (event.defaultPrevented)
          throw Components.results.NS_ERROR_ABORT;

        gAutoSaving = msgType == nsIMsgCompDeliverMode.AutoSaveAsDraft;
        // if we're auto saving, mark the body as not changed here, and not
        // when the save is done, because the user might change it between now
        // and when the save is done.
        if (gAutoSaving)
        {
          SetContentAndBodyAsUnmodified();
        }
        else
        {
          // disable the ui if we're not auto-saving
          gWindowLocked = true;
          disableEditableFields();
          updateComposeItems();
        }
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

function CheckValidEmailAddress(aTo, aCC, aBCC)
{
  var invalidStr = null;
  // crude check that the to, cc, and bcc fields contain at least one '@'.
  // We could parse each address, but that might be overkill.
  if (aTo.length > 0 && (aTo.indexOf("@") <= 0 && aTo.toLowerCase() != "postmaster" || aTo.indexOf("@") == aTo.length - 1))
    invalidStr = aTo;
  else if (aCC.length > 0 && (aCC.indexOf("@") <= 0 && aCC.toLowerCase() != "postmaster" || aCC.indexOf("@") == aCC.length - 1))
    invalidStr = aCC;
  else if (aBCC.length > 0 && (aBCC.indexOf("@") <= 0 && aBCC.toLowerCase() != "postmaster" || aBCC.indexOf("@") == aBCC.length - 1))
    invalidStr = aBCC;
  if (invalidStr)
  {
    var errorTitle = sComposeMsgsBundle.getString("sendMsgTitle");
    var errorMsg = sComposeMsgsBundle.getFormattedString("addressInvalid", [invalidStr], 1);
    Services.prompt.alert(window, errorTitle, errorMsg);
    return false;
  }
  return true;
}

function SendMessage()
{
  let sendInBackground = Services.prefs.getBoolPref("mailnews.sendInBackground");
  if (sendInBackground && !/Mac/.test(navigator.platform))
  {
    let enumerator = Services.wm.getEnumerator(null);
    let count = 0;
    while (enumerator.hasMoreElements() && count < 2)
    {
      enumerator.getNext();
      count++;
    }
    if (count == 1)
      sendInBackground = false;
  }
  GenericSendMessage(sendInBackground ? nsIMsgCompDeliverMode.Background
                                      : nsIMsgCompDeliverMode.Now);
}

function SendMessageWithCheck()
{
    var warn = getPref("mail.warn_on_send_accel_key");

    if (warn) {
        var checkValue = {value:false};
        var buttonPressed = Services.prompt.confirmEx(window,
              sComposeMsgsBundle.getString('sendMessageCheckWindowTitle'),
              sComposeMsgsBundle.getString('sendMessageCheckLabel'),
              (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
              (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1),
              sComposeMsgsBundle.getString('sendMessageCheckSendButtonLabel'),
              null, null,
              sComposeMsgsBundle.getString('CheckMsg'),
              checkValue);
        if (buttonPressed != 0) {
            return;
        }
        if (checkValue.value) {
            Services.prefs.setBoolPref("mail.warn_on_send_accel_key", false);
        }
    }

    if (Services.io.offline)
      SendMessageLater();
    else
      SendMessage();
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
  GenericSendMessage(nsIMsgCompDeliverMode.SaveAsDraft);
  defaultSaveOperation = "draft";

  gAutoSaveKickedIn = false;
  gEditingDraft = true;
}

function SaveAsTemplate()
{
  GenericSendMessage(nsIMsgCompDeliverMode.SaveAsTemplate);
  defaultSaveOperation = "template";

  gAutoSaveKickedIn = false;
  gEditingDraft = false;
}

// Sets the additional FCC, in addition to the default FCC.
function MessageFcc(menuItem)
{
  if (!gMsgCompose)
    return;

  var msgCompFields = gMsgCompose.compFields;
  if (!msgCompFields)
    return;

  // Get the uri for the folder to FCC into.
  var fccUri = menuItem.getAttribute("fccUri");
  msgCompFields.fcc2 = (msgCompFields.fcc2 == fccUri) ? "nocopy://" : fccUri;
}

function updatePriorityMenu(priorityMenu)
{
  var priority = (gMsgCompose && gMsgCompose.compFields && gMsgCompose.compFields.priority) || "Normal";
  priorityMenu.getElementsByAttribute("value", priority)[0].setAttribute("checked", "true");
}

function PriorityMenuSelect(target)
{
  if (gMsgCompose)
  {
    var msgCompFields = gMsgCompose.compFields;
    if (msgCompFields)
      msgCompFields.priority = target.getAttribute("value");
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

function SelectAddress()
{
  var msgCompFields = gMsgCompose.compFields;

  Recipients2CompFields(msgCompFields);

  var toAddress = msgCompFields.to;
  var ccAddress = msgCompFields.cc;
  var bccAddress = msgCompFields.bcc;

  dump("toAddress: " + toAddress + "\n");
  window.openDialog("chrome://messenger/content/addressbook/abSelectAddressesDialog.xul",
            "",
            "chrome,resizable,titlebar,modal",
            {composeWindow:top.window,
             msgCompFields:msgCompFields,
             toAddress:toAddress,
             ccAddress:ccAddress,
             bccAddress:bccAddress});
  // We have to set focus to the addressingwidget because we seem to loose focus often
  // after opening the SelectAddresses Dialog- bug # 89950
  AdjustFocus();
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
    var tokenizedNames = [];

    // each name could consist of multiple words delimited by commas and/or spaces.
    // i.e. Green Lantern or Lantern,Green.
    for (let i = 0; i < names.value.length; i++)
    {
      if (!names.value[i])
        continue;
      var splitNames = names.value[i].match(/[^\s,]+/g);
      if (splitNames)
        tokenizedNames = tokenizedNames.concat(splitNames);
    }

    InlineSpellCheckerUI.mInlineSpellChecker.ignoreWords(tokenizedNames, tokenizedNames.length);
  }
}

function InitLanguageMenu()
{
  var languageMenuList = document.getElementById("languageMenuList");
  if (!languageMenuList)
    return;

  var spellChecker = Components.classes["@mozilla.org/spellchecker/engine;1"]
                               .getService(mozISpellCheckingEngine);
  var o1 = {};
  var o2 = {};

  // Get the list of dictionaries from the spellchecker.
  spellChecker.getDictionaryList(o1, o2);

  var dictList = o1.value;
  var count    = o2.value;

  // If dictionary count hasn't changed then no need to update the menu.
  if (sDictCount == count)
    return;

  // Store current dictionary count.
  sDictCount = count;

  // Load the language string bundle that will help us map
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
    item.setAttribute("type", "radio");
    languageMenuList.appendChild(item);
  }
}

function OnShowDictionaryMenu(aTarget)
{
  InitLanguageMenu();
  var spellChecker = InlineSpellCheckerUI.mInlineSpellChecker.spellChecker;
  var curLang = spellChecker.GetCurrentDictionary();
  var languages = aTarget.getElementsByAttribute("value", curLang);
  if (languages.length > 0)
    languages[0].setAttribute("checked", true);
}

function ChangeLanguage(event)
{
  // We need to change the dictionary language and if we are using inline spell check,
  // recheck the message

  var spellChecker = InlineSpellCheckerUI.mInlineSpellChecker.spellChecker;
  if (spellChecker.GetCurrentDictionary() != event.target.value)
  {
    spellChecker.SetCurrentDictionary(event.target.value);

    // now check the document and the subject over again with the new dictionary
    if (InlineSpellCheckerUI.enabled)
    {
      InlineSpellCheckerUI.mInlineSpellChecker.spellCheckRange(null);
      GetMsgSubjectElement().inputField.parentNode.spellCheckerUI.mInlineSpellChecker.spellCheckRange(null);
    }
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
    msgCompFields.DSN = !msgCompFields.DSN;
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

function ClearIdentityListPopup(popup)
{
  if (popup)
    while (popup.hasChildNodes())
      popup.removeChild(popup.lastChild);
}

function FillIdentityList(menulist)
{
  var accounts = allAccountsSorted(true);

  for (let acc = 0; acc < accounts.length; acc++)
  {
    let account = accounts[acc];
    let identities = toArray(fixIterator(account.identities,
                                         Components.interfaces.nsIMsgIdentity));

    if (identities.length == 0)
      continue;

    for (let i = 0; i < identities.length; i++)
    {
      let identity = identities[i];
      let item = menulist.appendItem(identity.identityName, identity.key,
                                     account.incomingServer.prettyName);
      item.setAttribute("accountkey", account.key);
      if (i == 0)
      {
        // Mark the first identity as default.
        item.setAttribute("default", "true");
      }
    }
  }
}

function getCurrentIdentity()
{
  // fill in Identity combobox
  var identityKey = GetMsgIdentityElement().value;
  return gAccountManager.getIdentity(identityKey);
}

function getCurrentAccountKey()
{
    // get the accounts key
    var identityList = GetMsgIdentityElement();
    return identityList.selectedItem.getAttribute("accountkey");
}

function getIdentityForKey(key)
{
    return gAccountManager.getIdentity(key);
}

function AdjustFocus()
{
  var element = awGetInputElement(awGetNumberOfRecipients());
  if (element.value == "") {
      awSetFocus(awGetNumberOfRecipients(), element);
  }
  else
  {
      element = GetMsgSubjectElement();
      if (element.value == "") {
        element.focus();
      }
      else {
        SetMsgBodyFrameFocus();
      }
  }
}

function SetComposeWindowTitle()
{
  var newTitle = GetMsgSubjectElement().value;

  if (newTitle == "" )
    newTitle = sComposeMsgsBundle.getString("defaultSubject");

  newTitle += GetCharsetUIString();
  document.title = sComposeMsgsBundle.getString("windowTitlePrefix") + " " + newTitle;
}

// Check for changes to document and allow saving before closing
// This is hooked up to the OS's window close widget (e.g., "X" for Windows)
function ComposeCanClose()
{
  if (gSendOrSaveOperationInProgress)
  {
    var brandShortName = sBrandBundle.getString("brandShortName");

    var promptTitle = sComposeMsgsBundle.getString("quitComposeWindowTitle");
    var promptMsg = sComposeMsgsBundle.getFormattedString("quitComposeWindowMessage2",
                                                          [brandShortName], 1);
    var quitButtonLabel = sComposeMsgsBundle.getString("quitComposeWindowQuitButtonLabel2");
    var waitButtonLabel = sComposeMsgsBundle.getString("quitComposeWindowWaitButtonLabel2");

    if (Services.prompt.confirmEx(window, promptTitle, promptMsg,
        (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_0) +
        (Services.prompt.BUTTON_TITLE_IS_STRING * Services.prompt.BUTTON_POS_1),
        waitButtonLabel, quitButtonLabel, null, null, {value:0}) == 1)
    {
      gMsgCompose.abort();
      return true;
    }
    return false;
  }

  // Returns FALSE only if user cancels save action
  if (gContentChanged || gMsgCompose.bodyModified || (gAutoSaveKickedIn && !gEditingDraft))
  {
    // call window.focus, since we need to pop up a dialog
    // and therefore need to be visible (to prevent user confusion)
    window.focus();
    switch (Services.prompt.confirmEx(window,
              sComposeMsgsBundle.getString("saveDlogTitle"),
              sComposeMsgsBundle.getString("saveDlogMessage"),
              (Services.prompt.BUTTON_TITLE_SAVE * Services.prompt.BUTTON_POS_0) +
              (Services.prompt.BUTTON_TITLE_CANCEL * Services.prompt.BUTTON_POS_1) +
              (Services.prompt.BUTTON_TITLE_DONT_SAVE * Services.prompt.BUTTON_POS_2),
              null, null, null, null, {value:0}))
    {
      case 0: //Save
        // we can close immediately if we already autosaved the draft
        if (!gContentChanged && !gMsgCompose.bodyModified)
          break;
        gCloseWindowAfterSave = true;
        GenericSendMessage(nsIMsgCompDeliverMode.AutoSaveAsDraft);
        return false;
      case 1: //Cancel
        return false;
      case 2: //Don't Save
        // only delete the draft if we didn't start off editing a draft
        if (!gEditingDraft && gAutoSaveKickedIn)
          RemoveDraft();            
        break;
    }
  }

  return true;
}

function RemoveDraft()
{
  try
  {
    var draftId = gMsgCompose.compFields.draftId;
    var msgKey = draftId.substr(draftId.indexOf('#') + 1);
    var folder = sRDF.GetResource(gMsgCompose.savedFolderURI);
    try {
      if (folder instanceof Components.interfaces.nsIMsgFolder) 
      {
        var msgs = Components.classes["@mozilla.org/array;1"]
                             .createInstance(Components.interfaces.nsIMutableArray);
        msgs.appendElement(folder.GetMessageHeader(msgKey), false);    
        folder.deleteMessages(msgs, null, true, false, null, false);
      }
    }
    catch (ex) // couldn't find header - perhaps an imap folder.
    {
      if (folder instanceof Components.interfaces.nsIMsgImapMailFolder)
      {
        const kImapMsgDeletedFlag = 0x0008;
        folder.storeImapFlags(kImapMsgDeletedFlag, true, [msgKey], 1, null);
      }
    }
  } catch (ex) {}
}

function SetContentAndBodyAsUnmodified()
{
  gMsgCompose.bodyModified = false;
  gContentChanged = false;
}

function MsgComposeCloseWindow(recycleIt)
{
  if (gMsgCompose)
    gMsgCompose.CloseWindow(recycleIt);
  else
    window.close();
}

// attachedLocalFile must be a nsILocalFile
function SetLastAttachDirectory(attachedLocalFile)
{
  try {
    var file = attachedLocalFile.QueryInterface(Components.interfaces.nsIFile);
    var parent = file.parent.QueryInterface(Components.interfaces.nsILocalFile);

    Services.prefs.setComplexValue(kComposeAttachDirPrefName,
                                   Components.interfaces.nsILocalFile, parent);
  }
  catch (ex) {
    dump("error: SetLastAttachDirectory failed: " + ex + "\n");
  }
}

function AttachFile()
{
  //Get file using nsIFilePicker and convert to URL
  try {
      var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
      fp.init(window, sComposeMsgsBundle.getString("chooseFileToAttach"), nsIFilePicker.modeOpenMultiple);

      var lastDirectory = GetLocalFilePref(kComposeAttachDirPrefName);
      if (lastDirectory)
        fp.displayDirectory = lastDirectory;

      fp.appendFilters(nsIFilePicker.filterAll);
      if (fp.show() == nsIFilePicker.returnOK) {
        var firstAttachedFile = AttachFiles(fp.files);
        if (firstAttachedFile)
          SetLastAttachDirectory(firstAttachedFile);
      }
  }
  catch (ex) {
    dump("failed to get attachments: " + ex + "\n");
  }
}

function AttachFiles(attachments)
{
  if (!attachments || !attachments.hasMoreElements())
    return null;

  var firstAttachedFile = null;

  while (attachments.hasMoreElements()) {
    var currentFile = attachments.getNext().QueryInterface(Components.interfaces.nsILocalFile);

    if (!firstAttachedFile) {
      firstAttachedFile = currentFile;
    }

    var fileHandler = Services.io.getProtocolHandler("file").QueryInterface(Components.interfaces.nsIFileProtocolHandler);
    var currentAttachment = fileHandler.getURLSpecFromFile(currentFile);

    if (!DuplicateFileCheck(currentAttachment)) {
      var attachment = Components.classes["@mozilla.org/messengercompose/attachment;1"].createInstance(Components.interfaces.nsIMsgAttachment);
      attachment.url = currentAttachment;
      attachment.size = currentFile.fileSize;
      AddAttachment(attachment);
      gContentChanged = true;
    }
  }
  return firstAttachedFile;
}

function AddAttachment(attachment)
{
  if (attachment && attachment.url)
  {
    var bucket = GetMsgAttachmentElement();
    var item = document.createElement("listitem");

    if (!attachment.name)
      attachment.name = gMsgCompose.AttachmentPrettyName(attachment.url, attachment.urlCharset);

    // for security reasons, don't allow *-message:// uris to leak out
    // we don't want to reveal the .slt path (for mailbox://), or the username or hostname
    var messagePrefix = /^mailbox-message:|^imap-message:|^news-message:/i;
    if (messagePrefix.test(attachment.name))
      attachment.name = sComposeMsgsBundle.getString("messageAttachmentSafeName");
    else {
      // for security reasons, don't allow mail protocol uris to leak out
      // we don't want to reveal the .slt path (for mailbox://), or the username or hostname
      var mailProtocol = /^file:|^mailbox:|^imap:|^s?news:/i;
      if (mailProtocol.test(attachment.name))
        attachment.name = sComposeMsgsBundle.getString("partAttachmentSafeName");
    }

    var nameAndSize = attachment.name;
    if (attachment.size != -1)
      nameAndSize += " (" + gMessenger.formatFileSize(attachment.size) + ")";
    item.setAttribute("label", nameAndSize);    //use for display only
    item.attachment = attachment;   //full attachment object stored here
    try {
      item.setAttribute("tooltiptext", decodeURI(attachment.url));
    } catch(e) {
      item.setAttribute("tooltiptext", attachment.url);
    }
    item.setAttribute("class", "listitem-iconic");
    item.setAttribute("image", "moz-icon:" + attachment.url);
    item.setAttribute("crop", "center");
    bucket.appendChild(item);
  }
}

function SelectAllAttachments()
{
  var bucketList = GetMsgAttachmentElement();
  if (bucketList)
    bucketList.selectAll();
}

function MessageHasAttachments()
{
  var bucketList = GetMsgAttachmentElement();
  if (bucketList) {
    return (bucketList && bucketList.hasChildNodes() && (bucketList == top.document.commandDispatcher.focusedElement));
  }
  return false;
}

function MessageGetNumSelectedAttachments()
{
  var bucketList = GetMsgAttachmentElement();
  return (bucketList) ? bucketList.selectedItems.length : 0;
}

function AttachPage()
{
  var params = { action: "5", url: null };
  window.openDialog("chrome://communicator/content/openLocation.xul",
                    "_blank", "chrome,close,titlebar,modal", params);
  if (params.url)
  {
    var attachment =
        Components.classes["@mozilla.org/messengercompose/attachment;1"]
                  .createInstance(Components.interfaces.nsIMsgAttachment);
    attachment.url = params.url;
    AddAttachment(attachment);
  }
}

function DuplicateFileCheck(FileUrl)
{
  var bucket = GetMsgAttachmentElement();
  for (let i = 0; i < bucket.childNodes.length; i++)
  {
    let attachment = bucket.childNodes[i].attachment;
    if (attachment)
    {
      if (FileUrl == attachment.url)
         return true;
    }
  }

  return false;
}

function Attachments2CompFields(compFields)
{
  var bucket = GetMsgAttachmentElement();

  //First, we need to clear all attachment in the compose fields
  compFields.removeAttachments();

  for (let i = 0; i < bucket.childNodes.length; i++)
  {
    let attachment = bucket.childNodes[i].attachment;
    if (attachment)
      compFields.addAttachment(attachment);
  }
}

function RemoveAllAttachments()
{
  var child;
  var bucket = GetMsgAttachmentElement();
  while (bucket.hasChildNodes())
  {
    child = bucket.removeChild(bucket.lastChild);
    // Let's release the attachment object hold by the node else it won't go away until the window is destroyed
    child.attachment = null;
  }
}

function RemoveSelectedAttachment()
{
  var child;
  var bucket = GetMsgAttachmentElement();
  if (bucket.selectedItems.length > 0) {
    for (let i = bucket.selectedItems.length - 1; i >= 0; i--)
    {
      child = bucket.removeChild(bucket.selectedItems[i]);
      // Let's release the attachment object hold by the node else it won't go away until the window is destroyed
      child.attachment = null;
    }
    gContentChanged = true;
  }
}

function RenameSelectedAttachment()
{
  var bucket = GetMsgAttachmentElement();
  if (bucket.selectedItems.length != 1)
    return; // not one attachment selected

  var item = bucket.getSelectedItem(0);
  var attachmentName = {value: item.attachment.name};
  if (Services.prompt.prompt(
                     window,
                     sComposeMsgsBundle.getString("renameAttachmentTitle"),
                     sComposeMsgsBundle.getString("renameAttachmentMessage"),
                     attachmentName,
                     null,
                     {value: 0}))
  {
    var modifiedAttachmentName = attachmentName.value;
    if (modifiedAttachmentName == "")
      return; // name was not filled, bail out

    var nameAndSize = modifiedAttachmentName;
    if (item.attachment.size != -1)
      nameAndSize += " (" + gMessenger.formatFileSize(item.attachment.size) + ")";
    item.label = nameAndSize;
    item.attachment.name = modifiedAttachmentName;
    gContentChanged = true;
  }
}

function FocusOnFirstAttachment()
{
  var bucketList = GetMsgAttachmentElement();

  if (bucketList && bucketList.hasChildNodes())
    bucketList.selectItem(bucketList.firstChild);
}

function AttachmentElementHasItems()
{
  var element = GetMsgAttachmentElement();
  return element ? element.childNodes.length : 0;
}

function OpenSelectedAttachment()
{
  var bucket = GetMsgAttachmentElement();
  if (bucket.selectedItems.length == 1)
  {
    var attachmentUrl = bucket.getSelectedItem(0).attachment.url;

    var messagePrefix = /^mailbox-message:|^imap-message:|^news-message:/i;
    if (messagePrefix.test(attachmentUrl))
    {
      // we must be dealing with a forwarded attachment, treat this specially
      var msgHdr = gMessenger.msgHdrFromURI(attachmentUrl);
      if (msgHdr)
      {
        var folderUri = msgHdr.folder.folderURL;
        window.openDialog("chrome://messenger/content/messageWindow.xul", "_blank", "all,chrome,dialog=no,status,toolbar",
                          attachmentUrl, folderUri, null);
      }
    }
    else
    {
      var editorElement = GetCurrentEditorElement();
      if (editorElement) {
        const loadFlags = Components.interfaces.nsIWebNavigation.LOAD_FLAGS_IS_LINK;
        try {
          editorElement.webNavigation.loadURI(attachmentUrl, loadFlags, null, null, null);
        } catch (e) {}
      }
    }
  } // if one attachment selected
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
    var identityElement = GetMsgIdentityElement();
    var prevIdentity = gCurrentIdentity;

    if (identityElement) {
        var idKey = identityElement.value;
        gCurrentIdentity = gAccountManager.getIdentity(idKey);

        let maxRecipients = awGetMaxRecipients();
        for (let i = 1; i <= maxRecipients; i++)
          awGetInputElement(i).setAttribute("autocompletesearchparam", idKey);

        if (!startup && prevIdentity && idKey != prevIdentity.key)
        {
          var prevReplyTo = prevIdentity.replyTo;
          var prevCc = "";
          var prevBcc = "";
          var prevReceipt = prevIdentity.requestReturnReceipt;
          var prevDSN = prevIdentity.requestDSN;
          var prevAttachVCard = prevIdentity.attachVCard;

          if (prevIdentity.doCc)
            prevCc += prevIdentity.doCcList;

          if (prevIdentity.doBcc)
            prevBcc += prevIdentity.doBccList;

          var newReplyTo = gCurrentIdentity.replyTo;
          var newCc = "";
          var newBcc = "";
          var newReceipt = gCurrentIdentity.requestReturnReceipt;
          var newDSN = gCurrentIdentity.requestDSN;
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

      if (!startup) {
          if (getPref("mail.autoComplete.highlightNonMatches"))
            document.getElementById('addressCol2#1').highlightNonMatches = true;

          // only do this if we aren't starting up....it gets done as part of startup already
          addRecipientsToIgnoreList(gCurrentIdentity.identityName);
      }
    }
}

function setupAutocomplete()
{
  var autoCompleteWidget = document.getElementById("addressCol2#1");
  // When autocompleteToMyDomain is off, there is no default entry with the domain
  // appended, so reduce the minimum results for a popup to 2 in this case.
  if (!gCurrentIdentity.autocompleteToMyDomain)
    autoCompleteWidget.minResultsForPopup = 2;

  // if the pref is set to turn on the comment column, honor it here.
  // this element then gets cloned for subsequent rows, so they should
  // honor it as well
  //
  try {
      if (getPref("mail.autoComplete.highlightNonMatches"))
        autoCompleteWidget.highlightNonMatches = true;

      if (getPref("mail.autoComplete.commentColumn"))
        autoCompleteWidget.showCommentColumn = true;
  } catch (ex) {
      // if we can't get this pref, then don't show the columns (which is
      // what the XUL defaults to)
  }
}

function subjectKeyPress(event)
{
  switch(event.keyCode) {
  case KeyEvent.DOM_VK_TAB:
    if (!event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
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
  if (event.button != 0)
    return;

  if (event.originalTarget.localName == "listboxbody")
    goDoCommand('cmd_attachFile');
  else if (event.originalTarget.localName == "listitem" && event.detail == 2)
    OpenSelectedAttachment();
}

var attachmentBucketObserver = {

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
        let item = dataList[i].first;
        let prettyName;
        let size = NaN;
        let rawData = item.data;

        if (item.flavour.contentType == "text/x-moz-url" ||
            item.flavour.contentType == "text/x-moz-message" ||
            item.flavour.contentType == "application/x-moz-file")
        {
          if (item.flavour.contentType == "application/x-moz-file")
          {
            let fileHandler = Services.io.getProtocolHandler("file")
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
            let pieces = rawData.split("\n");
            rawData = pieces[0];
            if (pieces.length > 1)
              prettyName = pieces[1];
            if (pieces.length > 2)
              size = Number(pieces[2]);
          }

          if (DuplicateFileCheck(rawData))
          {
            dump("Error, attaching the same item twice\n");
          }
          else
          {
            let isValid = true;
            if (item.flavour.contentType == "text/x-moz-url") {
              // if this is a url (or selected text)
              // see if it's a valid url by checking
              // if we can extract a scheme
              // using the ioservice
              //
              // also skip mailto:, since it doesn't make sense
              // to attach and send mailto urls
              try {
                let scheme = Services.io.extractScheme(rawData);
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
              if (!isNaN(size))
                attachment.size = size;
              AddAttachment(attachment);
            }
          }
        }
      }
    },

  onDragOver: function (aEvent, aFlavour, aDragSession)
    {
      var attachmentBucket = GetMsgAttachmentElement();
      attachmentBucket.setAttribute("dragover", "true");
    },

  onDragExit: function (aEvent, aDragSession)
    {
      var attachmentBucket = GetMsgAttachmentElement();
      attachmentBucket.removeAttribute("dragover");
    },

  getSupportedFlavours: function ()
    {
      var flavourSet = new FlavourSet();
      flavourSet.appendFlavour("text/x-moz-message");
      flavourSet.appendFlavour("application/x-moz-file", "nsIFile");
      flavourSet.appendFlavour("text/x-moz-url");
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
    var SaveDlgTitle = sComposeMsgsBundle.getString("SaveDialogTitle");
    var dlgMsg = sComposeMsgsBundle.getFormattedString("SaveDialogMsg",
                                                       [msgfolder.name,
                                                        msgfolder.server.prettyName]);

    var CheckMsg = sComposeMsgsBundle.getString("CheckMsg");
    Services.prompt.alertCheck(window, SaveDlgTitle, dlgMsg, CheckMsg, checkbox);
    try {
          gCurrentIdentity.showSaveMsgDlg = !checkbox.value;
    }//try
    catch (e) {
    return;
    }//catch

  }//if
  return;
}

function SetMsgAddressingWidgetElementFocus()
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
  //window.content.focus(); fails to blur the currently focused element
  document.commandDispatcher
          .advanceFocusIntoSubtree(document.getElementById("appcontent"));
}

function GetMsgAddressingWidgetElement()
{
  if (!gMsgAddressingWidgetElement)
    gMsgAddressingWidgetElement = document.getElementById("addressingWidget");

  return gMsgAddressingWidgetElement;
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

function IsMsgHeadersToolbarCollapsed()
{
  var element = GetMsgHeadersToolbarElement();
  return element && element.collapsed;
}

function WhichElementHasFocus()
{
  var msgIdentityElement         = GetMsgIdentityElement();
  var msgAddressingWidgetElement = GetMsgAddressingWidgetElement();
  var msgSubjectElement          = GetMsgSubjectElement();
  var msgAttachmentElement       = GetMsgAttachmentElement();

  if (top.document.commandDispatcher.focusedWindow == content)
    return content;

  var currentNode = top.document.commandDispatcher.focusedElement;
  while (currentNode)
  {
    if (currentNode == msgIdentityElement ||
        currentNode == msgAddressingWidgetElement ||
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
// AddressingWidgetElement.
//
// The only exception is when the MsgHeadersToolbar is
// collapsed, then the focus will always be on the body of
// the message.
function SwitchElementFocus(event)
{
  var focusedElement = WhichElementHasFocus();

  if (event && event.shiftKey)
  {
    if (IsMsgHeadersToolbarCollapsed())
      SetMsgBodyFrameFocus();
    else if (focusedElement == gMsgAddressingWidgetElement)
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
      SetMsgAddressingWidgetElementFocus();
  }
  else
  {
    if (IsMsgHeadersToolbarCollapsed())
      SetMsgBodyFrameFocus();
    else if (focusedElement == gMsgAddressingWidgetElement)
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
      SetMsgAddressingWidgetElementFocus();
  }
}

function loadHTMLMsgPrefs()
{
  var fontSize;
  var textColor;
  var bgColor;

  // This version of GetStringPref() comes from editorUtilities.js instead of
  // utilitiesOverlay.js
  var fontFace = GetStringPref("msgcompose.font_face");
  doStatefulCommand("cmd_fontFace", fontFace);

  try {
    fontSize = getPref("msgcompose.font_size");
    EditorSetFontSize(fontSize);
  } catch (e) {}

  var bodyElement = GetBodyElement();

  try {
    textColor = getPref("msgcompose.text_color");
    if (!bodyElement.hasAttribute("text"))
    {
      bodyElement.setAttribute("text", textColor);
      gDefaultTextColor = textColor;
      document.getElementById("cmd_fontColor").setAttribute("state", textColor);
      onFontColorChange();
    }
  } catch (e) {}

  try {
    bgColor = getPref("msgcompose.background_color");
    if (!bodyElement.hasAttribute("bgcolor"))
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
  if (gMsgCompose.editor && (gContentChanged || gMsgCompose.bodyModified) &&
      !gSendOrSaveOperationInProgress)
  {
    GenericSendMessage(nsIMsgCompDeliverMode.AutoSaveAsDraft);
    gAutoSaveKickedIn = true;
  }
  gAutoSaveTimeout = setTimeout(AutoSave, gAutoSaveInterval);
}

function InitEditor(editor)
{
  gMsgCompose.initEditor(editor, window.content);
  InlineSpellCheckerUI.init(editor);
  EnableInlineSpellCheck(getPref("mail.spellcheck.inline"));
  document.getElementById("menu_inlineSpellCheck").setAttribute("disabled", !InlineSpellCheckerUI.canSpellCheck);
}

function EnableInlineSpellCheck(aEnableInlineSpellCheck)
{
  InlineSpellCheckerUI.enabled = aEnableInlineSpellCheck;
  GetMsgSubjectElement().setAttribute("spellcheck", aEnableInlineSpellCheck);
}

function getMailToolbox()
{
  return document.getElementById("compose-toolbox");
}

function MailToolboxCustomizeInit()
{
  if (document.commandDispatcher.focusedWindow == content)
    window.focus();
  disableEditableFields();
  GetMsgHeadersToolbarElement().setAttribute("moz-collapsed", true);
  document.getElementById("compose-toolbar-sizer").setAttribute("moz-collapsed", true);
  document.getElementById("content-frame").setAttribute("moz-collapsed", true);
  toolboxCustomizeInit("mail-menubar");
}

function MailToolboxCustomizeDone(aToolboxChanged)
{
  toolboxCustomizeDone("mail-menubar", getMailToolbox(), aToolboxChanged);
  GetMsgHeadersToolbarElement().removeAttribute("moz-collapsed");
  document.getElementById("compose-toolbar-sizer").removeAttribute("moz-collapsed");
  document.getElementById("content-frame").removeAttribute("moz-collapsed");
  enableEditableFields();
  SetMsgBodyFrameFocus();
}

function MailToolboxCustomizeChange(aEvent)
{
  toolboxCustomizeChange(getMailToolbox(), aEvent);
}

// Thunderbird compatibility function.
function getPref(aPrefName, aIsComplex)
{
  if (aIsComplex)
      return GetStringPref(aPrefName);

  switch (Services.prefs.getPrefType(aPrefName))
  {
    case Components.interfaces.nsIPrefBranch.PREF_BOOL:
      return Services.prefs.getBoolPref(aPrefName);
    case Components.interfaces.nsIPrefBranch.PREF_INT:
      return Services.prefs.getIntPref(aPrefName);
    case Components.interfaces.nsIPrefBranch.PREF_STRING:
      return Services.prefs.getCharPref(aPrefName);
    default: // includes nsIPrefBranch.PREF_INVALID
      return null;
  }
}
