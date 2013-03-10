/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/Services.jsm");

/**** NAMESPACES ****/
const XUL_NS = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

// Each editor window must include this file
// Variables  shared by all dialogs:

// Object to attach commonly-used widgets (all dialogs should use this)
var gDialog = {};

const kOutputEncodeBasicEntities = Components.interfaces.nsIDocumentEncoder.OutputEncodeBasicEntities;
const kOutputEncodeHTMLEntities = Components.interfaces.nsIDocumentEncoder.OutputEncodeHTMLEntities;
const kOutputEncodeLatin1Entities = Components.interfaces.nsIDocumentEncoder.OutputEncodeLatin1Entities;
const kOutputEncodeW3CEntities = Components.interfaces.nsIDocumentEncoder.OutputEncodeW3CEntities;
const kOutputFormatted = Components.interfaces.nsIDocumentEncoder.OutputFormatted;
const kOutputLFLineBreak = Components.interfaces.nsIDocumentEncoder.OutputLFLineBreak;
const kOutputSelectionOnly = Components.interfaces.nsIDocumentEncoder.OutputSelectionOnly;
const kOutputWrap = Components.interfaces.nsIDocumentEncoder.OutputWrap;

var gStringBundle;
var gFilePickerDirectory;

var gOS = "";
const gWin = "Win";
const gUNIX = "UNIX";
const gMac = "Mac";

const kWebComposerWindowID = "editorWindow";
const kMailComposerWindowID = "msgcomposeWindow";

var gIsHTMLEditor;
/************* Message dialogs ***************/

// Optional: Caller may supply text to substitue for "Ok" and/or "Cancel"
function ConfirmWithTitle(title, message, okButtonText, cancelButtonText)
{
  let okFlag = okButtonText ? Services.prompt.BUTTON_TITLE_IS_STRING : Services.prompt.BUTTON_TITLE_OK;
  let cancelFlag = cancelButtonText ? Services.prompt.BUTTON_TITLE_IS_STRING : Services.prompt.BUTTON_TITLE_CANCEL;

  return Services.prompt.confirmEx(window, title, message,
                                   (okFlag * Services.prompt.BUTTON_POS_0) +
                                   (cancelFlag * Services.prompt.BUTTON_POS_1),
                                   okButtonText, cancelButtonText, null, null, {value:0}) == 0;
}

/************* String Utilities ***************/

function GetString(name)
{
  if (!gStringBundle)
  {
    try {
      gStringBundle = Services.strings.createBundle("chrome://editor/locale/editor.properties");
    } catch (ex) {}
  }
  if (gStringBundle)
  {
    try {
      return gStringBundle.GetStringFromName(name);
    } catch (e) {}
  }
  return null;
}

function GetFormattedString(aName, aVal)
{
  if (!gStringBundle)
  {
    try {
      gStringBundle = Services.strings.createBundle("chrome://editor/locale/editor.properties");
    } catch (ex) {}
  }
  if (gStringBundle)
  {
    try {
      return gStringBundle.formatStringFromName(aName, [aVal], 1);
    } catch (e) {}
  }
  return null;
}

function TrimStringLeft(string)
{
  if (!string)
    return "";
  return string.trimLeft();
}

function TrimStringRight(string)
{
  if (!string)
    return "";
  return string.trimRight();
}

// Remove whitespace from both ends of a string
function TrimString(string)
{
  if (!string)
    return "";
  return string.trim();
}

function TruncateStringAtWordEnd(string, maxLength, addEllipses)
{
  // Return empty if string is null, undefined, or the empty string
  if (!string)
    return "";

  // We assume they probably don't want whitespace at the beginning
  string = string.trimLeft();
  if (string.length <= maxLength)
    return string;

  // We need to truncate the string to maxLength or fewer chars
  if (addEllipses)
    maxLength -= 3;
  string = string.replace(RegExp("(.{0," + maxLength + "})\\s.*"), "$1")

  if (string.length > maxLength)
    string = string.slice(0, maxLength);

  if (addEllipses)
    string += "...";
  return string;
}

// Replace all whitespace characters with supplied character
// E.g.: Use charReplace = " ", to "unwrap" the string by removing line-end chars
//       Use charReplace = "_" when you don't want spaces (like in a URL)
function ReplaceWhitespace(string, charReplace)
{
  return string.trim().replace(/\s+/g, charReplace);
}

// Replace whitespace with "_" and allow only HTML CDATA
//   characters: "a"-"z","A"-"Z","0"-"9", "_", ":", "-", ".",
//   and characters above ASCII 127
function ConvertToCDATAString(string)
{
  return string.replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_\.\-\:\u0080-\uFFFF]+/g,'');
}

function GetSelectionAsText()
{
  try {
    return GetCurrentEditor().outputToString("text/plain", kOutputSelectionOnly);
  } catch (e) {}

  return "";
}


/************* Get Current Editor and associated interfaces or info ***************/
const nsIPlaintextEditor = Components.interfaces.nsIPlaintextEditor;
const nsIHTMLEditor = Components.interfaces.nsIHTMLEditor;
const nsITableEditor = Components.interfaces.nsITableEditor;
const nsIEditorStyleSheets = Components.interfaces.nsIEditorStyleSheets;
const nsIEditingSession = Components.interfaces.nsIEditingSession;

function GetCurrentEditor()
{
  // Get the active editor from the <editor> tag
  // XXX This will probably change if we support > 1 editor in main Composer window
  //      (e.g. a plaintext editor for HTMLSource)

  // For dialogs: Search up parent chain to find top window with editor
  var editor;
  try {
    var editorElement = GetCurrentEditorElement();
    editor = editorElement.getEditor(editorElement.contentWindow);

    // Do QIs now so editor users won't have to figure out which interface to use
    // Using "instanceof" does the QI for us.
    editor instanceof Components.interfaces.nsIPlaintextEditor;
    editor instanceof Components.interfaces.nsIHTMLEditor;
  } catch (e) { dump (e)+"\n"; }

  return editor;
}

function GetCurrentTableEditor()
{
  var editor = GetCurrentEditor();
  return (editor && (editor instanceof nsITableEditor)) ? editor : null;
}

function GetCurrentEditorElement()
{
  var tmpWindow = window;

  do {
    // Get the <editor> element(s)
    let editorItem = tmpWindow.document.querySelector("editor");

    // This will change if we support > 1 editor element
    if (editorItem)
      return editorItem;

    tmpWindow = tmpWindow.opener;
  }
  while (tmpWindow);

  return null;
}

function GetCurrentCommandManager()
{
  try {
    return GetCurrentEditorElement().commandManager;
  } catch (e) { dump (e)+"\n"; }

  return null;
}

function GetCurrentEditorType()
{
  try {
    return GetCurrentEditorElement().editortype;
  } catch (e) { dump (e)+"\n"; }

  return "";
}

function IsHTMLEditor()
{
  // We don't have an editorElement, just return false
  if (!GetCurrentEditorElement())
    return false;

  var editortype = GetCurrentEditorType();
  switch (editortype)
  {
      case "html":
      case "htmlmail":
        return true;

      case "text":
      case "textmail":
        return false

      default:
        dump("INVALID EDITOR TYPE: " + editortype + "\n");
        break;
  }
  return false;
}

function PageIsEmptyAndUntouched()
{
  return IsDocumentEmpty() && !IsDocumentModified() && !IsHTMLSourceChanged();
}

function IsInHTMLSourceMode()
{
  return (gEditorDisplayMode == kDisplayModeSource);
}

function IsInPreviewMode()
{
  return (gEditorDisplayMode == kDisplayModePreview);
}

// are we editing HTML (i.e. neither in HTML source mode, nor editing a text file)
function IsEditingRenderedHTML()
{
  return IsHTMLEditor() && !IsInHTMLSourceMode();
}

function IsWebComposer()
{
  return document.documentElement.id == "editorWindow";
}

function IsDocumentEditable()
{
  try {
    return GetCurrentEditor().isDocumentEditable;
  } catch (e) {}
  return false;
}

function IsDocumentEmpty()
{
  try {
    return GetCurrentEditor().documentIsEmpty;
  } catch (e) {}
  return false;
}

function IsDocumentModified()
{
  try {
    return GetCurrentEditor().documentModified;
  } catch (e) {}
  return false;
}

function IsHTMLSourceChanged()
{
  // gSourceTextEditor will not be defined if we're just a text editor.
  return gSourceTextEditor ? gSourceTextEditor.documentModified : false;
}

function newCommandParams()
{
  try {
    return Components.classes["@mozilla.org/embedcomp/command-params;1"].createInstance(Components.interfaces.nsICommandParams);
  }
  catch(e) { dump("error thrown in newCommandParams: "+e+"\n"); }
  return null;
}

/************* General editing command utilities ***************/

function GetDocumentTitle()
{
  try {
    return new XPCNativeWrapper(GetCurrentEditor().document, "title").title;
  } catch (e) {}

  return "";
}

function SetDocumentTitle(title)
{

  try {
    GetCurrentEditor().setDocumentTitle(title);

    // Update window title (doesn't work if called from a dialog)
    if ("UpdateWindowTitle" in window)
      window.UpdateWindowTitle();
  } catch (e) {}
}

var gAtomService;
function GetAtomService()
{
  gAtomService = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
}

function EditorGetTextProperty(property, attribute, value, firstHas, anyHas, allHas)
{
  try {
    if (!gAtomService) GetAtomService();
    var propAtom = gAtomService.getAtom(property);

    GetCurrentEditor().getInlineProperty(propAtom, attribute, value,
                                         firstHas, anyHas, allHas);
  }
  catch(e) {}
}

function EditorSetTextProperty(property, attribute, value)
{
  try {
    if (!gAtomService) GetAtomService();
    var propAtom = gAtomService.getAtom(property);

    GetCurrentEditor().setInlineProperty(propAtom, attribute, value);
    if ("gContentWindow" in window)
      window.gContentWindow.focus();
  }
  catch(e) {}
}

function EditorRemoveTextProperty(property, attribute)
{
  try {
    if (!gAtomService) GetAtomService();
    var propAtom = gAtomService.getAtom(property);

    GetCurrentEditor().removeInlineProperty(propAtom, attribute);
    if ("gContentWindow" in window)
      window.gContentWindow.focus();
  }
  catch(e) {}
}

/************* Element enbabling/disabling ***************/

// this function takes an elementID and a flag
// if the element can be found by ID, then it is either enabled (by removing "disabled" attr)
// or disabled (setAttribute) as specified in the "doEnable" parameter
function SetElementEnabledById(elementID, doEnable)
{
  SetElementEnabled(document.getElementById(elementID), doEnable);
}

function SetElementEnabled(element, doEnable)
{
  if ( element )
  {
    if ( doEnable )
      element.removeAttribute("disabled");
    else
      element.setAttribute("disabled", "true");
  }
  else
  {
    dump("Element  not found in SetElementEnabled\n");
  }
}

/************* Services / Prefs ***************/

function GetFileProtocolHandler()
{
  let handler = Services.io.getProtocolHandler("file");
  return handler.QueryInterface(Components.interfaces.nsIFileProtocolHandler);
}

function GetStringPref(name)
{
  try {
    return Services.prefs.getComplexValue(name, Components.interfaces.nsISupportsString).data;
  } catch (e) {}
  return "";
}

function SetStringPref(aPrefName, aPrefValue)
{
  try {
    let str = Components.classes["@mozilla.org/supports-string;1"]
                        .createInstance(Components.interfaces.nsISupportsString);
    str.data = aPrefValue;
    Services.prefs.setComplexValue(aPrefName, Components.interfaces.nsISupportsString, str);
  }
  catch(e) {}
}

// Set initial directory for a filepicker from URLs saved in prefs
function SetFilePickerDirectory(filePicker, fileType)
{
  if (filePicker)
  {
    try {
      // Save current directory so we can reset it in SaveFilePickerDirectory
      gFilePickerDirectory = filePicker.displayDirectory;

      let location = Services.prefs.getComplexValue("editor.lastFileLocation."+fileType,
                                                    Components.interfaces.nsILocalFile);
      if (location)
        filePicker.displayDirectory = location;
    }
    catch(e) {}
  }
}

// Save the directory of the selected file to prefs
function SaveFilePickerDirectory(filePicker, fileType)
{
  if (filePicker && filePicker.file)
  {
    try {
      var fileDir;
      if (filePicker.file.parent)
        fileDir = filePicker.file.parent.QueryInterface(Components.interfaces.nsILocalFile);

        Services.prefs.setComplexValue("editor.lastFileLocation." + fileType,
                                       Components.interfaces.nsILocalFile, fileDir);

        Services.prefs.savePrefFile(null);
    } catch (e) {}
  }

  // Restore the directory used before SetFilePickerDirectory was called;
  // This reduces interference with Browser and other module directory defaults
  if (gFilePickerDirectory)
    filePicker.displayDirectory = gFilePickerDirectory;

  gFilePickerDirectory = null;
}

function GetDefaultBrowserColors()
{
  var colors = { TextColor:0, BackgroundColor:0, LinkColor:0, ActiveLinkColor:0 , VisitedLinkColor:0 };
  var useSysColors = false;
  try { useSysColors = Services.prefs.getBoolPref("browser.display.use_system_colors"); } catch (e) {}

  if (!useSysColors)
  {
    try { colors.TextColor = Services.prefs.getCharPref("browser.display.foreground_color"); } catch (e) {}

    try { colors.BackgroundColor = Services.prefs.getCharPref("browser.display.background_color"); } catch (e) {}
  }
  // Use OS colors for text and background if explicitly asked or pref is not set
  if (!colors.TextColor)
    colors.TextColor = "windowtext";

  if (!colors.BackgroundColor)
    colors.BackgroundColor = "window";

  colors.LinkColor = Services.prefs.getCharPref("browser.anchor_color");
  colors.ActiveLinkColor = Services.prefs.getCharPref("browser.active_color");
  colors.VisitedLinkColor = Services.prefs.getCharPref("browser.visited_color");

  return colors;
}

/************* URL handling ***************/

function TextIsURI(selectedText)
{
  return selectedText && /^http:\/\/|^https:\/\/|^file:\/\/|^ftp:\/\/|^about:|^mailto:|^news:|^snews:|^telnet:|^ldap:|^ldaps:|^gopher:|^finger:|^javascript:/i.test(selectedText);
}

function IsUrlAboutBlank(urlString)
{
  return (urlString == "about:blank");
}

function MakeRelativeUrl(url)
{
  let inputUrl = url.trim();
  if (!inputUrl)
    return inputUrl;

  // Get the filespec relative to current document's location
  // NOTE: Can't do this if file isn't saved yet!
  var docUrl = GetDocumentBaseUrl();
  var docScheme = GetScheme(docUrl);

  // Can't relativize if no doc scheme (page hasn't been saved)
  if (!docScheme)
    return inputUrl;

  var urlScheme = GetScheme(inputUrl);

  // Do nothing if not the same scheme or url is already relativized
  if (docScheme != urlScheme)
    return inputUrl;

  // Host must be the same
  var docHost = GetHost(docUrl);
  var urlHost = GetHost(inputUrl);
  if (docHost != urlHost)
    return inputUrl;


  // Get just the file path part of the urls
  // XXX Should we use GetCurrentEditor().documentCharacterSet for 2nd param ?
  let docPath = Services.io.newURI(docUrl, GetCurrentEditor().documentCharacterSet, null).path;
  let urlPath = Services.io.newURI(inputUrl, GetCurrentEditor().documentCharacterSet, null).path;

  // We only return "urlPath", so we can convert
  //  the entire docPath for case-insensitive comparisons
  var os = GetOS();
  var doCaseInsensitive = (docScheme == "file" && os == gWin);
  if (doCaseInsensitive)
    docPath = docPath.toLowerCase();

  // Get document filename before we start chopping up the docPath
  var docFilename = GetFilename(docPath);

  // Both url and doc paths now begin with "/"
  // Look for shared dirs starting after that
  urlPath = urlPath.slice(1);
  docPath = docPath.slice(1);

  var firstDirTest = true;
  var nextDocSlash = 0;
  var done = false;

  // Remove all matching subdirs common to both doc and input urls
  do {
    nextDocSlash = docPath.indexOf("\/");
    var nextUrlSlash = urlPath.indexOf("\/");

    if (nextUrlSlash == -1)
    {
      // We're done matching and all dirs in url
      // what's left is the filename
      done = true;

      // Remove filename for named anchors in the same file
      if (nextDocSlash == -1 && docFilename)
      {
        var anchorIndex = urlPath.indexOf("#");
        if (anchorIndex > 0)
        {
          var urlFilename = doCaseInsensitive ? urlPath.toLowerCase() : urlPath;

          if (urlFilename.startsWith(docFilename))
            urlPath = urlPath.slice(anchorIndex);
        }
      }
    }
    else if (nextDocSlash >= 0)
    {
      // Test for matching subdir
      var docDir = docPath.slice(0, nextDocSlash);
      var urlDir = urlPath.slice(0, nextUrlSlash);
      if (doCaseInsensitive)
        urlDir = urlDir.toLowerCase();

      if (urlDir == docDir)
      {

        // Remove matching dir+"/" from each path
        //  and continue to next dir
        docPath = docPath.slice(nextDocSlash+1);
        urlPath = urlPath.slice(nextUrlSlash+1);
      }
      else
      {
        // No match, we're done
        done = true;

        // Be sure we are on the same local drive or volume
        //   (the first "dir" in the path) because we can't
        //   relativize to different drives/volumes.
        // UNIX doesn't have volumes, so we must not do this else
        //  the first directory will be misinterpreted as a volume name
        if (firstDirTest && docScheme == "file" && os != gUNIX)
          return inputUrl;
      }
    }
    else  // No more doc dirs left, we're done
      done = true;

    firstDirTest = false;
  }
  while (!done);

  // Add "../" for each dir left in docPath
  while (nextDocSlash > 0)
  {
    urlPath = "../" + urlPath;
    nextDocSlash = docPath.indexOf("\/", nextDocSlash+1);
  }
  return urlPath;
}

function MakeAbsoluteUrl(url)
{
  let resultUrl = TrimString(url);
  if (!resultUrl)
    return resultUrl;

  // Check if URL is already absolute, i.e., it has a scheme
  let urlScheme = GetScheme(resultUrl);

  if (urlScheme)
    return resultUrl;

  let docUrl = GetDocumentBaseUrl();
  let docScheme = GetScheme(docUrl);

  // Can't relativize if no doc scheme (page hasn't been saved)
  if (!docScheme)
    return resultUrl;

  // Make a URI object to use its "resolve" method
  let absoluteUrl = resultUrl;
  let docUri = Services.io.newURI(docUrl, GetCurrentEditor().documentCharacterSet, null);

  try {
    absoluteUrl = docUri.resolve(resultUrl);
    // This is deprecated and buggy!
    // If used, we must make it a path for the parent directory (remove filename)
    //absoluteUrl = IOService.resolveRelativePath(resultUrl, docUrl);
  } catch (e) {}

  return absoluteUrl;
}

// Get the HREF of the page's <base> tag or the document location
// returns empty string if no base href and document hasn't been saved yet
function GetDocumentBaseUrl()
{
  try {
    var docUrl;

    // if document supplies a <base> tag, use that URL instead
    let base = GetCurrentEditor().document.querySelector("base");
    if (base)
      docUrl = base.getAttribute("href");
    if (!docUrl)
      docUrl = GetDocumentUrl();

    if (!IsUrlAboutBlank(docUrl))
      return docUrl;
  } catch (e) {}
  return "";
}

function GetDocumentUrl()
{
  try {
    var aDOMHTMLDoc = GetCurrentEditor().document.QueryInterface(Components.interfaces.nsIDOMHTMLDocument);
    return aDOMHTMLDoc.URL;
  }
  catch (e) {}
  return "";
}

// Extract the scheme (e.g., 'file', 'http') from a URL string
function GetScheme(urlspec)
{
  var resultUrl = TrimString(urlspec);
  // Unsaved document URL has no acceptable scheme yet
  if (!resultUrl || IsUrlAboutBlank(resultUrl))
    return "";

  var scheme = "";
  try {
    // This fails if there's no scheme
    scheme = Services.io.extractScheme(resultUrl);
  } catch (e) {}

  return scheme ? scheme.toLowerCase() : "";
}

function GetHost(urlspec)
{
  if (!urlspec)
    return "";

  var host = "";
  try {
    host = Services.io.newURI(urlspec, null, null).host;
   } catch (e) {}

  return host;
}

function GetUsername(urlspec)
{
  if (!urlspec)
    return "";

  var username = "";
  try {
    username = Services.io.newURI(urlspec, null, null).username;
  } catch (e) {}

  return username;
}

function GetFilename(urlspec)
{
  if (!urlspec || IsUrlAboutBlank(urlspec))
    return "";

  var filename;

  try {
    let uri = Services.io.newURI(urlspec, null, null);
    if (uri)
    {
      let url = uri.QueryInterface(Components.interfaces.nsIURL);
      if (url)
        filename = url.fileName;
    }
  } catch (e) {}

  return filename ? filename : "";
}

// Return the url without username and password
// Optional output objects return extracted username and password strings
// This uses just string routines via nsIIOServices
function StripUsernamePassword(urlspec, usernameObj, passwordObj)
{
  urlspec = TrimString(urlspec);
  if (!urlspec || IsUrlAboutBlank(urlspec))
    return urlspec;

  if (usernameObj)
    usernameObj.value = "";
  if (passwordObj)
    passwordObj.value = "";

  // "@" must exist else we will never detect username or password
  var atIndex = urlspec.indexOf("@");
  if (atIndex > 0)
  {
    try {
      let uri = Services.io.newURI(urlspec, null, null);
      let username = uri.username;
      let password = uri.password;

      if (usernameObj && username)
        usernameObj.value = username;
      if (passwordObj && password)
        passwordObj.value = password;
      if (username)
      {
        let usernameStart = urlspec.indexOf(username);
        if (usernameStart != -1)
          return urlspec.slice(0, usernameStart) + urlspec.slice(atIndex+1);
      }
    } catch (e) {}
  }
  return urlspec;
}

function StripPassword(urlspec, passwordObj)
{
  urlspec = TrimString(urlspec);
  if (!urlspec || IsUrlAboutBlank(urlspec))
    return urlspec;

  if (passwordObj)
    passwordObj.value = "";

  // "@" must exist else we will never detect password
  var atIndex = urlspec.indexOf("@");
  if (atIndex > 0)
  {
    try {
      let password = Services.io.newURI(urlspec, null, null).password;

      if (passwordObj && password)
        passwordObj.value = password;
      if (password)
      {
        // Find last ":" before "@"
        let colon = urlspec.lastIndexOf(":", atIndex);
        if (colon != -1)
        {
          // Include the "@"
          return urlspec.slice(0, colon) + urlspec.slice(atIndex);
        }
      }
    } catch (e) {}
  }
  return urlspec;
}

// Version to use when you have an nsIURI object
function StripUsernamePasswordFromURI(uri)
{
  var urlspec = "";
  if (uri)
  {
    try {
      urlspec = uri.spec;
      var userPass = uri.userPass;
      if (userPass)
      {
        start = urlspec.indexOf(userPass);
        urlspec = urlspec.slice(0, start) + urlspec.slice(start+userPass.length+1);
      }
    } catch (e) {}
  }
  return urlspec;
}

function InsertUsernameIntoUrl(urlspec, username)
{
  if (!urlspec || !username)
    return urlspec;

  try {
    let URI = Services.io.newURI(urlspec, GetCurrentEditor().documentCharacterSet, null);
    URI.username = username;
    return URI.spec;
  } catch (e) {}

  return urlspec;
}

function GetOS()
{
  if (gOS)
    return gOS;

  var platform = navigator.platform.toLowerCase();

  if (platform.contains("win"))
    gOS = gWin;
  else if (platform.contains("mac"))
    gOS = gMac;
  else if (platform.contains("unix") || platform.contains("linux") || platform.contains("sun"))
    gOS = gUNIX;
  else
    gOS = "";
  // Add other tests?

  return gOS;
}

function ConvertRGBColorIntoHEXColor(color)
{
  if ( /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.test(color) ) {
    var r = Number(RegExp.$1).toString(16);
    if (r.length == 1) r = "0"+r;
    var g = Number(RegExp.$2).toString(16);
    if (g.length == 1) g = "0"+g;
    var b = Number(RegExp.$3).toString(16);
    if (b.length == 1) b = "0"+b;
    return "#"+r+g+b;
  }
  else
  {
    return color;
  }
}

/************* CSS ***************/

function GetHTMLOrCSSStyleValue(element, attrName, cssPropertyName)
{
  var value;
  if (Services.prefs.getBoolPref("editor.use_css") && IsHTMLEditor())
    value = element.style.getPropertyValue(cssPropertyName);

  if (!value)
    value = element.getAttribute(attrName);

  if (!value)
    return "";

  return value;
}

/************* Miscellaneous ***************/
// Clone simple JS objects
function Clone(obj)
{
  var clone = {};
  for (var i in obj)
  {
    if (typeof obj[i] == 'object')
      clone[i] = Clone(obj[i]);
    else
      clone[i] = obj[i];
  }
  return clone;
}
