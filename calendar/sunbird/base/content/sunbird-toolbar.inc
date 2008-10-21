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

<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-edit-button"
               label="&calendar.edit.button.label;"
               tooltiptext="&calendar.edit.button.tooltip;"
               observes="calendar_modify_event_command"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-delete-button"
               label="&calendar.delete.button.label;"
               tooltiptext="&calendar.delete.button.tooltip;"
               observes="calendar_delete_event_command"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-cut-button"
               label="&calendar.cut.button.label;"
               tooltiptext="&calendar.cut.button.tooltip;"
               observes="cmd_cut"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-copy-button"
               label="&calendar.copy.button.label;"
               tooltiptext="&calendar.copy.button.tooltip;"
               observes="cmd_copy"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-paste-button"
               label="&calendar.paste.button.label;"
               tooltiptext="&calendar.paste.button.tooltip;"
               observes="cmd_paste"/>
<toolbarbutton class="cal-toolbarbutton-1"
               id="calendar-choose-date-button"
               label="&calendar.choosedate.button.label;"
               tooltiptext="&calendar.choosedate.button.tooltip;"
               observes="go_date_command"/>
