/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gNewTitle = "";
var gAuthor = "";
var gDescription = "";
var gAuthorElement;
var gDescriptionElement;
var gInsertNewAuthor = false;
var gInsertNewDescription = false;
var gTitleWasEdited = false;
var gAuthorWasEdited = false;
var gDescWasEdited = false;

//Cancel() is in EdDialogCommon.js
// dialog initialization code
function Startup()
{
  var editor = GetCurrentEditor();
  if (!editor)
  {
    window.close();
    return;
  }

  gDialog.PageLocation     = document.getElementById("PageLocation");
  gDialog.PageModDate      = document.getElementById("PageModDate");
  gDialog.TitleInput       = document.getElementById("TitleInput");
  gDialog.AuthorInput      = document.getElementById("AuthorInput");
  gDialog.DescriptionInput = document.getElementById("DescriptionInput");
  
  // Default string for new page is set from DTD string in XUL,
  //   so set only if not new doc URL
  var location = GetDocumentUrl();
  var lastmodString = GetString("Unknown");

  if (!IsUrlAboutBlank(location))
  {
    // NEVER show username and password in clear text
    gDialog.PageLocation.setAttribute("value", StripPassword(location));

    // Get last-modified file date+time
    // TODO: Convert this to local time?
    var lastmod;
    try {
      lastmod = editor.document.lastModified;  // get string of last modified date
    } catch (e) {}
    // Convert modified string to date (0 = unknown date or January 1, 1970 GMT)
    if(Date.parse(lastmod))
    {
      try {
        const nsScriptableDateFormat_CONTRACTID = "@mozilla.org/intl/scriptabledateformat;1";
        const nsIScriptableDateFormat = Components.interfaces.nsIScriptableDateFormat;
        var dateService = Components.classes[nsScriptableDateFormat_CONTRACTID]
         .getService(nsIScriptableDateFormat);

        var lastModDate = new Date();
        lastModDate.setTime(Date.parse(lastmod));
        lastmodString =  dateService.FormatDateTime("", 
                                      dateService.dateFormatLong,
                                      dateService.timeFormatSeconds,
                                      lastModDate.getFullYear(),
                                      lastModDate.getMonth()+1,
                                      lastModDate.getDate(),
                                      lastModDate.getHours(),
                                      lastModDate.getMinutes(),
                                      lastModDate.getSeconds());
      } catch (e) {}
    }
  }
  gDialog.PageModDate.value = lastmodString;

  gAuthorElement = GetMetaElementByAttribute("name", "author");
  if (!gAuthorElement)
  {
    gAuthorElement = CreateMetaElementWithAttribute("name", "author");
    if (!gAuthorElement)
    {
      window.close();
      return;
    }
    gInsertNewAuthor = true;
  }

  gDescriptionElement = GetMetaElementByAttribute("name", "description");
  if (!gDescriptionElement)
  {
    gDescriptionElement = CreateMetaElementWithAttribute("name", "description");
    if (!gDescriptionElement)
      window.close();

    gInsertNewDescription = true;
  }
  
  InitDialog();

  SetTextboxFocus(gDialog.TitleInput);

  SetWindowLocation();
}

function InitDialog()
{
  gDialog.TitleInput.value = GetDocumentTitle();

  var gAuthor = TrimString(gAuthorElement.getAttribute("content"));
  if (!gAuthor)
  {
    // Fill in with value from editor prefs
    gAuthor = Services.prefs.getCharPref("editor.author");
  }
  gDialog.AuthorInput.value = gAuthor;
  gDialog.DescriptionInput.value = gDescriptionElement.getAttribute("content");
}

function TextboxChanged(ID)
{
  switch(ID)
  {
    case "TitleInput":
      gTitleWasEdited = true;
      break;
    case "AuthorInput":
      gAuthorWasEdited = true;
      break;
    case "DescriptionInput":
      gDescWasEdited = true;
      break;
  }
}

function ValidateData()
{
  gNewTitle = TrimString(gDialog.TitleInput.value);
  gAuthor = TrimString(gDialog.AuthorInput.value);
  gDescription = TrimString(gDialog.DescriptionInput.value);
  return true;
}

function onAccept()
{
  if (ValidateData())
  {
    var editor = GetCurrentEditor();
    editor.beginTransaction();

    // Set title contents even if string is empty
    //  because TITLE is a required HTML element
    if (gTitleWasEdited)
      SetDocumentTitle(gNewTitle);
    
    if (gAuthorWasEdited)
      SetMetaElementContent(gAuthorElement, gAuthor, gInsertNewAuthor, false);

    if (gDescWasEdited)
      SetMetaElementContent(gDescriptionElement, gDescription, gInsertNewDescription, false);

    editor.endTransaction();

    SaveWindowLocation();
    return true; // do close the window
  }
  return false;
}

