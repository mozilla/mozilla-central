/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* Implementations of nsIControllerCommand for composer commands */

function initEditorContextMenuItems(aEvent)
{
  var shouldShowEditPage = !gContextMenu.onImage && !gContextMenu.onLink && !gContextMenu.onTextInput && !gContextMenu.inDirList;
  gContextMenu.showItem( "context-editpage", shouldShowEditPage );

  var shouldShowEditLink = gContextMenu.onSaveableLink; 
  gContextMenu.showItem( "context-editlink", shouldShowEditLink );

  // Hide the applications separator if there's no add-on apps present. 
  gContextMenu.showItem("context-sep-apps", gContextMenu.shouldShowSeparator("context-sep-apps"));
}
  
function initEditorContextMenuListener(aEvent)
{
  var popup = document.getElementById("contentAreaContextMenu");
  if (popup)
    popup.addEventListener("popupshowing", initEditorContextMenuItems, false);
}

addEventListener("load", initEditorContextMenuListener, false);

function editDocument(aDocument)      
{
  if (!aDocument)
    aDocument = window.content.document;

  editPage(aDocument.URL); 
}

function editPageOrFrame()
{
  var focusedWindow = document.commandDispatcher.focusedWindow;

  // if the uri is a specific frame, grab it, else use the frameset uri 
  // and let Composer handle error if necessary
  editPage(getContentFrameURI(focusedWindow));
}

function getContentFrameURI(aFocusedWindow)
{
  var contentFrame = isContentFrame(aFocusedWindow) ?
                       aFocusedWindow : window.content;
  return contentFrame.location.href;
}

// Any non-editor window wanting to create an editor with a URL
//   should use this instead of "window.openDialog..."
//  We must always find an existing window with requested URL
function editPage(url, aFileType)
{
  // aFileType is optional and needs to default to html.
  aFileType = aFileType || "html";

  // Always strip off "view-source:" and #anchors
  url = url.replace(/^view-source:/, "").replace(/#.*/, "");

  // if the current window is a browser window, then extract the current charset menu setting from the current 
  // document and use it to initialize the new composer window...

  var wintype = document.documentElement.getAttribute('windowtype');
  var charsetArg;

  if (wintype == "navigator:browser" && content.document)
    charsetArg = "charset=" + content.document.characterSet;

  try {
    let uri = createURI(url, null, null);

    let enumerator = Services.wm.getEnumerator("composer:" + aFileType);
    let emptyWindow;
    while ( enumerator.hasMoreElements() )
    {
      var win = enumerator.getNext();
      if ( win && win.IsWebComposer())
      {
        if (CheckOpenWindowForURIMatch(uri, win))
        {
          // We found an editor with our url
          win.focus();
          return;
        }
        else if (!emptyWindow && win.PageIsEmptyAndUntouched())
        {
          emptyWindow = win;
        }
      }
    }

    if (emptyWindow)
    {
      // we have an empty window we can use
      if (aFileType == "html" && emptyWindow.IsInHTMLSourceMode())
        emptyWindow.SetEditMode(emptyWindow.PreviousNonSourceDisplayMode);
      emptyWindow.EditorLoadUrl(url);
      emptyWindow.focus();
      emptyWindow.SetSaveAndPublishUI(url);
      return;
    }

    // Create new Composer / Text Editor window.
    if (aFileType == "text" && ("EditorNewPlaintext" in window))
      EditorNewPlaintext(url, charsetArg);
    else
      NewEditorWindow(url, charsetArg);

  } catch(e) {}
}

function createURI(urlstring)
{
  try {
    return Services.io.newURI(urlstring, null, null);
  } catch (e) {}

  return null;
}

function CheckOpenWindowForURIMatch(uri, win)
{
  try {
    var contentWindow = win.content;
    var contentDoc = contentWindow.document;
    var htmlDoc = contentDoc.QueryInterface(Components.interfaces.nsIDOMHTMLDocument);
    var winuri = createURI(htmlDoc.URL);
    return winuri.equals(uri);
  } catch (e) {}
  
  return false;
}

function toEditor()
{
  if (!CycleWindow("composer:html"))
    NewEditorWindow();
}

function NewEditorWindow(aUrl, aCharsetArg)
{
  window.openDialog("chrome://editor/content",
                    "_blank",
                    "chrome,all,dialog=no",
                    aUrl || "about:blank",
                    aCharsetArg);
}

function NewEditorFromTemplate()
{
  // XXX not implemented
}

function NewEditorFromDraft()
{
  // XXX not implemented
}
