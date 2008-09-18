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
 * The Original Code is Mozilla Calendar code.
 *
 * The Initial Developer of the Original Code is
 * ArentJan Banck <ajbanck@planet.nl>.
 * Portions created by the Initial Developer are Copyright (C) 2002
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): ArentJan Banck <ajbanck@planet.nl>
 *                 Joey Minta <jminta@gmail.com>
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

/***** calendarClipboard
*
* NOTES 
*   TODO items
*     - Add a clipboard listener, to enable/disable menu-items depending if 
*       valid clipboard data is available.
*
******/


function getClipboard()
{
    const kClipboardContractID = "@mozilla.org/widget/clipboard;1";
    const kClipboardIID = Components.interfaces.nsIClipboard;
    return Components.classes[kClipboardContractID].getService(kClipboardIID);
}

var Transferable = Components.Constructor("@mozilla.org/widget/transferable;1", Components.interfaces.nsITransferable);
var SupportsArray = Components.Constructor("@mozilla.org/supports-array;1", Components.interfaces.nsISupportsArray);
var SupportsCString = (("nsISupportsCString" in Components.interfaces)
                       ? Components.Constructor("@mozilla.org/supports-cstring;1", Components.interfaces.nsISupportsCString)
                       : Components.Constructor("@mozilla.org/supports-string;1", Components.interfaces.nsISupportsString)
                      );
var SupportsString = (("nsISupportsWString" in Components.interfaces)
                      ? Components.Constructor("@mozilla.org/supports-wstring;1", Components.interfaces.nsISupportsWString)
                      : Components.Constructor("@mozilla.org/supports-string;1", Components.interfaces.nsISupportsString)
                     );

/** 
* Test a writable calendar is selecte and
* if the clipboard has items that can be pasted into Calendar.
* This must be of type "text/calendar" or "text/unicode"
*/

function canPaste()
{
    var cal = getSelectedCalendar();
    if (!cal || !isCalendarWritable(cal)) {
        return false;
    }

    const kClipboardIID = Components.interfaces.nsIClipboard;

    var clipboard = getClipboard();
    var flavourArray = new SupportsArray;
    var flavours = ["text/calendar", "text/unicode"];

    if (kClipboardIID.number == "{8b5314ba-db01-11d2-96ce-0060b0fb9956}") { // on branch
        for (var i = 0; i < flavours.length; ++i) {
            var kSuppString = new SupportsCString;
            kSuppString.data = flavours[i];
            flavourArray.AppendElement(kSuppString);
        }
        return clipboard.hasDataMatchingFlavors(flavourArray,
                                                kClipboardIID.kGlobalClipboard);
    } else {
        return clipboard.hasDataMatchingFlavors(flavours, flavours.length,
                                                kClipboardIID.kGlobalClipboard);
    }
}

/** 
* Copy iCalendar data to the Clipboard, and delete the selected events.
* Does not use eventarray parameter, because DeletCcommand delete selected events.
*/

function cutToClipboard( /* calendarEventArray */)
{
    var calendarEventArray = currentView().getSelectedItems({});

    if( copyToClipboard( calendarEventArray ) )
    {
         deleteSelectedEvents();
    }
}


/** 
* Copy iCalendar data to the Clipboard. The data is copied to both 
* text/calendar and text/unicode. 
**/

function copyToClipboard( calendarItemArray )
{  
    if (!calendarItemArray) {
        calendarItemArray = currentView().getSelectedItems({});
    }

    if (!calendarItemArray.length) {
        dump("Tried to cut/copy 0 events");
        return false;
    }

    var calComp = getIcsService().createIcalComponent("VCALENDAR");
    calSetProdidVersion(calComp);

    for each (item in calendarItemArray) {
        // If we copy an item and paste it again, it will have the same ID as
        // the original.  Therefore, give every item a new ID.
        var dummyItem = Components.classes["@mozilla.org/calendar/event;1"]
                                  .createInstance(Components.interfaces.calIEvent);
        var newItem = item.clone();
        newItem.id = dummyItem.id;
        calComp.addSubcomponent(newItem.icalComponent);
    }

    // XXX This might not be enough to be Outlook compatible
    var sTextiCalendar = calComp.serializeToICS();

    // 1. get the clipboard service
    var clipboard = getClipboard();

    // 2. create the transferable
    var trans = new Transferable;

    if ( trans && clipboard) {
        // 3. register the data flavors
        trans.addDataFlavor("text/calendar");
        trans.addDataFlavor("text/unicode");

        // 4. create the data objects
        var icalWrapper = new SupportsString;

        // get the data
        icalWrapper.data = sTextiCalendar;

        // 5. add data objects to transferable
        // Both Outlook 2000 client and Lotus Organizer use text/unicode 
        // when pasting iCalendar data
        trans.setTransferData("text/calendar", icalWrapper,
                              icalWrapper.data.length*2 ); // double byte data
        trans.setTransferData("text/unicode", icalWrapper, 
                              icalWrapper.data.length*2 );

        clipboard.setData(trans, null,
                          Components.interfaces.nsIClipboard.kGlobalClipboard );

        return true;         
    }
    return true;
}


/** 
* Paste iCalendar events from the clipboard, 
* or paste clipboard text into description of new event
*/

function pasteFromClipboard()
{
    if (!canPaste()) {
        return;
    }

    // 1. get the clipboard service
    var clipboard = getClipboard();

    // 2. create the transferable
    var trans = new Transferable;

    if (!trans || !clipboard) {
        dump("Failed to get either a transferable or a clipboard");
        return;
    }
    // 3. register the data flavors you want, highest fidelity first!
    trans.addDataFlavor("text/calendar");
    trans.addDataFlavor("text/unicode");

    // 4. get transferable from clipboard
    clipboard.getData ( trans, Components.interfaces.nsIClipboard.kGlobalClipboard);

    // 5. ask transferable for the best flavor. Need to create new JS
    //    objects for the out params.
    var flavour = { };
    var data = { };
    trans.getAnyTransferData(flavour, data, {});
    data = data.value.QueryInterface(Components.interfaces.nsISupportsString).data;
    var items = new Array();
    switch (flavour.value) {
        case "text/calendar":
        case "text/unicode":
            // Moving this test up before processing
            var destCal = getSelectedCalendar();
            if (!destCal) {
                return;
            }
            var calComp = getIcsService().parseICS(data, null);
            var subComp = calComp.getFirstSubcomponent("ANY");
            while (subComp) {
                switch (subComp.componentType) {
                    case "VEVENT":
                        var event = Components.classes["@mozilla.org/calendar/event;1"]
                                              .createInstance
                                              (Components.interfaces.calIEvent);
                        event.icalComponent = subComp;
                        items.push(event);
                        break;
                    case "VTODO":
                        var todo = Components.classes["@mozilla.org/calendar/todo;1"]
                                             .createInstance
                                             (Components.interfaces.calITodo);
                        todo.icalComponent = subComp;
                        items.push(todo);
                        break;
                    default: break;
                }
                subComp = calComp.getNextSubcomponent("ANY");
            }
            // If there are multiple items on the clipboard, the earliest
            // should be set to the selected day and the rest adjusted.
            var earliestDate = null;
            for each(item in items) {
                var date = null;
                if (item.startDate) 
                    date = item.startDate.clone();
                else if (item.entryDate)
                    date = item.entryDate.clone();
                else if (item.dueDate)
                    date = item.dueDate.clone();

                if (!date)
                    continue;
                if (!earliestDate || date.compare(earliestDate) < 0)
                    earliestDate = date;
            }
            var firstDate = currentView().selectedDay; 

            // Timezones and DT/DST time may differ between the earliest item  
            // and the selected day. Determine the offset between the 
            // earliestDate in local time and the selected day in whole days. 
            earliestDate = earliestDate.getInTimezone(calendarDefaultTimezone());
            earliestDate.isDate = true;
            var offset = firstDate.subtractDate(earliestDate);
            var deltaDST = firstDate.timezoneOffset - earliestDate.timezoneOffset;
            offset.inSeconds += deltaDST;

            startBatchTransaction();
            for each(item in items) {
                var newItem = item.clone();
                if (item.startDate) {
                    newItem.startDate.addDuration(offset);
                    newItem.endDate.addDuration(offset);
                } else {
                    if (item.entryDate) {
                        newItem.entryDate.addDuration(offset);
                    }
                    if (item.dueDate) {
                        newItem.dueDate.addDuration(offset);
                    }
                }
                doTransaction('add', newItem, destCal, null, null);
            }
            endBatchTransaction();
            break;
        default: 
            dump("Unknown clipboard type: " + flavour.value);
    }
}
