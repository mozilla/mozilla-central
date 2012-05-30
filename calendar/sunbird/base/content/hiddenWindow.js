/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#ifdef XP_MACOSX
function hiddenWindowStartup() {
    // focus the hidden window
    window.focus();

    // Disable menus which are not appropriate
    var disabledItems = ['calendar_new_event_command',
                         'calendar_modify_event_command',
                         'calendar_delete_event_command',
                         'calendar_new_todo_command',
                         'calendar_delete_todo_command',
                         'calendar_new_calendar_command',
                         'calendar_edit_calendar_command',
                         'calendar_delete_calendar_command',
                         'calendar_import_command',
                         'calendar_export_command',
                         'calendar_export_selection_command',
                         'calendar_publish_calendar_command',
                         'calendar_publish_selected_calendar_command',
                         'calendar_publish_selected_events_command',
                         'calendar_reload_remote_calendars',
                         'calendar_day-view_command',
                         'calendar_week-view_command',
                         'calendar_multiweek-view_command',
                         'calendar_month-view_command',
                         'calendar_view_prev_command',
                         'calendar_view_next_command',
                         'calendar_go_to_today_command',
                         'close_calendar_command',
                         'cmd_cut',
                         'cmd_copy',
                         'cmd_paste',
                         'cmd_undo',
                         'cmd_redo',
                         'cmd_print',
                         'cmd_selectAll',
                         'cmd_pageSetup',
                         'cmd_CustomizeToolbars',
                         'go_date_command',
                         'calendar_edit_calendar_command',
                         'minimizeWindowCmd',
                         'zoomWindowCmd'];
    for each (var id in disabledItems) {
        var broadcaster = document.getElementById(id);
        if (broadcaster) {
            broadcaster.setAttribute("disabled", "true");
        }
    }
}

// Mac OS X "Window" menu functions
const nsIWindowDataSource = Components.interfaces.nsIWindowDataSource;

function checkFocusedWindow()
{
  var windowManagerDS = Components.classes['@mozilla.org/rdf/datasource;1?name=window-mediator'].getService(nsIWindowDataSource);

  var sep = document.getElementById("sep-window-list");
  // Using double parens to avoid warning
  while ((sep = sep.nextSibling)) {
    var url = sep.getAttribute('id');
    var win = windowManagerDS.getWindowForResource(url);
    if (win == window) {
      sep.setAttribute("checked", "true");
      break;
    }
  }
}

function toOpenWindow( aWindow )
{
  aWindow.document.commandDispatcher.focusedWindow.focus();
}

function ShowWindowFromResource( node )
{
  var windowManagerDS = Components.classes['@mozilla.org/rdf/datasource;1?name=window-mediator'].getService(nsIWindowDataSource);

  var desiredWindow = null;
  var url = node.getAttribute('id');
  desiredWindow = windowManagerDS.getWindowForResource( url );
  if ( desiredWindow )
  {
    toOpenWindow(desiredWindow);
  }
}

function zoomWindow()
{
  if (window.windowState == STATE_NORMAL)
    window.maximize();
  else
    window.restore();
}
#endif
