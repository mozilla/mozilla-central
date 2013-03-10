/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gInProgress = true;
var gPublishData;
var gPersistObj;
var gTotalFileCount = 0;
var gSucceededCount = 0;
var gFinished = false;
var gPublishingFailed = false;
var gFileNotFound = false;
var gStatusMessage="";

var gTimerID;
var gAllowEnterKey = false;

// Publishing error codes
//   These are translated from C++ error code strings like this:
//   kFileNotFound = "FILE_NOT_FOUND",
const kNetReset = 2152398868; // nsISocketTransportService.idl
const kFileNotFound = 2152857618;
const kNotConnected = 2152398860; // in netCore.h
const kConnectionRefused = 2152398861; // nsISocketTransportService.idl
const kNetTimeout = 2152398862; // nsISocketTransportService.idl
const kNoConnectionOrTimeout = 2152398878;
const kPortAccessNotAllowed = 2152398867; // netCore.h
const kOffline = 2152398865; // netCore.h
const kDiskFull = 2152857610;
const kNoDeviceSpace = 2152857616;
const kNameTooLong = 2152857617;
const kAccessDenied = 2152857621;

// These are more errors that I don't think we encounter during publishing,
//  so we don't have error strings yet. Let's keep them here for future reference
//const kUnrecognizedPath = 2152857601;
//const kUnresolvableSymlink = 2152857602;
//const kUnknownType = 2152857604;
//const kDestinationNotDir = 2152857605;
//const kTargetDoesNotExist = 2152857606;
//const kAlreadyExists = 2152857608;
//const kInvalidPath = 2152857609;
//const kNotDirectory = 2152857612;
//const kIsDirectory = 2152857613;
//const kIsLocked = 2152857614;
//const kTooBig = 2152857615;
//const kReadOnly = 2152857619;
//const kDirectoryNotEmpty = 2152857620;
//const kErrorBindingRedirected = 2152398851;
//const kAlreadyConnected = 2152398859; // in netCore.h
//const kInProgress = 2152398863; // netCore.h
//const kNoContent = 2152398865; // netCore.h
//const kUnknownProtocol = 2152398866 // netCore.h
//const kFtpLogin = 2152398869; // ftpCore.h
//const kFtpCWD = 2152398870; // ftpCore.h
//const kFtpPasv = 2152398871; // ftpCore.h
//const kFtpPwd = 2152398872; // ftpCore.h


function Startup()
{
  gPublishData = window.arguments[0];
  if (!gPublishData)
  {
    dump("No publish data!\n");
    window.close();
    return;
  }

  gDialog.FileList           = document.getElementById("FileList");
  gDialog.FinalStatusMessage = document.getElementById("FinalStatusMessage");
  gDialog.StatusMessage      = document.getElementById("StatusMessage");
  gDialog.KeepOpen           = document.getElementById("KeepOpen");
  gDialog.Close              = document.documentElement.getButton("cancel");

  SetWindowLocation();
  var title = GetDocumentTitle();
  if (!title)
    title = "(" + opener.gUntitledString + ")";
  document.title = GetString("PublishProgressCaption").replace(/%title%/, title);

  document.getElementById("PublishToSite").value = 
    GetString("PublishToSite").replace(/%title%/, TruncateStringAtWordEnd(gPublishData.siteName, 25)); 

  // Show publishing destination URL
  document.getElementById("PublishUrl").value = gPublishData.publishUrl;
  
  // Show subdirectories only if not empty
  if (gPublishData.docDir || gPublishData.otherDir)
  {
    if (gPublishData.docDir)
      document.getElementById("docDir").value = gPublishData.docDir;
    else
      document.getElementById("DocSubdir").hidden = true;
      
    if (gPublishData.publishOtherFiles && gPublishData.otherDir)
      document.getElementById("otherDir").value = gPublishData.otherDir;
    else
      document.getElementById("OtherSubdir").hidden = true;
  }
  else
    document.getElementById("Subdirectories").hidden = true;

  // Add the document to the "publish to" list as quick as possible!
  SetProgressStatus(gPublishData.filename, "busy");

  if (gPublishData.publishOtherFiles)
  {
    // When publishing images as well, expand list to show more items
    gDialog.FileList.setAttribute("rows", 5);
    window.sizeToContent();
  }

  // Now that dialog is initialized, we can start publishing
  gPersistObj = window.opener.StartPublishing();
}

// this function is to be used when we cancel persist's saving
// since not all messages will be returned to us if we cancel
// this function changes status for all non-done/non-failure to failure
function SetProgressStatusCancel()
{
  let listitems = document.querySelectorAll('listitem:not([progress="done"]):not([progress="failed"])');
  if (!listitems)
    return;

  for (var i=0; i < listitems.length; i++)
  {
    listitems[i].setAttribute("progress", "failed");
  }
}

// Add filename to list of files to publish
// or set status for file already in the list
// Returns true if file was in the list
function SetProgressStatus(filename, status)
{
  if (!filename)
    return false;

  if (!status)
    status = "busy";

  // Just set attribute for status icon if we already have this filename.
  let listitem = document.querySelector('listitem[label="' + filename + '"]');
  if (listitem)
  {
    listitem.setAttribute("progress", status);
    return true;
  }
  // We're adding a new file item to list
  gTotalFileCount++;

  listitem = document.createElementNS(XUL_NS, "listitem");
  if (listitem)
  {
    listitem.setAttribute("class", "listitem-iconic progressitem");
    // This triggers CSS to show icon for each status state
    listitem.setAttribute("progress", status);
    listitem.setAttribute("label", filename);
    gDialog.FileList.appendChild(listitem);
  }
  return false;
}

function SetProgressFinished(filename, networkStatus)
{
  var abortPublishing = false;
  if (filename)
  {
    var status = networkStatus ? "failed" : "done";
    if (networkStatus == 0)
      gSucceededCount++;

    SetProgressStatus(filename, status);
  }

  if (networkStatus != 0) // Error condition
  {
    // We abort on all errors except if image file was not found
    abortPublishing = networkStatus != kFileNotFound;

    // Mark all remaining files as "failed"
    if (abortPublishing)
    {
      gPublishingFailed = true;
      SetProgressStatusCancel();
      gDialog.FinalStatusMessage.value = GetString("PublishFailed");
    }

    switch (networkStatus)
    {
      case kFileNotFound:
        gFileNotFound = true;
        if (filename)
          gStatusMessage = GetString("FileNotFound").replace(/%file%/, filename);
        break;
      case kNetReset:
        // We get this when subdir doesn't exist AND
        //   if filename used is same as an existing subdir 
        var dir = (gPublishData.filename == filename) ? 
                     gPublishData.docDir : gPublishData.otherDir;

        if (dir)
        {
          // This is the ambiguous case when we can't tell if subdir or filename is bad
          // Remove terminal "/" from dir string and insert into message
          gStatusMessage = GetString("SubdirDoesNotExist").replace(/%dir%/, dir.slice(0, dir.length-1));
          gStatusMessage = gStatusMessage.replace(/%file%/, filename);

          // Remove directory from saved prefs
          // XXX Note that if subdir is good, 
          //     but filename = next level subdirectory name, 
          //     we really shouldn't remove subdirectory, 
          //     but it's impossible to differentiate this case!
          RemovePublishSubdirectoryFromPrefs(gPublishData, dir);
        }
        else if (filename)
          gStatusMessage = GetString("FilenameIsSubdir").replace(/%file%/, filename);

        break;
      case kNotConnected:
      case kConnectionRefused:
      case kNetTimeout:
      case kNoConnectionOrTimeout:
      case kPortAccessNotAllowed:
        gStatusMessage = GetString("ServerNotAvailable");
        break;
      case kOffline:
        gStatusMessage = GetString("Offline");
        break;
      case kDiskFull:
      case kNoDeviceSpace:
        if (filename)
          gStatusMessage = GetString("DiskFull").replace(/%file%/, filename);
        break;
      case kNameTooLong:
        if (filename)
          gStatusMessage = GetString("NameTooLong").replace(/%file%/, filename);
        break;
      case kAccessDenied:
        if (filename)
          gStatusMessage = GetString("AccessDenied").replace(/%file%/, filename);
        break;
      case kUnknownType:
      default:
        gStatusMessage = GetString("UnknownPublishError")
        break;
    }
  }
  else if (!filename)
  {
    gFinished = true;

    document.documentElement.setAttribute("buttonlabelcancel",
      document.documentElement.getAttribute("buttonlabelclose"));

    if (!gStatusMessage)
      gStatusMessage = GetString(gPublishingFailed ? "UnknownPublishError" : "AllFilesPublished");

    // Now allow "Enter/Return" key to close the dialog
    AllowDefaultButton();

    if (gPublishingFailed || gFileNotFound)
    {
      // Show "Troubleshooting" button to help solving problems
      //  and key for successful / failed files
      document.getElementById("failureBox").hidden = false;
    }
  }

  if (gStatusMessage)
    SetStatusMessage(gStatusMessage);
}

function CheckKeepOpen()
{
  if (gTimerID)
  {
    clearTimeout(gTimerID);
    gTimerID = null;
  }
}

function onClose()
{
  if (!gFinished)
  {
    const buttonFlags = (Services.prompt.BUTTON_TITLE_IS_STRING *
                         Services.prompt.BUTTON_POS_0) +
                        (Services.prompt.BUTTON_TITLE_CANCEL *
                         Services.prompt.BUTTON_POS_1);
    let button = Services.prompt.confirmEx(window,
                                           GetString("CancelPublishTitle"),
                                           GetString("CancelPublishMessage"),
                                           buttonFlags,
                                           GetString("CancelPublishContinue"),
                                           null, null, null, {});
    if (button == 0)
      return false;
  }

  if (gTimerID)
  {
    clearTimeout(gTimerID);
    gTimerID = null;
  }

  if (!gFinished && gPersistObj)
  {
    try {
      gPersistObj.cancelSave();
    } catch (e) {}
  }
  SaveWindowLocation();

  // Tell caller so they can cleanup and restore editability
  window.opener.FinishPublishing();
  return true;
}

function AllowDefaultButton()
{
  gDialog.Close.setAttribute("default","true");
  gAllowEnterKey = true;
}

function onEnterKey()
{
  if (gAllowEnterKey)
    return CloseDialog();

  return false;
}

function RequestCloseDialog()
{
  // Finish progress messages, settings buttons etc.
  SetProgressFinished(null, 0);

  if (!gDialog.KeepOpen.checked)
  {
    // Leave window open a minimum amount of time 
    gTimerID = setTimeout(CloseDialog, 3000);
  }

  // Set "completed" message if we succeeded
  // (Some image files may have failed,
  //  but we don't abort publishing for that)
  if (!gPublishingFailed)
  {
    gDialog.FinalStatusMessage.value = GetString("PublishCompleted");
    if (gFileNotFound && gTotalFileCount-gSucceededCount)
    {
      // Show number of files that failed to upload
      gStatusMessage = 
        (GetString("FailedFileMsg").replace(/%x%/,(gTotalFileCount-gSucceededCount)))
          .replace(/%total%/,gTotalFileCount);

      SetStatusMessage(gStatusMessage);
    }
  }
}

function SetStatusMessage(message)
{
  // Status message is a child of <description> element
  //  so text can wrap to multiple lines if necessary
  if (gDialog.StatusMessage.firstChild)
  {
    gDialog.StatusMessage.firstChild.data = message;
  }
  else
  {
    var textNode = document.createTextNode(message);
    if (textNode)
      gDialog.StatusMessage.appendChild(textNode);
  }
  window.sizeToContent();
}

function CloseDialog()
{
  SaveWindowLocation();
  window.opener.FinishPublishing();
  try {
    window.close();
  } catch (e) {}
}
