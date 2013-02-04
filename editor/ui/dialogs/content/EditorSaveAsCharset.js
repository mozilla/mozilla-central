/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gCharset="";
var gTitleWasEdited = false;
var gCharsetWasChanged = false;
var gInsertNewContentType = false;
var gContenttypeElement;
var gInitDone = false;

//Cancel() is in EdDialogCommon.js

function Startup()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    window.close();
    return;
  }

  Services.obs.notifyObservers(null, "charsetmenu-selected", "other");

  gDialog.TitleInput    = document.getElementById("TitleInput");
  gDialog.charsetTree   = document.getElementById('CharsetTree'); 
  gDialog.exportToText  = document.getElementById('ExportToText');

  gContenttypeElement = GetHTTPEquivMetaElement("content-type");
  if (!gContenttypeElement && (editor.contentsMIMEType != 'text/plain')) 
  {
    gContenttypeElement = CreateHTTPEquivMetaElement("content-type");
    if (!gContenttypeElement ) 
	{
      window.close();
      return;
    }
    gInsertNewContentType = true;
  }

  try {
    gCharset = editor.documentCharacterSet;
  } catch (e) {}

  InitDialog();

  // Use the same text as the messagebox for getting title by regular "Save"
  document.getElementById("EnterTitleLabel").setAttribute("value",GetString("NeedDocTitle"));
  // This is an <HTML> element so it wraps -- append a child textnode
  var helpTextParent = document.getElementById("TitleHelp");
  var helpText = document.createTextNode(GetString("DocTitleHelp"));
  if (helpTextParent)
    helpTextParent.appendChild(helpText);
  
  // SET FOCUS TO FIRST CONTROL
  SetTextboxFocus(gDialog.TitleInput);
  
  gInitDone = true;
  
  SetWindowLocation();
}

  
function InitDialog() 
{
  gDialog.TitleInput.value = GetDocumentTitle();

  var RDF = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
  var tree = gDialog.charsetTree;
  var index = tree.view.getIndexOfResource(RDF.GetResource(gCharset));
  if (index >= 0) {
    tree.view.selection.select(index);
    tree.treeBoxObject.ensureRowIsVisible(index);
  }
}


function onAccept()
{
  var editor = GetCurrentEditor();
  editor.beginTransaction();

  if(gCharsetWasChanged) 
  {
     try {
       SetMetaElementContent(gContenttypeElement, "text/html; charset=" + gCharset, gInsertNewContentType, true);     
      editor.documentCharacterSet = gCharset;
    } catch (e) {}
  }

  editor.endTransaction();

  if(gTitleWasEdited) 
    SetDocumentTitle(TrimString(gDialog.TitleInput.value));

  window.opener.ok = true;
  window.opener.exportToText = gDialog.exportToText.checked;
  SaveWindowLocation();
  return true;
}


function readRDFString(aDS,aRes,aProp) 
{
  var n = aDS.GetTarget(aRes, aProp, true);
  if (n)
    return n.QueryInterface(Components.interfaces.nsIRDFLiteral).Value;
  else
    return "";
}

      
function SelectCharset()
{
  if(gInitDone) 
  {
    try 
	{
      gCharset = gDialog.charsetTree.builderView.getResourceAtIndex(gDialog.charsetTree.currentIndex).Value;
      if (gCharset)
        gCharsetWasChanged = true;
    }
    catch(e) {}
  }
}


function TitleChanged()
{
  gTitleWasEdited = true; 
}
