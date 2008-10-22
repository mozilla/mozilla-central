# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is OEone Calendar Code, released October 31st, 2001.
#
# The Initial Developer of the Original Code is
# OEone Corporation.
# Portions created by the Initial Developer are Copyright (C) 2001
# the Initial Developer. All Rights Reserved.
#
# Contributor(s): Mike Shaver <shaver@mozilla.org>
#               Stuart Parmenter <stuart.parmenter@oracle.com>
#               Vladimir Vukicevic <vladimir@pobox.com>
#               Simon Paquet <bugzilla@babylonsounds.com>
#               Berend Cornelius <berend.cornelius@sun.com>
#               Philipp Kewisch <mozilla@kewis.ch>
#               Garth Smedley <garths@oeone.com>
#               Mike Potter <mikep@oeone.com>
#               Colin Phillips <colinp@oeone.com>
#               Chris Charabaruk <coldacid@djfly.org>
#               Karl Guertin <grayrest@grayrest.com>
#               Dan Parent <danp@oeone.com>
#               ArentJan Banck <ajbanck@planet.nl>
#               Eric Belhaire <belhaire@ief.u-psud.fr>
#               Stefan Sitter <ssitter@googlemail.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the LGPL or the GPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

<toolbarbutton id="calendar-new-event-button"
               mode="calendar"
               class="cal-toolbarbutton-1"
               label="&calendar.newevent.button.label;"
               tooltiptext="&calendar.newevent.button.tooltip;"
               observes="calendar_new_event_command"/>
<toolbarbutton id="calendar-new-task-button"
               mode="calendar"
               class="cal-toolbarbutton-1"
               label="&calendar.newtask.button.label;"
               tooltiptext="&calendar.newtask.button.tooltip;"
               observes="calendar_new_todo_command"/>
<toolbarbutton id="calendar-day-view-button"
               mode="calendar"
               type="radio"
               group="calendarViews"
               class="cal-toolbarbutton-1"
               label="&calendar.day.button.label;"
               tooltiptext="&calendar.day.button.tooltip;"
               observes="calendar_day-view_command"/>
<toolbarbutton id="calendar-week-view-button"
               mode="calendar"
               type="radio"
               group="calendarViews"
               class="cal-toolbarbutton-1"
               label="&calendar.week.button.label;"
               tooltiptext="&calendar.week.button.tooltip;"
               observes="calendar_week-view_command"/>
<toolbarbutton id="calendar-multiweek-view-button"
               mode="calendar"
               type="radio"
               group="calendarViews"
               class="cal-toolbarbutton-1"
               label="&calendar.multiweek.button.label;"
               tooltiptext="&calendar.multiweek.button.tooltip;"
               observes="calendar_multiweek-view_command"/>
<toolbarbutton id="calendar-month-view-button"
               mode="calendar"
               type="radio"
               group="calendarViews"
               class="cal-toolbarbutton-1"
               label="&calendar.month.button.label;"
               tooltiptext="&calendar.month.button.tooltip;"
               observes="calendar_month-view_command"/>
<toolbarbutton id="calendar-import-button"
               mode="calendar"
               class="cal-toolbarbutton-1"
               label="&calendar.import.button.label;"
               tooltiptext="&calendar.import.button.tooltip;"
               observes="calendar_import_command"/>
<toolbarbutton id="calendar-export-button"
               mode="calendar"
               class="cal-toolbarbutton-1"
               label="&calendar.export.button.label;"
               tooltiptext="&calendar.export.button.tooltip;"
               observes="calendar_export_command"/>
<toolbarbutton id="calendar-subscribe-button"
               mode="calendar"
               class="cal-toolbarbutton-1"
               label="&calendar.subscribe.button.label;"
               tooltiptext="&calendar.subscribe.button.tooltip;"
               observes="calendar_new_calendar_command"/>
<toolbarbutton id="calendar-publish-button"
               mode="calendar"
               class="cal-toolbarbutton-1"
               label="&calendar.publish.button.label;"
               tooltiptext="&calendar.publish.button.tooltip;"
               observes="calendar_publish_calendar_command"/>
<toolbarbutton id="calendar-unifinder-button"
               mode="calendar"
               class="cal-toolbarbutton-1"
               type="checkbox"
               checked="true"
               label="&calendar.unifinder.button.label;"
               tooltiptext="&calendar.unifinder.button.tooltip;"
               command="calendar_show_unifinder_command"/>
