/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

const HORIZONTAL = 1;
const LEFT = 2;
const TOP = 4;

var gSlideTime = 50;
var gNumNewMsgsToShowInAlert = 4; // the more messages we show in the alert, the larger it will be
var gOpenTime = 3000; // total time the alert should stay up once we are done animating.
var gAlertListener = null;
var gPendingPreviewFetchRequests = 0;
var gUserInitiated = false;
var gFadeIncrement = .05;
var gOrigin = 0;

function prefillAlertInfo()
{
  // unwrap all the args....
  // arguments[0] --> array of folders with new mail
  // arguments[1] --> the observer to call back with notifications about the alert
  // arguments[2] --> user initiated boolean. true if the user initiated opening the alert 
  //                 (which means skip the fade effect and don't auto close the alert)
  // arguments[3] --> the alert origin returned by the look and feel
  var foldersWithNewMail = window.arguments[0];  
  gAlertListener = window.arguments[1];
  gUserInitiated = window.arguments[2];
  gOrigin = window.arguments[3];

  // For now just grab the first folder which should be a root folder
  // for the account that has new mail. If we can't find a folder, just
  // return to avoid the exception and empty dialog in upper left-hand corner.
  let rootFolder;
  if (foldersWithNewMail && foldersWithNewMail.Count() > 0)
     rootFolder = foldersWithNewMail.GetElementAt(0)
                    .QueryInterface(Components.interfaces.nsIWeakReference)
                    .QueryReferent(Components.interfaces.nsIMsgFolder);
  else
   return;

  // generate an account label string based on the root folder
  var label = document.getElementById('alertTitle');
  var totalNumNewMessages = rootFolder.getNumNewMessages(true);
  label.value = document.getElementById('bundle_messenger').getFormattedString(totalNumNewMessages == 1 ? "newMailNotification_message" : "newMailNotification_messages", 
                                                                                     [rootFolder.prettiestName, totalNumNewMessages]);

  // this is really the root folder and we have to walk through the list to find the real folder that has new mail in it...:(
  var allFolders = Components.classes["@mozilla.org/supports-array;1"].createInstance(Components.interfaces.nsISupportsArray);
  rootFolder.ListDescendents(allFolders);
  var numFolders = allFolders.Count();
  var folderSummaryInfoEl = document.getElementById('folderSummaryInfo');
  folderSummaryInfoEl.mMaxMsgHdrsInPopup = gNumNewMsgsToShowInAlert;
  for (var folderIndex = 0; folderIndex < numFolders; folderIndex++)
  {
    var folder = allFolders.GetElementAt(folderIndex).QueryInterface(Components.interfaces.nsIMsgFolder);
    const nsMsgFolderFlags = Components.interfaces.nsMsgFolderFlags;
    if (folder.hasNewMessages && !(folder.flags & nsMsgFolderFlags.Virtual))
    {
      var asyncFetch = {};
      folderSummaryInfoEl.parseFolder(folder, new urlListener(folder), asyncFetch);
      if (asyncFetch.value)
        gPendingPreviewFetchRequests++;
    }
  }
}

function urlListener(aFolder)
{
  this.mFolder = aFolder;
}

urlListener.prototype = {
  OnStartRunningUrl: function(aUrl)
  {
  },

  OnStopRunningUrl: function(aUrl, aExitCode)
  {
    var folderSummaryInfoEl = document.getElementById('folderSummaryInfo');
    var asyncFetch = {};
    folderSummaryInfoEl.parseFolder(this.mFolder, null, asyncFetch);
    gPendingPreviewFetchRequests--;

    // when we are done running all of our urls for fetching the preview text,
    // start the alert.
    if (!gPendingPreviewFetchRequests)
      showAlert();
  }
}

function onAlertLoad()
{
  prefillAlertInfo();
  // read out our initial settings from prefs.
  try 
  {
    gSlideTime = Services.prefs.getIntPref("alerts.slideIncrementTime");
    gOpenTime = Services.prefs.getIntPref("alerts.totalOpenTime");
  } catch (ex) {}
  
  // bogus call to make sure the window is moved offscreen until we are ready for it.
  resizeAlert(true);

  // if we aren't waiting to fetch preview text, then go ahead and 
  // start showing the alert.
  if (!gPendingPreviewFetchRequests)
    setTimeout(showAlert, 0); // let the JS thread unwind, to give layout 
                              // a chance to recompute the styles and widths for our alert text.
}

// If the user initiated the alert, show it right away, otherwise start opening the alert with
// the fade effect. 
function showAlert()
{
  if (!gUserInitiated) // set the initial opacity before we resize the window
    document.getElementById('alertContainer').style.opacity = 0;
  
  // resize the alert based on our current content  
  resizeAlert(false);
  
  if (document.getElementById('folderSummaryInfo').hasMessages)
  {
    if (!gUserInitiated) // don't fade in if the user opened the alert
      setTimeout(fadeOpen, gSlideTime);
  }
  else
    closeAlert(); // no mail, so don't bother showing the alert...
}

function resizeAlert(aMoveOffScreen)
{
  // sizeToContent is not working. It isn't honoring the max widths we are attaching to our inner
  // objects like the folder summary element. While the folder summary element is cropping, 
  // sizeToContent ends up thinking the window needs to be much wider than it should be. 
  // use resizeTo and make up our measurements...
  //sizeToContent();
  
  // Use the wider of the alert groove and the folderSummaryInfo box, then 
  // add on the width of alertImageBox + some small amount of fudge. For the height, 
  // just use the size of the alertBox, that appears to be pretty accurate.
  var windowWidth = Math.max (document.getBoxObjectFor(document.getElementById('alertGroove')).width,
                              document.getBoxObjectFor(document.getElementById('folderSummaryInfo')).width);
  resizeTo(windowWidth + document.getBoxObjectFor(document.getElementById('alertImageBox')).width + 30, 
           document.getBoxObjectFor(document.getElementById('alertBox')).height + 10);                     
  
  // leftover hack to get the window properly hidden when we first open it
  if (aMoveOffScreen)
    window.outerHeight = 1;

  // Determine position and move window
  var x = gOrigin & LEFT ? screen.availLeft :
          (screen.availLeft + screen.availWidth - window.outerWidth);
  var y = gOrigin & TOP ? screen.availTop :
          (screen.availTop + screen.availHeight - window.outerHeight);
  window.moveTo(x, y);
}

function fadeOpen()
{
  var alertContainer = document.getElementById('alertContainer');
  var newOpacity = parseFloat(window.getComputedStyle(alertContainer, "").opacity) + gFadeIncrement;
  alertContainer.style.opacity = newOpacity;
  
  if (newOpacity < 1.0)    
    setTimeout(fadeOpen, gSlideTime);
  else // switch gears and start closing the alert
    setTimeout(fadeClose, gOpenTime);  
}

function fadeClose()
{
  var alertContainer = document.getElementById('alertContainer');
  var newOpacity = parseFloat(window.getComputedStyle(alertContainer, "").opacity) - gFadeIncrement;
  alertContainer.style.opacity = newOpacity;
  
  if (newOpacity <= 0)
    closeAlert();
  else
    setTimeout(fadeClose, gSlideTime);
}

function closeAlert()
{
  if (gAlertListener)
    gAlertListener.observe(null, "alertfinished", ""); 
  window.close(); 
}
