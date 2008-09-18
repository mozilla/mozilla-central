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
 * The Original Code is Sun Microsystems code.
 *
 * The Initial Developer of the Original Code is Sun Microsystems.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Michael Buettner <michael.buettner@sun.com>
 *   Philipp Kewisch <mozilla@kewis.ch>
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

/**
 * Global variables
 */
var gCustomizeId;

/**
 * the current mode is set to a string defining the current
 * mode we're in. allowed values are:
 *  - 'mode'
 *  - 'mail'
 *  - 'calendar'
 *  - 'task'
 */
var gCurrentMode = 'mail';

/**
 * Helper function to get the view deck in a neutral way, regardless of whether
 * we're in Thunderbird or SeaMonkey
 */
function getMailBar() {
  return document.getElementById("mail-bar2") ||
         document.getElementById("msgToolbar");
}

/**
 * Ensure that switching to the messenger window also switches to mail mode.
 * We probably should also catch this from other windows (compose, addressbook),
 * but for now we'll keep it here. This function overrides the toMessengerWindow
 * function in /mail/base/content/mailCore.js.
 */
var toMessengerWindow = function ltnToMessengerWindow() {
    var wm = Components.classes['@mozilla.org/appshell/window-mediator;1']
             .getService(Components.interfaces.nsIWindowMediator);

    var topWindow = wm.getMostRecentWindow("mail:3pane");

    if (topWindow) {
        var tomail = topWindow.document.getElementById("switch2mail");
        tomail.doCommand();
        topWindow.focus();
    } else {
        window.open("chrome://messenger/content/messenger.xul",
                    "_blank",
                    "chrome,extrachrome,menubar,resizable,scrollbars,status,toolbar");
    }
};

/**
 * ltnSwitch2Mail() switches to the mail mode
 */

function ltnSwitch2Mail() {
  if (gCurrentMode != 'mail') {

    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.setAttribute("checked", "true");
    switch2calendar.removeAttribute("checked");
    switch2task.removeAttribute("checked");

    gCurrentMode = 'mail';
    swapPopupMenus();
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);

    var mailToolbarMenuItem = document.getElementById("menu_showMessengerToolbar");
    if (mailToolbarMenuItem) {
        if (mailToolbarMenuItem.getAttribute("checked") == "true") {
            getMailBar().removeAttribute("collapsed");
        }
    } else {
        // Bug 440700: Corresponding toolbar menu entry is currently not
        // accessible in Thunderbird Trunk -> always restore the toolbar
        getMailBar().removeAttribute("collapsed");
    }

    var calendarToolbar = document.getElementById("calendar-toolbar");
    calendarToolbar.setAttribute("collapsed", "true");

    var calendarToolbar = document.getElementById("task-toolbar");
    calendarToolbar.setAttribute("collapsed", "true");

    // the content panel should display the folder tree
    var contentDeck = document.getElementById("contentPanel");
    contentDeck.selectedPanel = document.getElementById("folderPaneBox");

    // display the mail panel on the display deck
    var viewBox = document.getElementById("calendar-view-box");
    collapseElement(viewBox);

    // tell thunderbird that it needs to refresh the mail list.
    // basically, we fake a selection change by directly calling
    // the appropriate handler while clearing out some internal
    // variables in order to force a refresh of the mail views.
    gMsgFolderSelected = null;
    msgWindow.openFolder = null;
    ShowThreadPane();
    FolderPaneSelectionChange();

    document.commandDispatcher.updateCommands('mail-toolbar');
    document.commandDispatcher.updateCommands('calendar_commands');

    // Disable the rotate view menuitem
    document.getElementById("calendar_toggle_orientation_command")
            .setAttribute("disabled", "true");
    window.setCursor("auto");
  }
}

/**
 * ltnSwitch2Calendar() switches to the calendar mode
 */

function ltnSwitch2Calendar() {
  if (gCurrentMode != 'calendar') {

    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.removeAttribute("checked");
    switch2calendar.setAttribute("checked", "true");
    switch2task.removeAttribute("checked");

    gCurrentMode = 'calendar';    
    swapPopupMenus();
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);    

    var mailToolbar = getMailBar();
    mailToolbar.setAttribute("collapsed", "true");

    toggleControlDisplay("cmd_toggleCalendarToolbar", "calendar-toolbar", "calendar");
    toggleControlDisplay("cmd_toggleTaskToolbar", "task-toolbar", "task");
    var taskToolbar = document.getElementById("task-toolbar");
    taskToolbar.setAttribute("collapsed", "true");


    // the content deck should display the calendar panel
    var contentDeck = document.getElementById("contentPanel");
    contentDeck.selectedPanel = document.getElementById("ltnSidebar");

    // display the calendar panel on the display deck
    var viewBox = document.getElementById("calendar-view-box");
    uncollapseElement(viewBox);
    var deck = document.getElementById("displayDeck");
    deck.selectedPanel = viewBox;

    // show the last displayed type of calendar view
    showCalendarView(gLastShownCalendarView);

    document.commandDispatcher.updateCommands('mail-toolbar');
    document.commandDispatcher.updateCommands('calendar_commands');

    window.setCursor("auto");
  }
}

/**
 * ltnSwitch2Task() switches to the task mode
 */

function ltnSwitch2Task() {
  if (gCurrentMode != 'task') {

    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    var switch2task = document.getElementById("switch2task");
    switch2mail.removeAttribute("checked");
    switch2calendar.removeAttribute("checked");
    switch2task.setAttribute("checked", "true");
    toggleControlDisplay("cmd_toggleCalendarToolbar", "calendar-toolbar", "calendar");
    toggleControlDisplay("cmd_toggleTaskToolbar", "task-toolbar", "task");
    gCurrentMode = 'task';
    swapPopupMenus();
    document.getElementById("modeBroadcaster").setAttribute("mode", gCurrentMode);    
    var mailToolbar = getMailBar();
    var calendarToolbar = document.getElementById("calendar-toolbar");
    mailToolbar.setAttribute("collapsed", "true");
    calendarToolbar.setAttribute("collapsed", "true");

    // the content deck should display the calendar panel
    var contentDeck = document.getElementById("contentPanel");
    contentDeck.selectedPanel = document.getElementById("ltnSidebar");

    // display the task panel on the display deck
    var taskBox = document.getElementById("calendar-task-box");
    uncollapseElement(taskBox);
    var deck = document.getElementById("displayDeck");
    deck.selectedPanel = taskBox;

    // change title to "Tasks"
    document.title = ltnGetString("lightning", "taskModeApplicationTitle") + " - " + 
                     calGetString("brand", "brandShortName", null, "branding");

    document.commandDispatcher.updateCommands('mail-toolbar');
    document.commandDispatcher.updateCommands('calendar_commands');

    window.setCursor("auto");
  }
}

/**
 * CustomizeApplicationToolbar() is called to customize one of the toolbars.
 * the appropriate identifier is passed as argument to the function.
 */

// this shadows CustomizeMailToolbar from mail/base/content/mailCore.js
// but adds the specific bits and pieces for lightning.
function CustomizeApplicationToolbar(id) {
  // the following code operates different whether
  // or not we're actually customizing the mode toolbar or
  // any other toolbar.
  gCustomizeId = id;
  var isModeToolbox = (id == 'mode-toolbox');
  var modeName = isModeToolbox ? 'mode' : gCurrentMode;

  // retrieve the toolbars from the tree
  var mailbar = getMailBar();
  var menubar = document.getElementById('mail-menubar');
  var calendarbar = document.getElementById('calendar-toolbar');
  var taskbar = document.getElementById('task-toolbar');
  var mailbox = document.getElementById("mail-toolbox");
  var modebar = document.getElementById('mode-toolbar');
  var modebox = document.getElementById('mode-toolbox');

  // install the callback that handles what needs to be
  // done after a toolbar has been customized.
  if (modebox) {
    mailbox.customizeDone = ModeToolboxCustomizeDone;
    modebox.customizeDone = ModeToolboxCustomizeDone;

    // disable elements on the toolbars
    if (isModeToolbox) {
      EnableDisableHierarchy(menubar, true);
      EnableDisableHierarchy(mailbar, true);
      EnableDisableHierarchy(calendarbar, true);
      EnableDisableHierarchy(taskbar, true);
    } else {
      EnableDisableHierarchy(modebar, true);
    }
  } else {
    modeName = null;
  }

  var customizePopup = document.getElementById("CustomizeMailToolbar");
  customizePopup.setAttribute("disabled", "true");

  var wintype = document.documentElement.getAttribute("windowtype");
  wintype = wintype.replace(/:/g, "");

  // lightning install a new dropdown list in the customize dialog
  // which allows to switch to all available toolbars while still
  // being in the dialog. in case a new entry has been selected this
  // function will be called. the argument will "mode", "mail",
  // "calendar" or "task".
  var onModeSwitch = function switchHandler(aMode) {

    // assume that we're switching to the mode toolbar
    var toolbox = 'mode-toolbox';

    // check which toolbar is to be customized next
    // and possibly switch the the appropriate mode.
    if(aMode == 'mail') {
      ltnSwitch2Mail();
      toolbox = 'mail-toolbox';
    } else if(aMode == 'calendar') {
      ltnSwitch2Calendar();
      toolbox = 'mail-toolbox';
    } else if(aMode == 'task') {
      ltnSwitch2Task();
      toolbox = 'mail-toolbox';
    }

    // enable/disable all toolbar to reflect the new state
    var isMode = (aMode == 'mode');
    EnableDisableHierarchy(modebar, !isMode);
    EnableDisableHierarchy(menubar, isMode);
    EnableDisableHierarchy(mailbar, isMode);
    EnableDisableHierarchy(calendarbar, isMode);
    EnableDisableHierarchy(taskbar, isMode);

    // remember the current toolbox
    gCustomizeId = toolbox;

    // return this appropriate toolbox element
    return document.getElementById(toolbox);
  };

  // open the customize toolbar dialog now...
  window.openDialog("chrome://global/content/customizeToolbar.xul",
                    "CustomizeToolbar"+wintype,
                    "chrome,all,dependent",
                      document.getElementById(id),  // toolbar dom node
                      isModeToolbox,                // is mode toolbar yes/no?
                      onModeSwitch,                 // callback function
                      modeName);                    // name of this mode
}

/**
 * ModeToolboxCustomizeDone() is called after the customize toolbar dialog
 * has been closed by the user. We need to restore the state of all buttons
 * and commands of all customizable toolbars.
 */

function ModeToolboxCustomizeDone(aToolboxChanged) {
  // the following code operates different whether
  // or not we're actually customizing the mode toolbar or
  // any other toolbar.
  var isModeToolbox = (gCustomizeId == 'mode-toolbox');

  // enable elements on the toolbars
  if (isModeToolbox) {
    EnableDisableHierarchy(document.getElementById('mail-menubar'), false);
    EnableDisableHierarchy(getMailBar(), false);
    EnableDisableHierarchy(document.getElementById('calendar-toolbar'), false);
    EnableDisableHierarchy(document.getElementById('task-toolbar'), false);
  }

  // Unconditionally enable the mode toolbar
  EnableHierarchy(document.getElementById('mode-toolbar'));

  // Update global UI elements that may have been added or removed
  MailToolboxCustomizeDone(aToolboxChanged);

  // make sure our toolbar buttons have the correct enabled state restored to them...
  document.commandDispatcher.updateCommands('calendar_commands');
}

/**
 * EnableDisableHierarchy() recursively walks the dom tree and enables or disables
 * all elements it encounters. this function is used by ModeToolboxCustomizeDone()
 * and CustomizeApplicationToolbar().
 */

// step along the hierarchy where the top-node is to be passed
// as argument and enable/disable all nodes depending on the given flag.
function EnableDisableHierarchy(item, disable) {
  // iterate all nodes on this particular level
  for (var i = 0; i < item.childNodes.length; ++i) {

    // retrieve the next node that needs to be processed
    var child = item.childNodes[i];

    // disable this node if flag indicates this case, enable otherwise
    if (disable) {

      // in case this node has already been disabled, we remember
      // this fact in the 'itemdisabled' attribute in order
      // to restore the original state at the end of the operation.
      if (child.getAttribute("disabled") == "true") {
        child.setAttribute("itemdisabled", "true");
      }
      child.setAttribute("disabled","true");

    } else {

      // restore the previous state, which means either enable
      // the node or keep it disabled but remove the
      // 'itemdisabled' attribute.
      if(child.hasAttribute("itemdisabled")) {
        child.removeAttribute("itemdisabled");
      } else {
        child.removeAttribute("disabled");
      }
    }

    // recursively step down the hierarchy if this node
    // exposes any further child nodes.
    if (child.childNodes.length > 0) {
      EnableDisableHierarchy(child, disable);
    }
  }
}

/**
 * EnableHierarchy() recursively walks the dom tree and enables
 * all elements it encounters. this function is used by ModeToolboxCustomizeDone().
 */

// step along the hierarchy where the top-node is to be passed
// as argument and enable all nodes unconditionally.
function EnableHierarchy(item) {
  // iterate all nodes on this particular level
  for (var i = 0; i < item.childNodes.length; ++i) {

    // retrieve the next node that needs to be processed
    var child = item.childNodes[i];

    // always enable this node and remove the
    // 'itemdisabled' attribute.
    if (child.hasAttribute("itemdisabled")) {
      child.removeAttribute("itemdisabled");
    }
    child.removeAttribute("disabled");

    // recursively step down the hierarchy if this node
    // exposes any further child nodes.
    if (child.childNodes.length > 0) {
      EnableHierarchy(child);
    }
  }
}
