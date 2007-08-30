/* -*- Mode: javascript; tab-width: 20; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
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
var gCurrentMode;

/**
 * ltnInitializeMode() is called from messenger-overlay-sidebar.js during
 * handling of the load event. the purpose of this function is to provide
 * a dedicated location for the initialization of the mode toolbar stuff.
 */

function ltnInitializeMode() {
  gCurrentMode = 'mail';

  // per default we check the mail command.
  // we don't need to do anything else since the
  // mail view is also shown by default.
  var command = document.getElementById("switch2mail");
  if (!command) {
    // this stuff isn't invoked from the main
    // application document, so don't do anything...
    return;
  }
  command.setAttribute("checked", "true");
  
  var printbutton = document.getElementById("button-print");
  printbutton.setAttribute("mode", "calendar");
  var deletebutton = document.getElementById("button-delete");
  deletebutton.setAttribute("mode", "calendar");
}

/**
 * this function returns the mode the application is currently in
 */

function ltnCurrentMode() {
  if (!gCurrentMode) {
    ltnInitializeMode();
  }
  return gCurrentMode;
}

/**
 * Helper function to get the view deck in a neutral way, regardless of whether
 * we're in Tunderbird 1.x or 2.x
 */
function getMailBar() {
  return document.getElementById("mail-bar2") ||
         document.getElementById("mail-bar");
}

/**
 * ltnSwitch2Mail() switches to the mail mode
 */

function ltnSwitch2Mail() {
  if (ltnCurrentMode() != 'mail') {

    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    switch2mail.setAttribute("checked", "true");
    switch2calendar.removeAttribute("checked");

    var mailToolbar = getMailBar();
    var calendarToolbar = document.getElementById("calendar-toolbar");
    mailToolbar.removeAttribute("collapsed");
    calendarToolbar.setAttribute("collapsed", "true");

    // the content panel should display the folder tree
    var contentDeck = document.getElementById("contentPanel");
    contentDeck.selectedPanel = document.getElementById("folderPaneBox");
    
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
    
    gCurrentMode = 'mail';
  }
}

/**
 * ltnSwitch2Calendar() switches to the calendar mode
 */

function ltnSwitch2Calendar() {
  if (ltnCurrentMode() != 'calendar') {

    var switch2mail = document.getElementById("switch2mail");
    var switch2calendar = document.getElementById("switch2calendar");
    switch2calendar.setAttribute("checked", "true");
    switch2mail.removeAttribute("checked");

    var mailToolbar = getMailBar();
    var calendarToolbar = document.getElementById("calendar-toolbar");
    mailToolbar.setAttribute("collapsed", "true");
    calendarToolbar.removeAttribute("collapsed");

    // the content deck should display the calendar panel
    var contentDeck = document.getElementById("contentPanel");
    contentDeck.selectedPanel = document.getElementById("ltnSidebar");

    // display the calendar panel on the display deck
    var deck = document.getElementById("displayDeck");
    deck.selectedPanel = document.getElementById("calendar-view-box");

    // show the last displayed type of calendar view
    if(gLastShownCalendarView == null)
      gLastShownCalendarView = 'week';
    showCalendarView(gLastShownCalendarView);

    document.commandDispatcher.updateCommands('mail-toolbar');
    document.commandDispatcher.updateCommands('calendar_commands');
    
    gCurrentMode = 'calendar';
  }
}

/**
 * ltnSwitch2Task() switches to the task mode
 */

function ltnSwitch2Task() {
  if (ltnCurrentMode() != 'task') {

    document.commandDispatcher.updateCommands('mail-toolbar');
    document.commandDispatcher.updateCommands('calendar_commands');
  
    gCurrentMode = 'task';
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
  var modeName = isModeToolbox ? 'mode' : ltnCurrentMode();

  // retrieve the toolbars from the tree
  var mailbar = getMailBar();
  var menubar = document.getElementById('mail-menubar');
  var calendarbar = document.getElementById('calendar-toolbar');
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
    }

    // enable/disable all toolbar to reflect the new state
    var isMode = (aMode == 'mode');
    EnableDisableHierarchy(modebar, !isMode);
    EnableDisableHierarchy(menubar, isMode);
    EnableDisableHierarchy(mailbar, isMode);
    EnableDisableHierarchy(calendarbar, isMode);
    
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
