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
 * The Original Code is the SeaMonkey Find As You Type.
 *
 * The Initial Developer of the Original Code is
 * Neil Rashbrook <neil@parkwaycc.co.uk>
 *
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

const kSpace = " ".charCodeAt(0);
const kSlash = "/".charCodeAt(0);
const kApostrophe = "'".charCodeAt(0);

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

function findTypeController(aTypeAheadFind, aWindow)
{
  this.mTypeAheadFind = aTypeAheadFind;
  this.mWindow = aWindow;
}

findTypeController.prototype = {
  /* nsIController */
  supportsCommand: function(aCommand) {
    return aCommand == "cmd_findTypeText" || aCommand == "cmd_findTypeLinks";
  },

  isCommandEnabled: function(aCommand) {
    // We can always find if there's a primary content window in which to find.
    if (this.mWindow.content)
      return true;

    // We can also find if the focused window is a content window.
    // Note: this gets called during a focus change
    // so the new window might not have focus yet.
    var commandDispatcher = this.mWindow.document.commandDispatcher;
    var e = commandDispatcher.focusedElement;
    var w = e ? e.ownerDocument.defaultView : commandDispatcher.focusedWindow;
    return w.top != this.mWindow;
  },

  doCommand: function(aCommand) {
    this.mTypeAheadFind.startFind(this.mWindow, aCommand != "cmd_findTypeText");
  },

  onEvent: function(aEvent) {
  }
}

function typeAheadFind()
{
}

typeAheadFind.prototype = {
  /* properties required for XPCOMUtils */
  classDescription: "Suite Type Ahead Find",
  classID: Components.ID("{45c8f75b-a299-4178-a461-f63690389055}"),
  contractID: "@mozilla.org/suite/typeaheadfind;1",
  _xpcom_categories: [{
    category: "app-startup",
    service: true
  }],

  /* members */
  mBadKeysSinceMatch: 0,
  mBundle: null,
  mCurrentWindow: null,
  mEventTarget: null,
  mFind: null,
  mFindService: null,
  mFound: null,
  mLinks: false,
  mSearchString: "",
  mSelection: null,
  mTimer: null,
  mXULBrowserWindow: null,

  /* nsISupports */
  QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.nsISupportsWeakReference,
      Components.interfaces.nsIObserver,
      Components.interfaces.nsITimerCallback,
      Components.interfaces.nsIDOMEventListener,
      Components.interfaces.nsISelectionListener]),

  /* nsIObserver */
  observe: function(aSubject, aTopic, aData) {
    if (aTopic == "app-startup") {
      // It's now safe to get our pref branch.
      this.mPrefs = Components.classes["@mozilla.org/preferences-service;1"]
                              .getService(Components.interfaces.nsIPrefService)
                              .getBranch("accessibility.typeaheadfind.");
      // We need to add our event listeners to all windows.
      Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                .getService(Components.interfaces.nsIWindowWatcher)
                .registerNotification(this);
      // We also need to listen for find again commands
      Components.classes["@mozilla.org/observer-service;1"]
                .getService(Components.interfaces.nsIObserverService)
                .addObserver(this, "nsWebBrowserFind_FindAgain", true);
    }
    if (aTopic == "domwindowopened") {
      // Add our listeners. They get automatically removed on window teardown.
      aSubject.controllers.appendController(new findTypeController(this, aSubject));
      aSubject.addEventListener("keypress", this, false);
    }
    if (aTopic == "nsWebBrowserFind_FindAgain" &&
        aSubject instanceof Components.interfaces.nsISupportsInterfacePointer &&
        aSubject.data instanceof Components.interfaces.nsIDOMWindow &&
        aSubject.data.top == this.mCurrentWindow &&
        this.mSearchString) {
      // It's a find again. Was it one that we just searched for?
      var w = aSubject.data;
      var find = w.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                  .getInterface(Components.interfaces.nsIWebNavigation)
                  .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                  .getInterface(Components.interfaces.nsIWebBrowserFind);
      if (find.searchString.toLowerCase() == this.mSearchString) {
        var reverse = aData == "up";
        this.stopFind(false);
        var result = Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND;
        if (!this.mBadKeysSinceMatch)
          result = this.mFind.findAgain(reverse, this.mLinks);
        this.showStatusMatch(result, reverse ? "prevmatch" : "nextmatch");
        // Don't let anyone else try to find again.
        aSubject.data = null;
      }
    }
  },

  /* nsITimerCallback */
  notify: function(aTimer) {
    this.stopFind(false);
  },

  /* nsIDOMEventListener */
  handleEvent: function(aEvent) {
    if (aEvent.type != "keypress") {
      this.stopFind(false);
      return true;
    }

    // We don't care about these keys.
    if (aEvent.altKey || aEvent.ctrlKey || aEvent.metaKey)
      return true;

    // Are we already in a find?
    if (aEvent.eventPhase == Components.interfaces.nsIDOMEvent.CAPTURING_PHASE)
      return this.processKey(aEvent);

    // Check whether we want to start a new find.
    if (aEvent.getPreventDefault())
      return true;

    // We don't want to start a find on a control character.
    // We also don't want to start on a space, since that scrolls the page.
    if (aEvent.keyCode || aEvent.charCode <= kSpace)
      return true;

    // Don't start a find if the focus is an editable element.
    var window = aEvent.currentTarget;
    var element = window.document.commandDispatcher.focusedElement;
    if (element instanceof Components.interfaces.nsIDOMNSHTMLElement &&
        element.contentEditable == "true")
      return true;

    // Don't start a find if the focus is on a form element.
    if (element instanceof Components.interfaces.nsIDOMXULElement ||
        element instanceof Components.interfaces.nsIDOMHTMLEmbedElement ||
        element instanceof Components.interfaces.nsIDOMHTMLObjectElement ||
        element instanceof Components.interfaces.nsIDOMHTMLIsIndexElement ||
        element instanceof Components.interfaces.nsIDOMHTMLSelectElement ||
        element instanceof Components.interfaces.nsIDOMHTMLTextAreaElement)
      return true;

    // Don't start a find if the focus is on a text, password or file field.
    if (element instanceof Components.interfaces.nsIDOMHTMLInputElement &&
        element.type in {text: true, password: true, file: true})
      return true;

    // Don't start a find if the focus isn't or can't be set to content
    var w = window.document.commandDispatcher.focusedWindow;
    if (w.top == window)
      w = window.content;
    if (!w)
      return true;

    var webNav = w.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                  .getInterface(Components.interfaces.nsIWebNavigation);
    try {
      // Don't start a find if the window is in design mode
      if (webNav.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                .getInterface(Components.interfaces.nsIEditingSession)
                .windowIsEditable(w))
        return true;
    } catch (e) {
    }

    switch (aEvent.charCode) {
      // Start finding text as you type
      case kSlash:
        aEvent.preventDefault();
        this.startFind(window, false);
        break;

      // Start finding links as you type
      case kApostrophe:
        aEvent.preventDefault();
        this.startFind(window, true);
        break;

      default:
        // Don't start if typeahead find is disabled
        if (!this.mPrefs.getBoolPref("autostart"))
          return true;
        // Don't start in windows that don't want autostart
        if (webNav.QueryInterface(Components.interfaces.nsIDocShell)
                  .chromeEventHandler.getAttribute("autofind") == "false")
          return true;
        this.startFind(window, this.mPrefs.getBoolPref("linksonly"));
        this.processKey(aEvent);
    }
    return false;
  },

  /* nsISelectionListener */
  notifySelectionChanged: function(aDoc, aSelection, aReason) {
    this.stopFind(false);
  },

  /* private methods */
  showStatus: function(aText) {
    if (this.mXULBrowserWindow)
      this.mXULBrowserWindow.setOverLink(aText, null);
  },
  showStatusString: function(aString) {
    // Set the status text from a localised string
    this.showStatus(aString && this.mBundle.GetStringFromName(aString));
  },
  showStatusMatch: function(aResult, aExtra) {
    // Set the status text from a find result
    // link|text "..." [not] found [next|previous match] [(href)]
    if (aExtra)
      aExtra = " " + this.mBundle.GetStringFromName(aExtra);
    var url = "";
    var string = this.mLinks ? "link" : "text";
    if (aResult == Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND)
      string += "not";
    else if (this.mFind.foundLink && this.mFind.foundLink.href)
      url = "  " + this.mBundle.GetStringFromName("openparen") +
                   this.mFind.foundLink.href +
                   this.mBundle.GetStringFromName("closeparen");
    string += "found";
    this.showStatus(this.mBundle.GetStringFromName(string) +
                    this.mSearchString +
                    this.mBundle.GetStringFromName("closequote") +
                    aExtra + url);
  },
  startTimer: function() {
    if (this.mPrefs.getBoolPref("enabletimeout")) {
      if (!this.mTimer)
        this.mTimer = Components.classes["@mozilla.org/timer;1"]
                                .createInstance(Components.interfaces.nsITimer);
      this.mTimer.initWithCallback(this,
          this.mPrefs.getIntPref("timeout"),
          Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    }
  },
  processKey: function(aEvent) {
    // Escape always cancels the find.
    if (aEvent.keyCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_ESCAPE) {
      aEvent.preventDefault();
      this.stopFind(false);
      return false;
    }

    var result = Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND;
    if (aEvent.keyCode == Components.interfaces.nsIDOMKeyEvent.DOM_VK_BACK_SPACE) {
      aEvent.preventDefault();
      this.mSearchString = this.mSearchString.slice(0, -1);
      // Backspacing past the start of the string cancels the find.
      if (!this.mSearchString) {
        this.stopFind(true);
        return false;
      }
      this.startTimer();
      // The find will change the selection, so stop listening for changes
      this.mEventTarget.removeEventListener("blur", this, true);
      if (this.mSelection)
        this.mSelection.removeSelectionListener(this);
      // Don't bother finding until we get back to a working string
      if (!this.mBadKeysSinceMatch || !--this.mBadKeysSinceMatch)
        result = this.mFind.find(this.mSearchString, this.mLinks);
    } else {
      // Ignore control characters.
      if (aEvent.keyCode || aEvent.charCode < kSpace)
        return true;

      this.startTimer();
      aEvent.preventDefault();

      // It looks as if the cat walked on the keyboard.
      if (this.mBadKeysSinceMatch >= 3)
        return false;

      // The find will change the selection/focus, so stop listening for changes
      this.mEventTarget.removeEventListener("blur", this, true);
      if (this.mSelection)
        this.mSelection.removeSelectionListener(this);
      var previousString = this.mSearchString;
      this.mSearchString += String.fromCharCode(aEvent.charCode).toLowerCase();
      if (!this.mBadKeysSinceMatch) {
        result = this.mFind.find(this.mSearchString, this.mLinks);
        if (previousString &&
            result == Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND)
          // Use a separate find instance to rehighlight the previous match
          // until bug 463294 is fixed.
          this.mFound.find(previousString, this.mLinks);
      }
      if (result == Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND)
        this.mBadKeysSinceMatch++;
    }

    this.showStatusMatch(result, "");
    if (!this.mFindService)
      this.mFindService = Components.classes["@mozilla.org/find/find_service;1"]
                                    .getService(Components.interfaces.nsIFindService);
    this.mFindService.searchString = this.mSearchString;
    // Watch for blur changes in case the cursor leaves the current field.
    this.mEventTarget.addEventListener("blur", this, true);
    // Also watch for the cursor moving within the current field or window.
    var commandDispatcher = this.mEventTarget.ownerDocument.commandDispatcher;
    var editable = commandDispatcher.focusedElement;
    if (editable instanceof Components.interfaces.nsIDOMNSEditableElement)
      this.mSelection = editable.editor.selection;
    else
      this.mSelection = commandDispatcher.focusedWindow.getSelection();
    this.mSelection.QueryInterface(Components.interfaces.nsISelectionPrivate)
                   .addSelectionListener(this);
    return false;
  },
  startFind: function(aWindow, aLinks) {
    if (this.mEventTarget)
      this.stopFind(true);
    // Try to get the status bar for the specified window
    this.mXULBrowserWindow =
        aWindow.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
               .getInterface(Components.interfaces.nsIWebNavigation)
               .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
               .treeOwner
               .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
               .getInterface(Components.interfaces.nsIXULWindow)
               .XULBrowserWindow;

    // If the current window is chrome then focus content instead
    var w = aWindow.document.commandDispatcher.focusedWindow.top;
    if (w == aWindow)
      (w = aWindow.content).focus();

    // Get two toolkit typeaheadfind instances if we don't have them already.
    var docShell = w.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                    .getInterface(Components.interfaces.nsIWebNavigation)
                    .QueryInterface(Components.interfaces.nsIDocShell);
    if (!this.mFind) {
      this.mFind = Components.classes["@mozilla.org/typeaheadfind;1"]
                             .createInstance(Components.interfaces.nsITypeAheadFind);
      this.mFind.init(docShell);
      this.mFound = Components.classes["@mozilla.org/typeaheadfind;1"]
                             .createInstance(Components.interfaces.nsITypeAheadFind);
      this.mFound.init(docShell);
    }

    // Get the string bundle if we don't have it already.
    if (!this.mBundle)
      this.mBundle = Components.classes["@mozilla.org/intl/stringbundle;1"]
                               .getService(Components.interfaces.nsIStringBundleService)
                               .createBundle("chrome://communicator/locale/typeaheadfind.properties");

    // Set up all our properties
    this.mFind.setDocShell(docShell);
    this.mFound.setDocShell(docShell);
    this.mEventTarget = docShell.chromeEventHandler;
    this.mEventTarget.addEventListener("keypress", this, true);
    this.mEventTarget.addEventListener("unload", this, true);
    this.mCurrentWindow = w;
    this.mBadKeysSinceMatch = 0;
    this.mSearchString = "";
    this.mLinks = aLinks;
    this.showStatusString(this.mLinks ? "startlinkfind" : "starttextfind");
    this.startTimer();
  },
  stopFind: function(aClear) {
    if (this.mTimer)
      this.mTimer.cancel();
    if (this.mFind)
      this.mFind.setSelectionModeAndRepaint(
          Components.interfaces.nsISelectionController.SELECTION_ON);
    if (this.mEventTarget) {
      this.mEventTarget.removeEventListener("blur", this, true);
      this.mEventTarget.removeEventListener("unload", this, true);
      this.mEventTarget.removeEventListener("keypress", this, true);
    }
    this.mEventTarget = null;
    if (this.mSelection)
      this.mSelection.removeSelectionListener(this);
    this.mSelection = null;
    this.showStatusString(aClear ? "" : "stopfind");
    if (aClear)
      this.mSearchString = "";
    if (aClear && this.mFind)
      this.mFind.collapseSelection();
  },
};

function NSGetModule() {
  return XPCOMUtils.generateModule([typeAheadFind]);
}
