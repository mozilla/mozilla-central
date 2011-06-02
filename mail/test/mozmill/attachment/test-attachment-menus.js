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
 * The Original Code is Thunderbird test code
 *
 * The Initial Developer of the Original Code is
 * The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Jim Porter <squibblyflabbetydoo@gmail.com>
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

var MODULE_NAME = "test-attachment-menus";

var RELATIVE_ROOT = "../shared-modules";
var MODULE_REQUIRES = ["folder-display-helpers", "window-helpers",
                       "attachment-helpers"];

var folder;
var messenger;
var epsilon;

var elib = {};
Cu.import("resource://mozmill/modules/elementslib.js", elib);
var os = {};
Components.utils.import("resource://mozmill/stdlib/os.js", os);

const textAttachment =
  "Can't make the frug contest, Helen; stomach's upset. I'll fix you, " +
  "Ubik! Ubik drops you back in the thick of things fast. Taken as " +
  "directed, Ubik speeds relief to head and stomach. Remember: Ubik is " +
  "only seconds away. Avoid prolonged use.";

const detachedName = "./attachment.txt";
const missingName = "./nonexistent.txt";
const deletedName = "deleted.txt";

// create some messages that have various types of attachments
var messages = [
  { name: "regular_attachment",
    attachments: [{ body: textAttachment,
                    filename: "ubik.txt",
                    format: "" }],
    menuStates: [{ open: true, save: true, detach: true, delete_: true }],
    allMenuStates: { open: true, save: true, detach: true, delete_: true },
  },
  { name: "detached_attachment",
    bodyPart: null,
    menuStates: [{ open: true, save: true, detach: false, delete_: false }],
    allMenuStates: { open: true, save: true, detach: false, delete_: false },
  },
  { name: "detached_attachment_with_missing_file",
    bodyPart: null,
    menuStates: [{ open: false, save: false, detach: false, delete_: false }],
    allMenuStates: { open: false, save: false, detach: false, delete_: false },
  },
  { name: "deleted_attachment",
    bodyPart: null,
    menuStates: [{ open: false, save: false, detach: false, delete_: false }],
    allMenuStates: { open: false, save: false, detach: false, delete_: false },
  },
  { name: "multiple_attachments",
    attachments: [{ body: textAttachment,
                    filename: "ubik.txt",
                    format: "" },
                  { body: textAttachment,
                    filename: "ubik2.txt",
                    format: "" }],
    menuStates: [{ open: true, save: true, detach: true, delete_: true },
                 { open: true, save: true, detach: true, delete_: true }],
    allMenuStates: { open: true, save: true, detach: true, delete_: true },
  },
  { name: "multiple_attachments_one_detached",
    bodyPart: null,
    attachments: [{ body: textAttachment,
                    filename: "ubik.txt",
                    format: "" }],
    menuStates: [{ open: true, save: true, detach: false, delete_: false },
                 { open: true, save: true, detach: true, delete_: true }],
    allMenuStates: { open: true, save: true, detach: true, delete_: true },
  },
  { name: "multiple_attachments_one_detached_with_missing_file",
    bodyPart: null,
    attachments: [{ body: textAttachment,
                    filename: "ubik.txt",
                    format: "" }],
    menuStates: [{ open: false, save: false, detach: false, delete_: false },
                 { open: true, save: true, detach: true, delete_: true }],
    allMenuStates: { open: true, save: true, detach: true, delete_: true },
  },
  { name: "multiple_attachments_one_deleted",
    bodyPart: null,
    attachments: [{ body: textAttachment,
                    filename: "ubik.txt",
                    format: "" }],
    menuStates: [{ open: false, save: false, detach: false, delete_: false },
                 { open: true, save: true, detach: true, delete_: true }],
    allMenuStates: { open: true, save: true, detach: true, delete_: true },
  },
  { name: "multiple_attachments_all_detached",
    bodyPart: null,
    menuStates: [{ open: true, save: true, detach: false, delete_: false },
                 { open: true, save: true, detach: false, delete_: false }],
    allMenuStates: { open: true, save: true, detach: false, delete_: false },
  },
  { name: "multiple_attachments_all_detached_with_missing_files",
    bodyPart: null,
    menuStates: [{ open: false, save: false, detach: false, delete_: false },
                 { open: false, save: false, detach: false, delete_: false }],
    allMenuStates: { open: false, save: false, detach: false, delete_: false },
  },
  { name: "multiple_attachments_all_deleted",
    bodyPart: null,
    menuStates: [{ open: false, save: false, detach: false, delete_: false },
                 { open: false, save: false, detach: false, delete_: false }],
    allMenuStates: { open: false, save: false, detach: false, delete_: false },
  },
];

function setupModule(module) {
  let fdh = collector.getModule("folder-display-helpers");
  fdh.installInto(module);
  let wh = collector.getModule("window-helpers");
  wh.installInto(module);
  let ah = collector.getModule("attachment-helpers");
  ah.installInto(module);

  messenger = Components.classes["@mozilla.org/messenger;1"]
                        .createInstance(Components.interfaces.nsIMessenger);

  /* Today's gory details (thanks to Jonathan Protzenko): libmime somehow
   * counts the trailing newline for an attachment MIME part. Most of the time,
   * assuming attachment has N bytes (no matter what's inside, newlines or
   * not), libmime will return N + 1 bytes. On Linux and Mac, this always
   * holds. However, on Windows, if the attachment is not encoded (that is, is
   * inline text), libmime will return N + 2 bytes.
   */
  epsilon = ("@mozilla.org/windows-registry-key;1" in Components.classes) ? 2 : 1;

  // set up our detached/deleted attachments
  var thisFilePath = os.getFileForPath(__file__);

  var detachedFile = os.getFileForPath(os.abspath(detachedName, thisFilePath));
  var detached = create_body_part(
    "Here is a file",
    [create_detached_attachment(detachedFile, "text/plain")]
  );
  var multiple_detached = create_body_part(
    "Here are some files",
    [create_detached_attachment(detachedFile, "text/plain"),
     create_detached_attachment(detachedFile, "text/plain")]
  );

  var missingFile = os.getFileForPath(os.abspath(missingName, thisFilePath));
  var missing = create_body_part(
    "Here is a file (but you deleted the external file, you silly oaf!)",
    [create_detached_attachment(missingFile, "text/plain")]
  );
  var multiple_missing = create_body_part(
    "Here are some files (but you deleted the external files, you silly oaf!)",
    [create_detached_attachment(missingFile, "text/plain"),
     create_detached_attachment(missingFile, "text/plain")]
  );

  var deleted = create_body_part(
    "Here is a file that you deleted",
    [create_deleted_attachment(deletedName, "text/plain")]
  );
  var multiple_deleted = create_body_part(
    "Here are some files that you deleted",
    [create_deleted_attachment(deletedName, "text/plain"),
     create_deleted_attachment(deletedName, "text/plain")]
  );

  folder = create_folder("AttachmentMenusA");
  for (let i = 0; i < messages.length; i++) {
    // First, add any missing info to the message object.
    switch (messages[i].name) {
      case "detached_attachment":
      case "multiple_attachments_one_detached":
        messages[i].bodyPart = detached;
        break;
      case "multiple_attachments_all_detached":
        messages[i].bodyPart = multiple_detached;
        break;
      case "detached_attachment_with_missing_file":
      case "multiple_attachments_one_detached_with_missing_file":
        messages[i].bodyPart = missing;
        break;
      case "multiple_attachments_all_detached_with_missing_files":
        messages[i].bodyPart = multiple_missing;
        break;
      case "deleted_attachment":
      case "multiple_attachments_one_deleted":
        messages[i].bodyPart = deleted;
        break;
      case "multiple_attachments_all_deleted":
        messages[i].bodyPart = multiple_deleted;
        break;
    }

    add_message_to_folder(folder, create_message(messages[i]));
  }
}

/**
 * Ensure that the specified element is visible/hidden
 *
 * @param id the id of the element to check
 * @param visible true if the element should be visible, false otherwise
 */
function assert_shown(id, visible) {
  if (mc.e(id).hidden == visible)
    throw new Error('"' + id + '" should be ' +
                    (visible ? "visible" : "hidden"));
}

/**
 * Ensure that the specified element is enabled/disabled
 *
 * @param id the id of the element to check
 * @param enabled true if the element should be enabled, false otherwise
 */
function assert_enabled(id, enabled) {
  if (mc.e(id).disabled == enabled)
    throw new Error('"' + id + '" should be ' +
                    (enabled ? "enabled" : "disabled"));
}

/**
 * Check that the menu states in the "save" toolbar button are correct.
 *
 * @param expected a dictionary containing the expected states
 */
function check_toolbar_menu_states_single(expected) {
  assert_shown("attachmentSaveAllSingle", true);
  assert_shown("attachmentSaveAllMultiple", false);

  if (expected.save == false) {
    assert_enabled("attachmentSaveAllSingle", false);
  }
  else {
    assert_enabled("attachmentSaveAllSingle", true);
    mc.click(mc.aid("attachmentSaveAllSingle",
                    {"class": "toolbarbutton-menubutton-dropmarker"}));
    wait_for_popup_to_open(mc.e("attachmentSaveAllSingleMenu"));

    try {
      assert_enabled("button-openAttachment",   expected.open);
      assert_enabled("button-saveAttachment",   expected.save);
      assert_enabled("button-detachAttachment", expected.detach);
      assert_enabled("button-deleteAttachment", expected.delete_);
    }
    catch(e) {
      throw e;
    }
    finally {
      close_popup(mc, mc.eid("attachmentSaveAllSingleMenu"));
    }
  }
}

/**
 * Check that the menu states in the "save all" toolbar button are correct.
 *
 * @param expected a dictionary containing the expected states
 */
function check_toolbar_menu_states_multiple(expected) {
  assert_shown("attachmentSaveAllSingle", false);
  assert_shown("attachmentSaveAllMultiple", true);

  if (expected.save == false) {
    assert_enabled("attachmentSaveAllMultiple", false);
  }
  else {
    assert_enabled("attachmentSaveAllMultiple", true);
    mc.click(mc.aid("attachmentSaveAllMultiple",
                    {"class": "toolbarbutton-menubutton-dropmarker"}));
    wait_for_popup_to_open(mc.e("attachmentSaveAllMultipleMenu"));

    try {
      assert_enabled("button-openAllAttachments",   expected.open);
      assert_enabled("button-saveAllAttachments",   expected.save);
      assert_enabled("button-detachAllAttachments", expected.detach);
      assert_enabled("button-deleteAllAttachments", expected.delete_);
    }
    catch(e) {
      throw e;
    }
    finally {
      close_popup(mc, mc.eid("attachmentSaveAllMultipleMenu"));
    }
  }
}

/**
 * Check that the menu states in the single item context menu are correct
 *
 * @param expected a dictionary containing the expected states
 */
function check_menu_states_single(index, expected) {
  let attachmentList = mc.e("attachmentList");
  let node = new elib.Elem(attachmentList.children[index]);
  mc.click(node);
  mc.rightClick(node);
  wait_for_popup_to_open(mc.e("attachmentListContext"));

  try {
    assert_shown("context-openAttachment",   true);
    assert_shown("context-saveAttachment",   true);
    assert_shown("context-menu-separator",   true);
    assert_shown("context-detachAttachment", true);
    assert_shown("context-deleteAttachment", true);

    assert_shown("context-openAllAttachments",   false);
    assert_shown("context-saveAllAttachments",   false);
    assert_shown("context-menu-separator-all",   false);
    assert_shown("context-detachAllAttachments", false);
    assert_shown("context-deleteAllAttachments", false);

    assert_enabled("context-openAttachment",   expected.open);
    assert_enabled("context-saveAttachment",   expected.save);
    assert_enabled("context-detachAttachment", expected.detach);
    assert_enabled("context-deleteAttachment", expected.delete_);
  }
  catch(e) {
    throw e;
  }
  finally {
    close_popup(mc, mc.eid("attachmentListContext"));
  }
}

/**
 * Check that the menu states in the all items context menu are correct
 *
 * @param expected a dictionary containing the expected states
 */
function check_menu_states_all(expected) {
  mc.rightClick(mc.eid("attachmentList"));
  wait_for_popup_to_open(mc.e("attachmentListContext"));

  try {
    assert_shown("context-openAttachment",   false);
    assert_shown("context-saveAttachment",   false);
    assert_shown("context-menu-separator",   false);
    assert_shown("context-detachAttachment", false);
    assert_shown("context-deleteAttachment", false);

    assert_shown("context-openAllAttachments",   true);
    assert_shown("context-saveAllAttachments",   true);
    assert_shown("context-menu-separator-all",   true);
    assert_shown("context-detachAllAttachments", true);
    assert_shown("context-deleteAllAttachments", true);

    assert_enabled("context-openAllAttachments",   expected.open);
    assert_enabled("context-saveAllAttachments",   expected.save);
    assert_enabled("context-detachAllAttachments", expected.detach);
    assert_enabled("context-deleteAllAttachments", expected.delete_);
  }
  catch(e) {
    throw e;
  }
  finally {
    close_popup(mc, mc.eid("attachmentListContext"));
  }
}

function help_test_attachment_menus(index) {
  be_in_folder(folder);
  let curMessage = select_click_row(index);
  let expectedStates = messages[index].menuStates;

  mc.window.toggleAttachmentList(true);

  if (expectedStates.length == 1)
    check_toolbar_menu_states_single(messages[index].allMenuStates);
  else
    check_toolbar_menu_states_multiple(messages[index].allMenuStates);

  check_menu_states_all(messages[index].allMenuStates);
  for (let i = 0; i < expectedStates.length; i++)
    check_menu_states_single(i, expectedStates[i]);
}

// Generate a test for each message in |messages|.
for each (let [i, message] in Iterator(messages)) {
  let index = i; // make a copy to avoid passing a reference to i
  this["test_" + message.name] = function() {
    help_test_attachment_menus(index);
  };
}
