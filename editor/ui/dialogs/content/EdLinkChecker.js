/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Variables used across all the links being checked:
var gNumLinksToCheck = 0;     // The number of nsILinkCheckers
var gLinksBeingChecked = [];  // Array of nsIURICheckers
var gURIRefObjects = [];      // Array of nsIURIRefObjects
var gNumLinksCalledBack = 0;
var gStartedAllChecks = false;
var gLinkCheckTimerID = 0;

// Implement nsIRequestObserver:
var gRequestObserver =
{
  // urichecker requires that we have an OnStartRequest even tho it's a nop.
  onStartRequest: function(request, ctxt) { },

  // onStopRequest is where we really handle the status.
  onStopRequest: function(request, ctxt, status)
  {
    var linkChecker = request.QueryInterface(Components.interfaces.nsIURIChecker);
    if (linkChecker)
    {
      gNumLinksCalledBack++;
      linkChecker.status = status;
      for (var i = 0; i < gNumLinksCalledBack; i++)
      {
        if (linkChecker == gLinksBeingChecked[i])
          gLinksBeingChecked[i].status = status;
      }

      if (gStartedAllChecks && gNumLinksCalledBack >= gNumLinksToCheck)
      {
        clearTimeout(gLinkCheckTimerID);
        LinkCheckTimeOut();
      }
    }
  }
}

function Startup()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    window.close();
    return;
  }

  // Get all objects that refer to other locations
  var objects;
  try {
    objects = editor.getLinkedObjects();
  } catch (e) {}

  if (!objects || objects.Count() == 0)
  {
    Services.prompt.alert(window, GetString("Alert"), GetString("NoLinksToCheck"));
    window.close();
    return;
  }

  gDialog.LinksList = document.getElementById("LinksList");

  // Set window location relative to parent window (based on persisted attributes)
  SetWindowLocation();


  // Loop over the nodes that have links:
  for (var i = 0; i < objects.Count(); i++)
  {
    var refobj = objects.GetElementAt(gNumLinksToCheck).QueryInterface(Components.interfaces.nsIURIRefObject);
    // Loop over the links in this node:
    if (refobj)
    {
      try {
        var uri;
        while ((uri = refobj.GetNextURI()))
        {
          // Use the real class in netlib:
          // Note that there may be more than one link per refobj
          gURIRefObjects[gNumLinksToCheck] = refobj;

          // Make a new nsIURIChecker
          gLinksBeingChecked[gNumLinksToCheck]
            = Components.classes["@mozilla.org/network/urichecker;1"]
                .createInstance()
                  .QueryInterface(Components.interfaces.nsIURIChecker);
          // XXX uri creation needs to be localized
          gLinksBeingChecked[gNumLinksToCheck].init(GetIOService().newURI(uri, null, null));
          gLinksBeingChecked[gNumLinksToCheck].asyncCheck(gRequestObserver, null);

          // Add item  
          var linkChecker = gLinksBeingChecked[gNumLinksToCheck].QueryInterface(Components.interfaces.nsIURIChecker);
          SetItemStatus(linkChecker.name, "busy");
dump(" *** Linkcount = "+gNumLinksToCheck+"\n");
          gNumLinksToCheck++;

        };
      } catch (e) { dump (" *** EXCEPTION\n");}
    }
  }
  // Done with the loop, now we can be prepared for the finish:
  gStartedAllChecks = true;

  // Start timer to limit how long we wait for link checking
  gLinkCheckTimerID = setTimeout(LinkCheckTimeOut, 5000);
  window.sizeToContent();
}

function LinkCheckTimeOut()
{
  // We might have gotten here via a late timeout
  if (gNumLinksToCheck <= 0)
    return;
  gLinkCheckTimerID = 0;

  gNumLinksToCheck = 0;
  gStartedAllChecks = false;
  for (var i=0; i < gLinksBeingChecked.length; i++)
  {
    var linkChecker = gLinksBeingChecked[i].QueryInterface(Components.interfaces.nsIURIChecker);
    // nsIURIChecker status values:
    // NS_BINDING_SUCCEEDED     link is valid
    // NS_BINDING_FAILED        link is invalid (gave an error)
    // NS_BINDING_ABORTED       timed out, or cancelled
    switch (linkChecker.status)
    {
      case 0:           // NS_BINDING_SUCCEEDED
        SetItemStatus(linkChecker.name, "done");
        break;
      case 0x804b0001:  // NS_BINDING_FAILED
        dump(">> " + linkChecker.name + " is broken\n");
      case 0x804b0002:   // NS_BINDING_ABORTED
//        dump(">> " + linkChecker.name + " timed out\n");
      default:
//        dump(">> " + linkChecker.name + " not checked\n");
        SetItemStatus(linkChecker.name, "failed");
        break;
    }
  }
}

// Add url to list of links to check
// or set status for file already in the list
// Returns true if url was in the list
function SetItemStatus(url, status)
{
  if (!url)
    return false;

  if (!status)
    status = "busy";

  // Just set attribute for status icon 
  // if we already have this url 
  let listitem = document.querySelector('listitem[label="' + url + '"]');
  if (listitem)
  {
    listitem.setAttribute("progress", status);
    return true;
  }

  // We're adding a new item to list
  listitem = document.createElementNS(XUL_NS, "listitem");
  if (listitem)
  {
    listitem.setAttribute("class", "listitem-iconic progressitem");
    // This triggers CSS to show icon for each status state
    listitem.setAttribute("progress", status);
    listitem.setAttribute("label", url);
    gDialog.LinksList.appendChild(listitem);
  }
  return false;
}

function onAccept()
{
  SaveWindowLocation();
  return true; // do close the window
}

function onCancelLinkChecker()
{
  if (gLinkCheckTimerID)
    clearTimeout(gLinkCheckTimerID);

/*
  LinkCheckTimeOut();
*/
  return onCancel();
}
