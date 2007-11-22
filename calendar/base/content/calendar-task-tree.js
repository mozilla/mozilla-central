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
 * The Original Code is OEone Calendar Code, released October 31st, 2001.
 *
 * The Initial Developer of the Original Code is
 * OEone Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): Garth Smedley <garths@oeone.com>
 *                 Mike Potter <mikep@oeone.com>
 *                 Chris Charabaruk <coldacid@meldstar.com>
 *                 Colin Phillips <colinp@oeone.com>
 *                 ArentJan Banck <ajbanck@planet.nl>
 *                 Curtis Jewell <csjewell@mail.freeshell.org>
 *                 Eric Belhaire <eric.belhaire@ief.u-psud.fr>
 *                 Mark Swaffer <swaff@fudo.org>
 *                 Michael Buettner <michael.buettner@sun.com>
 *                 Philipp Kewisch <mozilla@kewis.ch>
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

function changeContextMenuForTask(event) {

   if (event.target.id != "taskitem-context-menu" || !document.popupNode)
     return;

   var tree = document.popupNode;
   var task = tree.mTreeView._getItemFromEvent(event);

   // If only one task is selected, enable 'Edit Task'
   var start = new Object();
   var end = new Object();
   var numRanges = tree.mTreeView.selection.getRangeCount();
   tree.mTreeView.selection.getRangeAt(0, start, end);
   if (numRanges == 1 && (start.value == end.value) && task) {
       document.getElementById("task-context-menu-modify")
               .removeAttribute("disabled");
       tree.contextTask = task;
   } else {
       document.getElementById("task-context-menu-modify")
               .setAttribute("disabled", "true");
       tree.contextTask = null;
   }

   // If no task is selected, disable 'Delete Task'
   if (task) {
       document.getElementById("task-context-menu-delete")
               .removeAttribute("disabled");
   } else {
       document.getElementById("task-context-menu-delete")
               .setAttribute("disabled", "true");
   }

   // make progress and priority popup menu visible
   document.getElementById("is_editable").removeAttribute("hidden");

   // enable/disable progress and priority popup menus
   if (task) {
      document.getElementById("is_editable").removeAttribute("disabled");
      var liveList = document.getElementById("taskitem-context-menu")
                             .getElementsByAttribute("checked", "true");
      // Delete in reverse order.  Moz1.8+ getElementsByAttribute list is
      // 'live', so when attribute is deleted the indexes of later elements
      // change, but Moz1.7- is not.  Reversed order works with both.
      for (var i = liveList.length - 1; i >= 0; i-- ) {
         liveList.item(i).removeAttribute("checked");
      }

      if (document.getElementById("percent-" + task.percentComplete+"-menuitem")) {
         document.getElementById("percent-" + task.percentComplete+"-menuitem")
                 .setAttribute("checked", "true");
      }
   
      if (document.getElementById("priority-" + task.priority+"-menuitem")) {
         document.getElementById("priority-" + task.priority+"-menuitem")
                 .setAttribute("checked", "true");
      }
   } else {
      document.getElementById("is_editable").setAttribute("disabled", "true");
   }
}

function contextChangeProgress(event, Progress) {
   var tree = document.popupNode;
   var start = new Object();
   var end = new Object();
   var numRanges = tree.mTreeView.selection.getRangeCount();
   if(numRanges == 0) {
      return;
   }
   startBatchTransaction();
   for (var t = 0; t < numRanges; t++) {
      tree.mTreeView.selection.getRangeAt(t, start, end);
      for (var v = start.value; v <= end.value; v++) {
          var task = tree.getTaskAtRow(v);
          var newTask = task.clone().QueryInterface( Components.interfaces.calITodo );
          newTask.percentComplete = Progress;
          switch (Progress) {
              case 0:
                  newTask.isCompleted = false;
                  break;
              case 100:
                  newTask.isCompleted = true;
                  break;
              default:
                  newTask.status = "IN-PROCESS";
                  newTask.completedDate = null;
                  break;
          }
          doTransaction('modify', newTask, newTask.calendar, task, null);
      }
   }
   endBatchTransaction();
}

function contextChangePriority(event, Priority) {
   var tree = document.popupNode;
   var start = new Object();
   var end = new Object();
   var numRanges = tree.mTreeView.selection.getRangeCount();
   if(numRanges == 0) {
      return;
   }
   startBatchTransaction();
   for (var t = 0; t < numRanges; t++) {
      tree.mTreeView.selection.getRangeAt(t, start, end);
      for (var v = start.value; v <= end.value; v++) {
          var task = tree.getTaskAtRow(v);
          var newTask = task.clone().QueryInterface( Components.interfaces.calITodo );
          newTask.priority = Priority;
          doTransaction('modify', newTask, newTask.calendar, task, null);
      }
   }
   endBatchTransaction();
}

function modifyTaskFromContext() {
   var tree = document.popupNode;
   var task = tree.contextTask;
   if(task) {
        modifyEventWithDialog(task);
   }
}

/**
 *  Delete the current selected item with focus from the task tree
 */
function deleteToDoCommand(aDoNotConfirm) {
   if (!document.popupNode)
     return;
   var tree = document.popupNode;
   var numRanges = tree.mTreeView.selection.getRangeCount();
   var selectedItems = [];
   var start = {};
   var end = {};
   for (var t=0; t<numRanges; t++) {
      tree.mTreeView.selection.getRangeAt(t, start, end);
      for (var v = start.value; v <= end.value; v++) {
         selectedItems.push(tree.getTaskAtRow(v));
      }
   }
   calendarViewController.deleteOccurrences(selectedItems.length,
                                            selectedItems,
                                            false,
                                            aDoNotConfirm);
   tree.mTreeView.selection.clearSelection();
}
