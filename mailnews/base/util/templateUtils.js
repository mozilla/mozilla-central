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
 * The Original Code is templateUtils.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   David Ascher <dascher@mozillamessaging.com>
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

let EXPORTED_SYMBOLS = ["makeFriendlyDateAgo", "replaceInsert"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

/**
 * Helper function to generate a localized "friendly" representation of
 * time relative to the present.  If the time input is "today", it returns
 * a string corresponding to just the time.  If it's yesterday, it returns
 * "yesterday" (localized).  If it's in the last week, it returns the day
 * of the week. If it's before that, it returns the date.
 *
 * @param time
 *        the time (better be in the past!)
 * @return The string with a "human-friendly" representation of that time
 *        relative to now.
 */
function makeFriendlyDateAgo(time)
{
  let dts = Components.classes["@mozilla.org/intl/scriptabledateformat;1"]
                      .getService(Components.interfaces.nsIScriptableDateFormat);

  // Figure out when today begins
  let now = new Date();
  let today = new Date(now.getFullYear(), now.getMonth(),
                       now.getDate());

  // Get the end time to display
  let end = time;

  // Figure out if the end time is from today, yesterday,
  // this week, etc.
  let dateTime;
  let kDayInMsecs = 24 * 60 * 60 * 1000;
  let k6DaysInMsecs = 6 * kDayInMsecs;
  if (end >= today) {
    // activity finished after today started, show the time
    dateTime = dts.FormatTime("", dts.timeFormatNoSeconds,
                                  end.getHours(), end.getMinutes(),0);
  } else if (today - end < kDayInMsecs) {
    // activity finished after yesterday started, show yesterday
    dateTime = gSelectionSummaryStrings.yesterday;
  } else if (today - end < k6DaysInMsecs) {
    // activity finished after last week started, show day of week
    dateTime = end.toLocaleFormat("%A");
  } else if (now.getFullYear() == end.getFullYear()) {
    // activity must have been from some time ago.. show month/day
    let month = end.toLocaleFormat("%B");
    // Remove leading 0 by converting the date string to a number
    let date = Number(end.toLocaleFormat("%d"));
    //dateTime = replaceInsert(this.text.monthDate, 1, month);
    dateTime = replaceInsert("#1 #2", 1, month);
    dateTime = replaceInsert(dateTime, 2, date);
  } else {
    // not this year, so show year as wel
    let month = end.toLocaleFormat("%B");
    let year = end.toLocaleFormat("%Y");
    // Remove leading 0 by converting the date string to a number
    let date = Number(end.toLocaleFormat("%d"));
    //dateTime = replaceInsert(this.text.monthDate, 1, month);
    dateTime = replaceInsert("#1 #2 #3", 1, month);
    dateTime = replaceInsert(dateTime, 2, date);
    dateTime = replaceInsert(dateTime, 3, year);
  }
  return dateTime;
}

/**
 * Helper function to replace a placeholder string with a real string
 *
 * @param aText
 *        Source text containing placeholder (e.g., #1)
 * @param aIndex
 *        Index number of placeholder to replace
 * @param aValue
 *        New string to put in place of placeholder
 * @return The string with placeholder replaced with the new string
 */
function replaceInsert(aText, aIndex, aValue)
{
  return aText.replace("#" + aIndex, aValue);
}