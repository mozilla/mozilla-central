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
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Berend Cornelius <berend.cornelius@sun.com>
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


 var gCalendarStatusFeedback = {
     mCalendarValue: 0,
     mCalendarStep: 0,
     mCalendarCount: 0,
     mWindow: null,
     mStatusText: null,
     mStatusBar: null,
     mStatusProgressPanel: null,
     mThrobber: null,
     mProgressMode: Components.interfaces.calIStatusObserver.NO_PROGRESS,
     mCurIndex: 0,
     mInitialized: false,
     mProps: null,
     mCalendars: {},

    QueryInterface: function cStObs_QueryInterface(aIID) {
        return doQueryInterface(this, null, aIID, [Components.interfaces.calIStatusObserver])
    },

     initialize: function cStObs_initialize(aWindow) {
        if (this.mInitialized == false) {
            this.mWindow = aWindow;
            this.mStatusText = this.mWindow.document.getElementById("statusText");
            this.mStatusBar = this.mWindow.document.getElementById("statusbar-icon");
            this.mStatusProgressPanel = this.mWindow.document.getElementById("statusbar-progresspanel");
            this.mThrobber = this.mWindow.document.getElementById("navigator-throbber");
            var sbs = Components.classes["@mozilla.org/intl/stringbundle;1"]
                            .getService(Components.interfaces.nsIStringBundleService);
            this.mProps = sbs.createBundle("chrome://calendar/locale/calendar.properties");
            this. mInitialized = true;
        }
     },

     showStatusString: function cStObs_showStatusString(status){
         this.mStatusText.setAttribute("label", status);
     },

     get spinning cStObs_spinning() {
         return this.mProgressMode;
     },

     startMeteors: function cStObs_startMeteors(aProgressMode, aCalendarCount) {
         if (aProgressMode != Components.interfaces.calIStatusObserver.NO_PROGRESS) {
             if (!this.mInitialized) {
                Components.utils.reportError("StatusObserver has not been initialized!");
                return;
             }
             this.mCalendars = {};
             this.mCurIndex = 0;
             if (aCalendarCount) {
                 this.mCalendarCount = this.mCalendarCount + aCalendarCount;
                 this.mCalendarStep = parseInt(100 / this.mCalendarCount);
             }
             this.mProgressMode = aProgressMode;
             this.mStatusProgressPanel.removeAttribute("collapsed");
             if (this.mProgressMode == Components.interfaces.calIStatusObserver.DETERMINED_PROGRESS) {
                 this.mStatusBar.removeAttribute("collapsed");
                 this.mStatusBar.setAttribute("mode", "determined");
                 this.mStatusBar.value = 0;
                 var commonStatus = calGetString("calendar","gettingCalendarInfoCommon");
                 this.showStatusString(commonStatus);
             }
             if (this.mThrobber) {
                 this.mThrobber.removeAttribute("disabled");
                 this.mThrobber.setAttribute("busy", true);
             }
         }
     },

     stopMeteors: function cStObs_stopMeteors() {
         if (!this.mInitialized) {
            return;
         }
         if (this.spinning != Components.interfaces.calIStatusObserver.NO_PROGRESS) {
             this.mProgressMode = Components.interfaces.calIStatusObserver.NO_PROGRESS;
             this.mStatusProgressPanel.collapsed = true;
             this.mStatusBar.setAttribute("mode", "normal");
             this.mStatusBar.value = 0;
             this.mCalendarCount = 0;
             this.showStatusString("");
             if (this.mThrobber) {
                 this.mThrobber.setAttribute("busy", false);
                 this.mThrobber.setAttribute("disabled", true);
             }
             this.mCalendarValue = 0;
         }
     },

     calendarCompleted: function cStObs_calendarCompleted(aCalendar) {
         if (!this.mInitialized) {
            return;
         }
         if (this.spinning != Components.interfaces.calIStatusObserver.NO_PROGRESS) {
             if (this.spinning == Components.interfaces.calIStatusObserver.DETERMINED_PROGRESS) {
                 if (!this.mCalendars[aCalendar.id] || this.mCalendars[aCalendar.id] === undefined) {
                     this.mCalendars[aCalendar.id] = true;
                     this.mStatusBar.value = (parseInt(this.mStatusBar.value) + this.mCalendarStep);
                     this.mCurIndex++;
                     var curStatus = this.mProps.formatStringFromName("gettingCalendarInfoDetail",
                              [this.mCurIndex, this.mCalendarCount], 2);
                     this.showStatusString(curStatus);
                 }
             }
             // it may be possible that the throbber has been disabled by another
             // completed operation
             if (this.mThrobber){
                 this.mThrobber.removeAttribute("disabled");
                 this.mThrobber.setAttribute("busy", true);
             }
         }
     }
 };