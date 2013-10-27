/* -*- Mode: Javascript; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function hiddenWindowStartup()
{
  // Disable menus which are not appropriate
  let disabledItems = [
      'menu_newFolder', 'newMailAccountMenuItem', 'newAccountMenuItem',
      'menu_close', 'menu_saveAs', 'menu_saveAsFile', 'menu_newVirtualFolder',
      'menu_find', 'menu_findCmd', 'menu_findAgainCmd', 'menu_sendunsentmsgs',
      'menu_subscribe', 'menu_deleteFolder', 'menu_renameFolder', 'menu_select',
      'menu_selectAll', 'menu_selectThread', 'menu_favoriteFolder',
      'menu_properties', 'menu_Toolbars', 'menu_MessagePaneLayout',
      'menu_showMessage', 'menu_showFolderPane', 'menu_FolderViews',
      'viewSortMenu', 'groupBySort', 'viewMessageViewMenu',
      'mailviewCharsetMenu', 'viewMessagesMenu', 'menu_expandAllThreads',
      'collapseAllThreads', 'viewheadersmenu', 'viewBodyMenu',
      'viewAttachmentsInlineMenuitem', 'viewFullZoomMenu', 'goNextMenu',
      'menu_nextMsg', 'menu_nextUnreadMsg', 'menu_nextUnreadThread',
      'goPreviousMenu', 'menu_prevMsg', 'menu_prevUnreadMsg', 'menu_goForward',
      'menu_goBack', 'goStartPage', 'newMsgCmd', 'replyMainMenu',
      'replySenderMainMenu', 'replyNewsgroupMainMenu', 'menu_replyToAll',
      'menu_replyToList', 'menu_forwardMsg', 'forwardAsMenu',
      'menu_editMsgAsNew', 'openMessageWindowMenuitem',
      'openConversationMenuitem', 'moveMenu', 'copyMenu', 'moveToFolderAgain',
      'tagMenu', 'markMenu', 'markReadMenuItem', 'menu_markThreadAsRead',
      'menu_markReadByDate', 'menu_markAllRead', 'markFlaggedMenuItem',
      'menu_markAsJunk', 'menu_markAsNotJunk', 'createFilter', 'killThread',
      'killSubthread', 'watchThread', 'applyFilters', 'runJunkControls',
      'deleteJunk', 'menu_import', 'searchMailCmd', 'searchAddressesCmd',
      'filtersCmd', 'cmd_close', 'minimizeWindow', 'appmenu_markMenu',
      'zoomWindow', 'appmenu_replyMainMenu', 'appmenu_replyNewsgroupMainMenu',
      'appmenu_newFolder', 'appmenu_newMailAccountMenuItem', 'appmenu_close',
      'appmenu_newAccountMenuItem', 'appmenu_saveAs', 'appmenu_saveAsFile',
      'appmenu_newVirtualFolder', 'appmenu_viewBodyMenu', 'appmenu_goNextMenu',
      'appmenu_findAgainCmd', 'appmenu_sendUnsentMsgs', 'appmenu_charsetMenu',
      'appmenu_deleteFolder', 'appmenu_renameFolder', 'appmenu_favoriteFolder',
      'appmenu_properties', 'appmenu_MessagePaneLayout', 'appmenu_showMessage',
      'appmenu_showFolderPane', 'appmenu_FolderViews', 'appmenu_viewSortMenu',
      'appmenu_groupBySort', 'appmenu_viewMessageViewMenu', 'appmenu_subscribe',
      'appmenu_viewMessagesMenu', 'appmenu_expandAllThreads', 'appmenu_findCmd',
      'appmenu_collapseAllThreads', 'appmenu_viewHeadersMenu', 'appmenu_find',
      'appmenu_viewAttachmentsInlineMenuitem', 'appmenu_replySenderMainMenu',
      'appmenu_nextMsg', 'appmenu_nextUnreadMsg', 'appmenu_nextUnreadThread',
      'appmenu_goPreviousMenu', 'appmenu_prevMsg', 'appmenu_prevUnreadMsg',
      'appmenu_goForward', 'appmenu_goBack', 'appmenu_goStartPage',
      'appmenu_newMsgCmd', 'appmenu_viewFullZoomMenu', 'appmenu_replyToAll',
      'appmenu_replyToList', 'appmenu_forwardMsg', 'appmenu_forwardAsMenu',
      'appmenu_editMsgAsNew', 'appmenu_tagMenu', 'appmenu_moveToFolderAgain',
      'appmenu_openMessageWindowMenuitem', 'appmenu_openConversationMenuitem',
      'appmenu_moveMenu', 'appmenu_copyMenu', 'appmenu_createFilter',
      'appmenu_killThread', 'appmenu_killSubthread'];

  let element;
  for (let id of disabledItems)
  {
    element = document.getElementById(id);
    if (element)
      element.setAttribute("disabled", "true");
  }

  // Also hide the window-list separator if it exists.
  element = document.getElementById("sep-window-list");
  if (element)
    element.setAttribute("hidden", "true");
}
