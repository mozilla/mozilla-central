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
 *                 Eric Belhaire <belhaire@ief.u-psud.fr>
 *                 Robin Edrenius <robin.edrenius@gmail.com>
 *                 Joey Minta <jminta@gmail.com>
 *                 Philipp Kewisch <mozilla@kewis.ch>
 *                 Martin Schroeder <mschroeder@mozilla.x-home.org>
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

function CalendarWindow() {
   /** This object only exists to keep too many things from breaking during the
    *   switch to the new views
   **/
   this.currentView = {
       changeNumberOfWeeks: function(menuitem) {
           var mwView = document.getElementById("view-deck").selectedPanel;
           mwView.weeksInView = menuitem.value;
       }
   };
}

CalendarWindow.prototype.pickAndGoToDate = function calWin_pickAndGoToDate() {
  var initialDate = currentView().selectedDay.getInTimezone(floating()).jsDate;
  var callback = function receiveAndGoToDate(pickedDate) {
    currentView().goToDay(jsDateToDateTime(pickedDate));
    getMinimonth().value = pickedDate;
  };
  openDialog("chrome://sunbird/content/calendar-gotodate-dialog.xul",
             "calendar-gotodate-dialog",
             "chrome,modal",
             {callback: callback, date: initialDate});
}

CalendarWindow.prototype.goToDay = function calWin_goToDay(newDate) {
    var view = document.getElementById("view-deck").selectedPanel;
    var cdt = Components.classes["@mozilla.org/calendar/datetime;1"]
                        .createInstance(Components.interfaces.calIDateTime);
    cdt.year = newDate.getFullYear();
    cdt.month = newDate.getMonth();
    cdt.day = newDate.getDate();
    cdt.isDate = true;
    cdt.timezone = view.timezone;
    view.goToDay(cdt);
}

CalendarWindow.prototype.switchToView = function calWin_switchToView(newView) {
    var mwWeeksCommand = document.getElementById("menu-numberofweeks-inview");
    if (newView == "multiweek") {
        mwWeeksCommand.removeAttribute("disabled");
    } else {
        mwWeeksCommand.setAttribute("disabled", true);
    }

    // Call the common view switching code in calendar-views.js
    switchToView(newView);

    var labelAttribute = "label-" + newView + "-view";
    var prevCommand = document.getElementById("calendar-go-menu-previous");
    prevCommand.setAttribute("label", prevCommand.getAttribute(labelAttribute));
    var nextCommand = document.getElementById("calendar-go-menu-next");
    nextCommand.setAttribute("label", nextCommand.getAttribute(labelAttribute));
}
