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
# The Original Code is calendar views.
#
# The Initial Developer of the Original Code is Oracle Corporation
# Portions created by the Initial Developer are Copyright (C) 2005
# the Initial Developer. All Rights Reserved.
#
# Contributor(s): Mike Shaver <shaver@mozilla.org>
#                 Stuart Parmenter <stuart.parmenter@oracle.com>
#                 Vladimir Vukicevic <vladimir@pobox.com>
#                 Simon Paquet <bugzilla@babylonsounds.com>
#                 Berend Cornelius <berend.cornelius@sun.com>
#                 Philipp Kewisch <mozilla@kewis.ch>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

<toolbarbutton id="calendar-edit-button"
               mode="calendar"
               class="cal-toolbarbutton-1"
               label="&calendar.edit.button.label;"
               tooltiptext="&calendar.edit.button.tooltip;"
               observes="lightning_modify_item_command"/>
<toolbarbutton id="task-category-button"
               type="menu"
               mode="task"
               class="cal-toolbarbutton-1"
               label="&calendar.unifinder.tree.categories.label;"
               tooltiptext="&calendar.task.category.button.tooltip;"
               command="calendar_task_category_command"
               observes="calendar_task_category_command">
   <menupopup onpopupshowing="addCategoryNames(event)"/>
</toolbarbutton>
<toolbarbutton id="task-progress-button"
               type="menu-button"
               autoCheck="false"
               mode="task"
               class="cal-toolbarbutton-1"
               label="&calendar.context.markcompleted.label;"
               tooltiptext="&calendar.task.complete.button.tooltip;"
               command="calendar_percentComplete-100_command2"
               observes="calendar_percentComplete-100_command2">
        <menupopup type="task-progress"/>
</toolbarbutton>
<toolbarbutton id="task-priority-button"
               type="menu"
               mode="task"
               class="cal-toolbarbutton-1"
               label="&calendar.context.priority.label;"
               tooltiptext="&calendar.task.priority.button.tooltip;"
               command="calendar_general-priority_command"
               observes="calendar_general-priority_command">
        <menupopup type="task-priority"/>
</toolbarbutton>
