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
#                 Matthew Willis <mattwillis@gmail.com>
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

     <menubar id="main-menubar" style="border:0px;padding:0px;margin:0px;-moz-appearance:none">
       <menu id="menu_File"
             label="&fileMenu.label;"
             accesskey="&fileMenu.accesskey;">
         <menupopup id="menu_FilePopup">

           <!-- create new event or task (top of 1st menu, for new users) -->
           <menuitem id="calendar-new-event-menu"
                     key="calendar-new-event-key"
                     label="&event.new.event;"
                     accesskey="&event.new.event.accesskey;"
                     observes="calendar_new_event_command"/>
           <menuitem id="calendar-new-todo-menu"
                     key="calendar-new-todo-key"
                     label="&event.new.todo;"
                     accesskey="&event.new.todo.accesskey;"
                     observes="calendar_new_todo_command"/>
           <menuitem id="calendar-new-calendar-menu"
                     key="new_calendar_key"
                     label="&calendar.new.server.label;"
                     accesskey="&calendar.new.server.accesskey;"
                     observes="calendar_new_calendar_command"/>
           <menuitem id="calendar-open-calendar-menu"
                     key="open_calendar_key"
                     label="&calendar.open.file.label;"
                     accesskey="&calendar.open.file.accesskey;"
                     observes="open_local_calendar_command"/>
           <menuitem id="calendar-addserver-menu"
                     label="&calendar.subscribe.label;"
                     accesskey="&calendar.subscribe.accesskey;"
                     observes="calendar_new_calendar_command"/>
           <menuseparator id="calendar-new-sep"/>

           <!-- import: pulling data into existing files -->
           <menuitem id="calendar-import-menu"
                     key="import_key"
                     label="&calendar.import.label;"
                     accesskey="&calendar.import.accesskey;"
                     observes="calendar_import_command"/>
           <!-- export: getting data out of existing files -->
           <menuitem id="calendar-export-menu"
                     label="&calendar.export.selection.label;"
                     accesskey="&calendar.export.selection.accesskey;"
                     observes="calendar_export_selection_command"/>
           <menuitem id="calendar-export-calendar-menu"
                     label="&calendar.export.calendar.label;"
                     accesskey="&calendar.export.calendar.accesskey;"
                     observes="calendar_export_command"/>
           <menuseparator id="calendar-importexport-sep"/>
           <menuitem id="calendar-publish-menu"
                     label="&calendar.publish.selection.label;"
                     accesskey="&calendar.publish.selection.accesskey;"
                     observes="calendar_publish_selected_events_command"/>
           <menuitem id="calendar-publish-calendar-menu"
                     label="&calendar.publish.calendar.label;"
                     accesskey="&calendar.publish.calendar.accesskey;"
                     observes="calendar_publish_calendar_command"/>
           <menuseparator id="calendar-publish-sep"/>

           <menuitem id="calendar-reloadserver-menu"
                     key="reload_server_key"
                     label="&calendar.reloadserver.label;"
                     accesskey="&calendar.reloadserver.accesskey;"
                     observes="calendar_reload_remote_calendars"/>
           <menuseparator id="calendar-reload-sep"/>

           <menuitem id="calendar-page-setup-menu"
                     label="&calendar.pagesetup.label;"
                     accesskey="&calendar.pagesetup.accesskey;"
                     observes="cmd_pageSetup"/>
           <menuitem id="calendar-print-menu"
                     key="print_key"
                     label="&calendar.print.label;"
                     accesskey="&calendar.print.accesskey;"
                     observes="cmd_print"/>
#ifdef XP_MACOSX
           <menuitem id="menu_FileQuitItem"
                     label="&calendar.quit.label.mac;"
                     key="key_quitApplication"
                     command="cmd_quitApplication"/>
#else
           <menuseparator id="calendar-print-sep"/>
#ifdef XP_WIN
           <menuitem id="calendar-quit-menu"
                     label="&calendar.exit.label;"
                     accesskey="&calendar.exit.accesskey;"
                     oncommand="goQuitApplication()"/>
#else
           <menuitem id="calendar-quit-menu"
                     label="&calendar.quit.label;"
                     accesskey="&calendar.quit.accesskey;"
                     key="key_quitApplication"
                     command="cmd_quitApplication"/>
#endif
#endif
         </menupopup>
       </menu>

       <menu id="menu_Edit"
             label="&editMenu.label;"
              accesskey="&editMenu.accesskey;">
         <menupopup id="mppEdit">
           <menuitem id="calendar-undo-menu"
                     key="undo_key"
                     accesskey="&calendar.undo.accesskey;"
                     label="&calendar.undo.label;"
                     observes="cmd_undo"/>
           <menuitem id="calendar-redo-menu"
                     key="redo_key"
                     accesskey="&calendar.redo.accesskey;"
                     label="&calendar.redo.label;"
                     observes="cmd_redo"/>
           <menuseparator id="before-undo-Section"/>
           <menuitem id="calendar-cut-menu"
                     key="key_cut"
                     label="&calendar.cut.label;"
                     accesskey="&calendar.cut.accesskey;"
                     observes="cmd_cut"/>
           <menuitem id="calendar-copy-menu"
                     key="key_copy"
                     label="&calendar.copy.label;"
                     accesskey="&calendar.copy.accesskey;"
                     observes="cmd_copy"/>
           <menuitem id="calendar-paste-menu"
                     key="key_paste"
                     label="&calendar.paste.label;"
                     accesskey="&calendar.paste.accesskey;"
                     observes="cmd_paste"/>
           <menuitem id="unifinder-modify-menu"
                     key="modify_event_key"
                     label="&event.edit.event;"
                     accesskey="&event.edit.event.accesskey;"
                     observes="calendar_modify_event_command"/>
           <menuitem id="unifinder-remove-event-menu"
                     label="&event.delete.event;"
                     accesskey="&event.delete.event.accesskey;"
                     observes="calendar_delete_event_command"/>
           <menuitem id="unifinder-remove-task-menu"
                     label="&event.delete.tasks;"
                     accesskey="&event.delete.tasks.accesskey;"
                     observes="calendar_delete_todo_command" />
           <menuitem id="calendar-selectall-menu"
                     key="key_selectAll"
                     label="&calendar.selectall.label;"
                     accesskey="&calendar.selectall.accesskey;"
                     observes="cmd_selectAll"/>
           <menuseparator id="before-Unifinder-Section"/>
           <menuitem id="calendar-show-unifinder-menu"
                     type="checkbox"
                     label="&showUnifinderCmd.label;"
                     observes="calendar_show_unifinder_command"
                     accesskey="&showUnifinderCmd.accesskey;"
                     checked="true"/>
#ifdef XP_UNIX
#ifndef XP_MACOSX
           <menuseparator/>
           <menuitem id="menu_preferences_unix"
                     label="&preferencesCmd.label;"
                     accesskey="&preferencesCmd.accesskey;"
                     oncommand="openPreferences();"/>
#endif
#endif
         </menupopup>
       </menu>

       <menu id="menu_View"
             label="&viewMenu.label;"
             accesskey="&viewMenu.accesskey;">
         <menupopup id="menu_viewPopup">
           <menu id="menu_Toolbars"
                 label="&toolbarsMenu.label;"
                 accesskey="&toolbarsMenu.accesskey;"
                 onpopupshowing="sbOnViewToolbarsPopupShowing(event);">
             <menupopup>
               <menuseparator/>
               <menuitem id="calendar-view-menu-customize"
                         observes="cmd_CustomizeToolbars"
                         label="&sunbird.menu.customize.label;"
                         accesskey="&sunbird.menu.customize.accesskey;"/>
             </menupopup>
           </menu>
           <menuitem id="menu_showStatusBar"
                     type="checkbox"
                     label="&showStatusBarCmd.label;"
                     command="cmd_showStatusBar"
                     accesskey="&showStatusBarCmd.accesskey;"
                     checked="true"/>
           <menuitem id="menu_showTaskBox"
                     type="checkbox"
                     label="&showTaskBoxCmd.label;"
                     command="cmd_showTaskBox"
                     accesskey="&showTaskBoxCmd.accesskey;"
                     checked="true"/>
           <menuseparator/>
           <menuitem id="calendar-view-menu-day"
                     type="radio"
                     name="calendarMenuViews"
                     key="calendar-day-view-key"
                     label="&sunbird.flat.topbar.dayview;"
                     accesskey="&sunbird.dayview.accesskey;"
                     observes="calendar_day-view_command"/>
           <menuitem id="calendar-view-menu-week"
                     type="radio"
                     name="calendarMenuViews"
                     key="calendar-week-view-key"
                     label="&sunbird.flat.topbar.weekview;"
                     accesskey="&sunbird.weekview.accesskey;"
                     observes="calendar_week-view_command"/>
           <menuitem id="calendar-view-menu-multiweek"
                     type="radio"
                     name="calendarMenuViews"
                     key="calendar-multiweek-view-key"
                     label="&sunbird.flat.topbar.multiweekview;"
                     accesskey="&sunbird.multiweekview.accesskey;"
                     observes="calendar_multiweek-view_command"/>
           <menuitem id="calendar-view-menu-month"
                     type="radio"
                     name="calendarMenuViews"
                     key="calendar-month-view-key"
                     label="&sunbird.flat.topbar.monthview;"
                     accesskey="&sunbird.monthview.accesskey;"
                     observes="calendar_month-view_command"/>
           <menuseparator/>
           <menuitem id="calendar_view_orientation"
                     type="checkbox"
                     label="&calendar.orientation.label;"
                     accesskey="&calendar.orientation.accesskey;"
                     observes="calendar_toggle_orientation_command"/>
           <menuitem id="only-workday-checkbox-1"
                     type="checkbox"
                     label="&calendar.onlyworkday.checkbox.label;"
                     accesskey="&calendar.onlyworkday.checkbox.accesskey;"
                     observes="calendar_toggle_workdays_only_command"/>
           <menuitem id="display-todo-inview-checkbox-1"
                     type="checkbox"
                     label="&calendar.displaytodos.checkbox.label;"
                     accesskey="&calendar.displaytodos.checkbox.accesskey;"
                     observes="calendar_toggle_tasks_in_view_command"/>
           <menuitem id="completed-tasks-inview-checkbox-1"
                     type="checkbox"
                     label="&calendar.completedtasks.checkbox.label;"
                     accesskey="&calendar.completedtasks.checkbox.accesskey;"
                     observes="calendar_toggle_show_completed_in_view_command"/>
           <menu id="menu-numberofweeks-inview"
                 label="&sunbird.menu.numberofweeks.label;"
                 accesskey="&sunbird.menu.numberofweeks.accesskey;"
                 oncommand="changeNumberOfWeeks(event.target)"
                 disabled="true">
           <menupopup onpopupshowing="this.childNodes.item(currentView().weeksInView - 1).setAttribute('checked', true);">
             <menuitem type="radio"
                       value="1"
                       name="menunbofweeks"
                       accesskey="1"
                       label="&sunbird.menu.numberofweeks.1;"/>
             <menuitem type="radio"
                       value="2"
                       name="menunbofweeks"
                       accesskey="2"
                       label="&sunbird.menu.numberofweeks.2;"/>
             <menuitem type="radio"
                       value="3"
                       name="menunbofweeks"
                       accesskey="3"
                       label="&sunbird.menu.numberofweeks.3;"/>
             <menuitem type="radio"
                       value="4"
                       name="menunbofweeks"
                       accesskey="4"
                       label="&sunbird.menu.numberofweeks.4;"/>
             <menuitem type="radio"
                       value="5"
                       name="menunbofweeks"
                       accesskey="5"
                       label="&sunbird.menu.numberofweeks.5;"/>
             <menuitem type="radio"
                       value="6"
                       name="menunbofweeks"
                       accesskey="6"
                       label="&sunbird.menu.numberofweeks.6;"/>
           </menupopup>
           </menu>
           <menuseparator/>
           <!-- XXX lilmatt: Finish this! -->
           <menuitem id="calendar-fullscreen-menu"
                     label="&calendar.fullscreen.label;"
                     accesskey="&calendar.fullscreen.accesskey;"
                     disabled="true"/>
         </menupopup>
       </menu>

       <menu id="menu_Go"
             label="&goMenu.label;"
             accesskey="&goMenu.accesskey;">
         <menupopup id="mppView">
           <menuitem id="calendar-go-menu-today"
                     key="calendar-go-to-today-key"
                     label="&goTodayCmd.label;"
                     accesskey="&goTodayCmd.accesskey;"
                     observes="calendar_go_to_today_command"/>
           <menuitem id="calendar-go-menu-date"
                     key="go_to_date_key"
                     label="&goDateCmd.label;"
                     accesskey="&goDateCmd.accesskey;"
                     observes="go_date_command"/>
           <menuseparator/>
           <!-- Label is set appropriate to the variable newView in 
                sbSwitchToView(newView) of calendar.js -->
           <menuitem id="calendar-go-menu-previous"
                     label=""
                     label-day-view="&goPreviousCmd.day.label;"
                     label-week-view="&goPreviousCmd.week.label;"
                     label-multiweek-view="&goPreviousCmd.week.label;"
                     label-month-view="&goPreviousCmd.month.label;"
                     accesskey="&goPreviousCmd.accesskey;"
                     observes="calendar_view_prev_command"/>
           <menuitem id="calendar-go-menu-next"
                     label=""
                     label-day-view="&goNextCmd.day.label;"
                     label-week-view="&goNextCmd.week.label;"
                     label-multiweek-view="&goNextCmd.week.label;"
                     label-month-view="&goNextCmd.month.label;"
                     accesskey="&goNextCmd.all.accesskey;"
                     observes="calendar_view_next_command"/>
         </menupopup>
       </menu>

       <menu id="menu_Tools"
             label="&toolsMenu.label;"
             accesskey="&toolsMenu.accesskey;">
         <menupopup id="menu_ToolsPopup">
           <menuitem id="addonsManager"
                     label="&calendar.addons.label;"
                     accesskey="&calendar.addons.accesskey;"
                     command="Tools:Addons"/>
           <menuseparator id="devToolsSeparator"/>
           <menuitem id="javascriptConsole" 
                     label="&errorConsoleCmd.label;"
                     accesskey="&errorConsoleCmd.accesskey;"
                     oncommand="toJavaScriptConsole();"/>
<!-- The ids of the following menuseparator and menuitem must remain as they are to be
   - automatically hidden on Mac OS X - See mozilla/widget/src/mac/nsMenuBarX.cpp -->
#ifndef XP_UNIX
           <menuseparator id="menu_PrefsSeparator"/>
               <menuitem id="menu_preferences"
                         label="&optionsCmd.label;"
                         accesskey="&optionsCmd.accesskey;"
                         oncommand="openPreferences();"/>
#endif
#ifdef XP_MACOSX
# -- ifdef UNIX also covers Mac OS X, so we have to explicitly enable this menuitem
           <menuseparator id="menu_PrefsSeparator"/>
               <menuitem id="menu_preferences"
                         label="&preferencesCmdMac.label;"
                         key="key_preferencesCmdMac"
                         oncommand="openPreferences();"/>
#endif
         </menupopup>
       </menu>

#ifdef XP_MACOSX
<!-- Mac OS X only "Window" menu -->
       <menu id="windowMenu"
             label="&windowMenu.label;"
             datasources="rdf:window-mediator"
             ref="NC:WindowMediatorRoot"
             onpopupshown="checkFocusedWindow();">
         <template>
           <rule>
             <menupopup>
               <menuitem uri="rdf:*"
                         label="rdf:http://home.netscape.com/NC-rdf#Name"
                         type="radio"
                         name="windowList"
                         oncommand="ShowWindowFromResource(event.target)"/>
             </menupopup>
           </rule>
         </template>
         <menupopup id="windowPopup">
           <menuitem id="minimizeWindow"
                     key="key_minimizeWindow"
                     label="&minimizeWindow.label;"
                     command="minimizeWindowCmd"/>
           <menuitem id="zoomWindow"
                     label="&zoomWindow.label;"
                     command="zoomWindowCmd"/>
           <menuseparator/>
           <menuitem id="bringAllToFront"
                     label="&bringAllToFront.label;"
                     command="bringAllToFront"
                     disabled="true"/>
           <menuseparator id="sep-window-list"/>
         </menupopup>
# We just need this node to exist in order to get Gecko to create a Services
# menu for us under Cocoa widgets. It will be automatically hidden.
         <menuitem id="menu_mac_services"
                   label="&servicesMenuMac.label;"/>
# We just need this node to exist in order to get Gecko to create a "Hide [app]"
# menu for us under Cocoa widgets. It will be automatically hidden.
         <menuitem id="menu_mac_hide_app"
                   label="&hideThisAppCmdMac.label;"
                   key="key_hideThisAppCmdMac"/>
# We just need this node to exist in order to get Gecko to create a "Hide Others"
# menu for us under Cocoa widgets. It will be automatically hidden.
         <menuitem id="menu_mac_hide_others"
                   label="&hideOtherAppsCmdMac.label;"
                   key="key_hideOtherAppsCmdMac"/>
# We just need this node to exist in order to get Gecko to create a "Show All"
# menu for us under Cocoa widgets. It will be automatically hidden.
         <menuitem id="menu_mac_show_all"
                   label="&showAllAppsCmdMac.label;"/>
       </menu>
#endif

#ifdef XP_WIN
   <menu id="menu_Help"
         label="&helpMenuWin.label;"
         accesskey="&helpMenuWin.accesskey;">
#else
   <menu id="menu_Help"
         label="&helpMenu.label;"
         accesskey="&helpMenu.accesskey;">
#endif
         <menupopup id="menu_HelpPopup" onpopupshowing="sbUpdateItem();">
           <!-- XXX lilmatt: Finish this!  oncommand="openTopWin('&helpURL;');" -->
           <menuitem label="&sunbird.help.label;"
                     accesskey="&sunbird.help.accesskey;"
                     disabled="true"/>
           <menuitem accesskey="&releaseCmd.accesskey;"
                     label="&releaseCmd.label;"
                     oncommand="openReleaseNotes();"/>
           <menuseparator id="menu_HelpUpdatesSeparator"/>
           <menuitem id="checkForUpdates"
                     class="menuitem-iconic"
                     label="&updateCmd.label;"
                     accesskey="&updateCmd.accesskey;"
                     oncommand="sbCheckForUpdates();"/>

# On Mac OS X, the "About Sunbird" menuitem belongs under the "Sunbird" menu.
# We hide it (and its separator) here, but we don't ifdef the entire menuitem
# out, as doing so will prevent it from appearing in either place at all!
#
#ifndef XP_MACOSX
           <menuseparator id="menu_HelpAboutSeparator"/>
#endif
           <menuitem id="aboutName"
                     label="&aboutCmd.label;"
                     accesskey="&aboutCmd.accesskey;"
#ifdef XP_MACOSX
                     hidden="true"
#endif
                     oncommand="openAboutDialog();"/>
         </menupopup>
       </menu>
     </menubar>
