/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

let EXPORTED_SYMBOLS = ["makeFriendlyDateAgo", "replaceInsert"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

Cu.import("resource:///modules/StringBundle.js");

const gTemplateUtilsStrings =
  new StringBundle("chrome://messenger/locale/templateUtils.properties");

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
    dateTime = gTemplateUtilsStrings.get('yesterday');
  } else if (today - end < k6DaysInMsecs) {
    // activity finished after last week started, show day of week
    dateTime = end.toLocaleFormat("%A");
  } else if (now.getFullYear() == end.getFullYear()) {
    // activity must have been from some time ago.. show month/day
    let month = end.toLocaleFormat("%B");
    // Remove leading 0 by converting the date string to a number
    let date = Number(end.toLocaleFormat("%d"));
    let dayMonth = gTemplateUtilsStrings.get("monthDate");
    dateTime = replaceInsert(dayMonth, 1, month);
    dateTime = replaceInsert(dateTime, 2, date);
  } else {
    // not this year, so show full date format
    dateTime = dts.FormatDate("", dts.dateFormatShort,
                              end.getFullYear(), end.getMonth() + 1,
                              end.getDate());
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