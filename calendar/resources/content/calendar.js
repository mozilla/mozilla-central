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

/***** calendar
* AUTHOR
*   Garth Smedley
*
* NOTES
*   Code for the calendar.
*
*   What is in this file:
*     - Global variables and functions - Called directly from the XUL
*     - Several classes:
*  
* IMPLEMENTATION NOTES 
*
**********
*/

// single global instance of CalendarWindow
var gCalendarWindow;

// store the current selection in the global scope to workaround bug 351747
var gXXXEvilHackSavedSelection;

/*-----------------------------------------------------------------
 *  G L O B A L     C A L E N D A R      F U N C T I O N S
 */

/** 
 * Called from calendar.xul window onload.
 */
function calendarInit() {
    // set up the CalendarWindow instance
    gCalendarWindow = new CalendarWindow();

    // set up the views
    initializeViews();
    currentView().goToDay(currentView().selectedDay);

    // set up the unifinder
    prepareCalendarUnifinder();
    prepareCalendarToDoUnifinder();
   
    scheduleMidnightUpdate(refreshUIBits);

    loadCalendarManager();

    // fire up the alarm service
    var alarmSvc = Components.classes["@mozilla.org/calendar/alarm-service;1"]
                   .getService(Components.interfaces.calIAlarmService);
    alarmSvc.timezone = calendarDefaultTimezone();
    alarmSvc.startup();

    // a bit of a hack since the menulist doesn't remember the selected value
    var value = document.getElementById('event-filter-menulist').value;
    document.getElementById('event-filter-menulist').selectedItem =
     document.getElementById('event-filter-' + value);

    var toolbox = document.getElementById("calendar-toolbox");
    toolbox.customizeDone = CalendarToolboxCustomizeDone;

    getViewDeck().addEventListener("dayselect", observeViewDaySelect, false);
    getViewDeck().addEventListener("itemselect", onSelectionChanged, true);

    // Setup undo/redo menu for additional main windows
    updateUndoRedoMenu();

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

    //Look for arguments without a flag.
    //This is needed to handle double-click on Windows and Linux.
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
        getCalendarManager().registerCalendar(cal);

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
    }
}

/* Called at midnight to tell us to update the views and other ui bits */
function refreshUIBits() {
    currentView().goToDay(now());
    refreshEventTree();

    // and schedule again...
    scheduleMidnightUpdate(refreshUIBits);
}

/** 
* Called from calendar.xul window onunload.
*/

function calendarFinish()
{
   // Workaround to make the selected tab persist. See bug 249552.
   var tabbox = document.getElementById("tablist");
   tabbox.setAttribute("selectedIndex", tabbox.selectedIndex);

   finishCalendarUnifinder();
   
   finishCalendarToDoUnifinder();

   unloadCalendarManager();
}

function selectAllEvents()
{
    var items = [];
    var listener = {
        onOperationComplete: function selectAll_ooc(aCalendar, aStatus, 
                                                    aOperationType, aId, 
                                                    aDetail) {
            currentView().setSelectedItems(items.length, items, false);
        },
        onGetResult: function selectAll_ogr(aCalendar, aStatus, aItemType, 
                                            aDetail, aCount, aItems) {
            for each (var item in aItems) {
                items.push(item);
            }
        }
    };

    var composite = getCompositeCalendar();
    var filter = composite.ITEM_FILTER_COMPLETED_ALL |
                 composite.ITEM_FILTER_CLASS_OCCURRENCES;

    if (currentView().tasksInView) {
        filter |= composite.ITEM_FILTER_TYPE_ALL; 
    } else {
        filter |= composite.ITEM_FILTER_TYPE_EVENT;
    }

    // Need to move one day out to get all events
    var end = currentView().endDay.clone();
    end.day += 1;

    composite.getItems(filter, 0, currentView().startDay, end, listener);
}

function closeCalendar()
{
   self.close();
}

function onSelectionChanged(aEvent) {
    var elements = 
        document.getElementsByAttribute("disabledwhennoeventsselected", "true");

    var selectedItems = aEvent.detail;
    gXXXEvilHackSavedSelection = selectedItems;

    for (var i = 0; i < elements.length; i++) {
        if (selectedItems.length >= 1) {
            elements[i].removeAttribute("disabled");
        } else {
            elements[i].setAttribute("disabled", "true");
        }
    }
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

function CalendarCustomizeToolbar()
{
  // Disable the toolbar context menu items
  var menubar = document.getElementById("main-menubar");
  for (var i = 0; i < menubar.childNodes.length; ++i)
    menubar.childNodes[i].setAttribute("disabled", true);
    
  var cmd = document.getElementById("cmd_CustomizeToolbars");
  cmd.setAttribute("disabled", "true");

#ifdef MOZILLA_1_8_BRANCH
  window.openDialog("chrome://calendar/content/customizeToolbar.xul", "CustomizeToolbar",
                    "chrome,all,dependent", document.getElementById("calendar-toolbox"));
#else
  window.openDialog("chrome://global/content/customizeToolbar.xul", "CustomizeToolbar",
                    "chrome,all,dependent", document.getElementById("calendar-toolbox"));
#endif
}

function CalendarToolboxCustomizeDone(aToolboxChanged)
{
  // Re-enable parts of the UI we disabled during the dialog
  var menubar = document.getElementById("main-menubar");
  for (var i = 0; i < menubar.childNodes.length; ++i)
    menubar.childNodes[i].setAttribute("disabled", false);
  var cmd = document.getElementById("cmd_CustomizeToolbars");
  cmd.removeAttribute("disabled");

  // XXX Shouldn't have to do this, but I do
  window.focus();
}

function updateUndoRedoMenu() {
    // We need to make sure the menu is updated on all main windows
    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                       .getService(Components.interfaces.nsIWindowMediator);
    var enumerator = wm.getEnumerator('calendarMainWindow');
    while (enumerator.hasMoreElements()) {
        var doc = enumerator.getNext().document;

        if (getTransactionMgr().canUndo())
            doc.getElementById('undo_command').removeAttribute('disabled');
        else
            doc.getElementById('undo_command').setAttribute('disabled', true);

        if (getTransactionMgr().canRedo())
            doc.getElementById('redo_command').removeAttribute('disabled');
        else
            doc.getElementById('redo_command').setAttribute('disabled', true);
    }
}

function openLocalCalendar() {

    const nsIFilePicker = Components.interfaces.nsIFilePicker;
    var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    fp.init(window, gCalendarBundle.getString("Open"), nsIFilePicker.modeOpen);
    var wildmat = "*.ics";
    var description = gCalendarBundle.getFormattedString("filterIcs", [wildmat]);
    fp.appendFilter(description, wildmat);
    fp.appendFilters(nsIFilePicker.filterAll);
 
    if (fp.show() != nsIFilePicker.returnOK) {
        return;
    }	
    
    var url = fp.fileURL.spec;
    var calMgr = getCalendarManager();
    var composite = getCompositeCalendar();
    var openCalendar = calMgr.createCalendar("ics", makeURL(url));
    calMgr.registerCalendar(openCalendar);
     
    // Strip ".ics" from filename for use as calendar name, taken from calendarCreation.js
    var fullPathRegex = new RegExp("([^/:]+)[.]ics$");
    var prettyName = url.match(fullPathRegex);
    var name;
        
    if (prettyName && prettyName.length >= 1) {
        name = decodeURIComponent(prettyName[1]);
    } else {
        name = gCalendarBundle.getString("untitledCalendarName");
    }
        
    openCalendar.name = name;
}
