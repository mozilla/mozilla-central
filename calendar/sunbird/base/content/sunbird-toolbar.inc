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
# Contributor(s): Garth Smedley <garths@oeone.com>
#                 Mike Potter <mikep@oeone.com>
#                 Colin Phillips <colinp@oeone.com>
#                 Chris Charabaruk <coldacid@djfly.org>
#                 Karl Guertin <grayrest@grayrest.com>
#                 Dan Parent <danp@oeone.com>
#                 ArentJan Banck <ajbanck@planet.nl>
#                 Eric Belhaire <belhaire@ief.u-psud.fr>
#                 Stefan Sitter <ssitter@googlemail.com>
#                 Philipp Kewisch <mozilla@kewis.ch>
#                 Simon Paquet <bugzilla@babylonsounds.com>
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
               class="cal-toolbarbutton-1"
               label="&calendar.newevent.button.label;"
               tooltiptext="&calendar.newevent.button.tooltip;"
               observes="calendar_new_event_command"/>
<toolbarbutton id="calendar-new-task-button"
               class="cal-toolbarbutton-1"
               label="&calendar.newtask.button.label;"
               tooltiptext="&calendar.newtask.button.tooltip;"
               observes="calendar_new_todo_command"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-edit-button"
               label="&sunbird.edit.button.label;"
               tooltiptext="&sunbird.edit.button.tooltip;"
               observes="calendar_modify_focused_item_command"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-delete-button"
               label="&sunbird.delete.button.label;"
               tooltiptext="&sunbird.delete.button.tooltip;"
               observes="calendar_delete_focused_item_command"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-cut-button"
               label="&sunbird.cut.button.label;"
               tooltiptext="&sunbird.cut.button.tooltip;"
               observes="cmd_cut"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-copy-button"
               label="&sunbird.copy.button.label;"
               tooltiptext="&sunbird.copy.button.tooltip;"
               observes="cmd_copy"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-paste-button"
               label="&sunbird.paste.button.label;"
               tooltiptext="&sunbird.paste.button.tooltip;"
               observes="cmd_paste"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-choose-date-button"
               label="&sunbird.choosedate.button.label;"
               tooltiptext="&sunbird.choosedate.button.tooltip;"
               observes="go_date_command"/>
<toolbarbutton id="calendar-go-to-today-button"
               class="cal-toolbarbutton-1"
               label="&calendar.today.button.label;"
               tooltiptext="&calendar.today.button.tooltip;"
               observes="calendar_go_to_today_command"/>
<toolbarbutton id="calendar-print-button"
               class="cal-toolbarbutton-1"
               label="&calendar.print.button.label;"
               tooltiptext="&sunbird.print.button.tooltip;"
               observes="cmd_print"/>
<toolbarbutton id="calendar-remote-reload-button"
               class="cal-toolbarbutton-1"
               label="&sunbird.remotereload.button.label;"
               tooltiptext="&sunbird.remotereload.button.tooltip;"
               observes="calendar_reload_remote_calendars"/>
<toolbarbutton id="calendar-import-button"
               class="cal-toolbarbutton-1"
               label="&sunbird.import.button.label;"
               tooltiptext="&sunbird.import.button.tooltip;"
               observes="calendar_import_command"/>
<toolbarbutton id="calendar-export-button"
               class="cal-toolbarbutton-1"
               label="&sunbird.export.button.label;"
               tooltiptext="&sunbird.export.button.tooltip;"
               observes="calendar_export_command"/>
<toolbarbutton id="calendar-subscribe-button"
               class="cal-toolbarbutton-1"
               label="&sunbird.subscribe.button.label;"
               tooltiptext="&sunbird.subscribe.button.tooltip;"
               observes="calendar_new_calendar_command"/>
<toolbarbutton id="calendar-publish-button"
               class="cal-toolbarbutton-1"
               label="&sunbird.publish.button.label;"
               tooltiptext="&sunbird.publish.button.tooltip;"
               observes="calendar_publish_calendar_command"/>
<toolbarbutton id="calendar-unifinder-button"
               class="cal-toolbarbutton-1"
               type="checkbox"
               checked="true"
               label="&sunbird.unifinder.button.label;"
               tooltiptext="&sunbird.unifinder.button.tooltip;"
               command="calendar_show_unifinder_command"/>
