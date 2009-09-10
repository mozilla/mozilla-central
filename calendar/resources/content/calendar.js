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
 * The Original Code is OEone Calendar Code, released October 31st, 2001.
 *
 * The Initial Developer of the Original Code is
 * OEone Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Garth Smedley <garths@oeone.com>
 *                 Mike Potter <mikep@oeone.com>
 *                 Colin Phillips <colinp@oeone.com>
 *                 Karl Guertin <grayrest@grayrest.com>
 *                 Mike Norton <xor@ivwnet.com>
 *                 ArentJan Banck <ajbanck@planet.nl>
 *                 Eric Belhaire <belhaire@ief.u-psud.fr>
 *                 Matthew Willis <lilmatt@mozilla.com>
 *                 Joey Minta <jminta@gmail.com>
 *                 Dan Mosedale <dan.mosedale@oracle.com>
 *                 Philipp Kewisch <mozilla@kewis.ch>
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
 * Called from calendar.xul window onload.
 */
function calendarInit() {
    // Take care of common initialization
    commonInitCalendar();

    var toolbox = document.getElementById("calendar-toolbox");
    toolbox.customizeDone = CalendarToolboxCustomizeDone;

    // Setup the offline manager
    calendarOfflineManager.init();

    // Handle commandline args
    for (var i = 0; i < window.arguments.length; i++) {
        try {
            var cl = window.arguments[i].QueryInterface(Components.interfaces.nsICommandLine);
        } catch (ex) {
            dump("unknown argument passed to main window\n");
            continue;
        }
        handleCommandLine(cl);
    }
}

function handleCommandLine(aComLine) {
    var comLine = aComLine;
    var calurl = [];

    var validFlags = ["showdate", "subscribe", "url"];
    var flagsToProcess = [];

    for each (var flag in validFlags) {
        if (comLine.findFlag(flag, false) >= 0) {
            flagsToProcess.push(flag);
        }
    }

    for each (var flag in flagsToProcess) {
        var param = comLine.handleFlagWithParam(flag, false);

        switch (flag) {
            case "showdate":
                currentView().goToDay(jsDateToDateTime(new Date(param)));
                break;
            case "subscribe":
            case "url":
                // Double-clicking an .ics file on the Mac causes
                // LaunchServices to launch Sunbird with the -url command line
                // switch like so:
                // sunbird-bin -url file://localhost/Users/foo/mycal.ics -foreground
                calurl.push(param);
                break;
           default:
                // no-op
                break;
        }
    }

    // Look for arguments without a flag.
    // This is needed to handle double-click on Windows and Linux.
    if (comLine.length >= 1) {
        for (var i = 0; i < comLine.length; i++) {
            if (!comLine.getArgument(i).match(/^-/) &&
                !comLine.getArgument(i).match(/^\s/)) {
                calurl.push( comLine.getArgument(i) );
            } else {
                comLine.removeArguments(i, i);
            }
        }
    }

    //subscribe to all files in the calurl array
    for (var i = 0; i < calurl.length; i++) {
        var uri = comLine.resolveURI(calurl[i]);
        var cal = getCalendarManager().createCalendar("ics", uri);

        // Strip ".ics" from filename for use as calendar name
        var fullPathRegEx = new RegExp("([^/:]+)[.]ics$");
        var path = uri.path;
        var prettyName = path.match(fullPathRegEx);

        var name;
        if (prettyName && prettyName.length >= 1) {
            name = decodeURIComponent(prettyName[1]);
        } else {
            name = calGetString("calendar", "untitledCalendarName");
        }
        cal.name = name;

        getCalendarManager().registerCalendar(cal);
    }
}

/* Called at midnight to tell us to update the views and other ui bits */
function refreshUIBits() {
    try {
        currentView().goToDay(now());
        refreshEventTree();
    } catch (exc) {
        ASSERT(false, exc);
    }

    // and schedule again...
    scheduleMidnightUpdate(refreshUIBits);
}

/**
 * Steps to be taken when the sunbird calendar window is unloaded.
 */
function calendarFinish() {
    // Workaround to make the selected tab persist. See bug 249552.
    var tabbox = document.getElementById("tablist");
    tabbox.setAttribute("selectedIndex", tabbox.selectedIndex);

    // Finish the offline manager
    calendarOfflineManager.uninit();

    // Common finish steps
    commonFinishCalendar();
}

function closeCalendar() {
    self.close();
}

function openPreferences() {
    // Check to see if the prefwindow is already open
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);

    var win = wm.getMostRecentWindow("Calendar:Preferences");

    if (win) {
        win.focus();
    } else {
        // The prefwindow should only be modal on non-instant-apply platforms
        var instApply = getPrefSafe("browser.preferences.instantApply", false);

        var features = "chrome,titlebar,toolbar,centerscreen," +
                       (instApply ? "dialog=no" : "modal");

        var url = "chrome://calendar/content/preferences/preferences.xul";

        openDialog(url, "Preferences", features);
    }
}

function CalendarCustomizeToolbar() {
  // Disable the toolbar context menu items
  var menubar = document.getElementById("main-menubar");
  for (var i = 0; i < menubar.childNodes.length; ++i) {
    menubar.childNodes[i].setAttribute("disabled", true);
  }

  var cmd = document.getElementById("cmd_CustomizeToolbars");
  cmd.setAttribute("disabled", "true");

  window.openDialog("chrome://global/content/customizeToolbar.xul", "CustomizeToolbar",
                    "chrome,all,dependent", document.getElementById("calendar-toolbox"));
}

function CalendarToolboxCustomizeDone(aToolboxChanged) {
  // Re-enable parts of the UI we disabled during the dialog
  var menubar = document.getElementById("main-menubar");
  for (var i = 0; i < menubar.childNodes.length; ++i) {
    menubar.childNodes[i].setAttribute("disabled", false);
  }
  var cmd = document.getElementById("cmd_CustomizeToolbars");
  cmd.removeAttribute("disabled");

  // XXX Shouldn't have to do this, but I do
  window.focus();
}

function changeNumberOfWeeks(menuitem) {
  currentView().weeksInView = menuitem.value;
}

function pickAndGoToDate() {
  var initialDate = currentView().selectedDay.getInTimezone(floating()).jsDate;
  var callback = function receiveAndGoToDate(pickedDate) {
    currentView().goToDay(jsDateToDateTime(pickedDate));
    getMinimonth().value = pickedDate;
  };
  openDialog("chrome://sunbird/content/calendar-gotodate-dialog.xul",
             "CalendarGoToDateDialog",
             "chrome,modal",
             {callback: callback, date: initialDate});
}

function sbSwitchToView(newView) {
  var mwWeeksCommand = document.getElementById("menu-numberofweeks-inview");
  if (newView == "multiweek") {
      mwWeeksCommand.removeAttribute("disabled");
  } else {
      mwWeeksCommand.setAttribute("disabled", true);
  }

  // Call the common view switching code in calendar-views.js
  switchToView(newView);
}
