/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This file contains all of the default preference values for Lightning

// Turns on basic calendar logging.
pref("calendar.debug.log", false);
// Turns on verbose calendar logging.
pref("calendar.debug.log.verbose", false);

// addon description
pref("extensions.{e2fda1a4-762b-4020-b5ad-a41df1933103}.description",
     "chrome://lightning/locale/lightning.properties");
pref("extensions.{e2fda1a4-762b-4020-b5ad-a41df1933103}.name",
     "chrome://lightning/locale/lightning.properties");
pref("extensions.{e2fda1a4-762b-4020-b5ad-a41df1933103}.creator",
     "chrome://lightning/locale/lightning.properties");

// general settings
pref("calendar.date.format", 0);
pref("calendar.event.defaultlength", 60);

// default transparency of allday items; could be switched to e.g. "OPAQUE":
pref("calendar.allday.defaultTransparency", "TRANSPARENT");

// number of days in "Soon" section
pref("calendar.agendaListbox.soondays", 5);

// alarm settings
pref("calendar.alarms.show", true);
pref("calendar.alarms.showmissed", true);
pref("calendar.alarms.playsound", true);
pref("calendar.alarms.soundURL", "chrome://calendar/content/sound.wav");
pref("calendar.alarms.defaultsnoozelength", 5);
pref("calendar.alarms.indicator.show", true);
pref("calendar.alarms.indicator.totaltime", 3600);

// default alarm settings for new event
pref("calendar.alarms.onforevents", 0);
pref("calendar.alarms.eventalarmlen", 15);
pref("calendar.alarms.eventalarmunit", "minutes");

// default alarm settings for new task
pref("calendar.alarms.onfortodos", 0);
pref("calendar.alarms.todoalarmlen", 15);
pref("calendar.alarms.todoalarmunit", "minutes");

// open invitations autorefresh settings
pref("calendar.invitations.autorefresh.enabled", true);
pref("calendar.invitations.autorefresh.timeout", 3);

// iTIP compatibility send mode
// 0 -- Outlook 2003 and following with text/plain and application/ics (default)
// 1 -- all Outlook, but no text/plain nor application/ics
// We may extend the compat mode if necessary.
pref("calendar.itip.compatSendMode", 0);

// whether "notify" is checked by default when creating new events/todos with attendees
pref("calendar.itip.notify", true);

// whether the organizer propagates replies of attendees to all attendees
pref("calendar.itip.notify-replies", false);

// whether CalDAV (experimental) scheduling is enabled or not.
pref("calendar.caldav.sched.enabled", false);

// 0=Sunday, 1=Monday, 2=Tuesday, etc.  One day we might want to move this to
// a locale specific file.
pref("calendar.week.start", 0);
pref("calendar.weeks.inview", 4);
pref("calendar.previousweeks.inview", 0);

// Default days off
pref("calendar.week.d0sundaysoff", true);
pref("calendar.week.d1mondaysoff", false);
pref("calendar.week.d2tuesdaysoff", false);
pref("calendar.week.d3wednesdaysoff", false);
pref("calendar.week.d4thursdaysoff", false);
pref("calendar.week.d5fridaysoff", false);
pref("calendar.week.d6saturdaysoff", true);

// start and end work hour for day and week views
pref("calendar.view.daystarthour", 8);
pref("calendar.view.dayendhour", 17);

// number of visible hours for day and week views
pref("calendar.view.visiblehours", 9);

// time indicator update interval in minutes (0 = no indicator)
pref("calendar.view.timeIndicatorInterval", 15);

// If true, mouse scrolling via shift+wheel will be enabled
pref("calendar.view.mousescroll", true);

// Do not set this!  If it's not there, then we guess the system timezone
//pref("calendar.timezone.local", "");

// Recent timezone list
pref("calendar.timezone.recent", "[]");

// categories settings
// XXX One day we might want to move this to a locale specific file
//     and include a list of locale specific default categories
pref("calendar.categories.names", "");

// Make sure mouse wheel shift and no key actions to scroll lines.
pref("mousewheel.withnokey.action", 0);
pref("mousewheel.withshiftkey.action", 0);

// Disable use of worker threads. Restart needed.
pref("calendar.threading.disabled", false);

// The maximum time in microseconds that a cal.forEach event can take (soft limit).
pref("calendar.threading.latency ", 250);

// Enable support for multiple realms on one server with the payoff that you
// will get multiple password dialogs (one for each calendar)
pref("calendar.network.multirealm", false);

// Set up user agent
#expand pref("calendar.useragent.extra", "Lightning/__LIGHTNING_VERSION__");

// Disable use of system colors in minimonth and calendar views
pref("calendar.view.useSystemColors", false);

// Maximum number of iterations allowed when searching for the next matching
// occurrence of a repeating item in calFilter
pref("calendar.filter.maxiterations", 50);
