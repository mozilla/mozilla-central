/**
 * Test whether javascript in a local message works.
 * 
 * @note This assumes an existing local account, and will cause the Trash
 * folder of that account to be emptied multiple times.
 */

// 
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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2001
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Dan Mosedale <dmose@mozilla.org>
 *   Joey Minta <jminta@gmail.com>
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

// XXXdmose MozMill doesn't have much asynchronicity support in it yet.  Once
// that changes, we should be able to more thoroughly test that there aren't
// any races here.  As it stands, we use controller.sleep() a lot to wait for
// things to finish loading before proceeding.  Some of those calls could
// probably be replaced with waitForEval/waitForPageLoad or a hypothetical
// waitForEvent.

var controller = {};
Components.utils.import('resource://mozmill/modules/controller.js', controller);

var jum = {}; 
Components.utils.import('resource://mozmill/modules/jum.js', jum);

Components.utils.import("resource://gre/modules/iteratorUtils.jsm");

var mainWindow = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                            .getService(Components.interfaces.nsIWindowMediator)
                            .getMostRecentWindow("mail:3pane");
var MC = new controller.MozMillController(mainWindow);

function addToFolder(aSubject, aBody, aFolder) {
  
  let msgId = Components.classes["@mozilla.org/uuid-generator;1"]
                          .getService(Components.interfaces.nsIUUIDGenerator)
                          .generateUUID() +"@mozillamessaging.com";

  let source = "From - Sat Nov  1 12:39:54 2008\n" +
               "X-Mozilla-Status: 0001\n" +
               "X-Mozilla-Status2: 00000000\n" +
               "Message-ID: <" + msgId + ">\n" +
               "Date: Wed, 11 Jun 2008 20:32:02 -0400\n" +
               "From: Tester <tests@mozillamessaging.com>\n" +
               "User-Agent: Thunderbird 3.0a2pre (Macintosh/2008052122)\n" +
               "MIME-Version: 1.0\n" +
               "To: recipient@mozillamessaging.com\n" +
               "Subject: " + aSubject + "\n" +
               "Content-Type: text/html; charset=ISO-8859-1\n" +
               "Content-Transfer-Encoding: 7bit\n" +
               "\n" + aBody + "\n";

  aFolder.QueryInterface(Components.interfaces.nsIMsgLocalMailFolder);
  aFolder.gettingNewMessages = true;
  
  // XXX this causes an identity NS_WARNING for unknown reasons
  aFolder.addMessage(source);
  aFolder.gettingNewMessages = false;
  aFolder.updateFolder(mainWindow.msgWindow);

  return aFolder.msgDatabase.getMsgHdrForMessageID(msgId);
}

const jsMsgBody = '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">\n' +
'<html>\n' +
'<head>\n' +
'\n' +
'<meta http-equiv="content-type" content="text/html; charset=ISO-8859-1">\n' +
'</head>\n' +
'<body bgcolor="#ffffff" text="#000000">\n' +
'this is a test<big><big><big> stuff\n' +
'<br><br>\n' +
'</big></big></big>\n' +
'<script language="javascript"/>\n'+
'var jsIsTurnedOn = true;\n' +
'</script>\n' +
'\n' +
'</body>\n' +
'</html>\n';

var Cc = Components.classes;
var Ci = Components.interfaces;

const kTestFolderName = "testFolder";

let am = Cc["@mozilla.org/messenger/account-manager;1"].
    getService(Ci.nsIMsgAccountManager);

let localRootFolder = am.localFoldersServer.rootFolder;

function ensureFreshTestFolder() {

  //delete any existing test folder
  try {
    // get trash folder
    let trashFolder = localRootFolder.getChildNamed("Trash");

    // empty it without prompting
    trashFolder.emptyTrash(mainWindow.msgWindow, null);
    
    // try and get any existing test folder
    let oldFolder = localRootFolder.getChildNamed(kTestFolderName);

    // blow it away
    let array = toXPCOMArray([oldFolder], Ci.nsIMutableArray);
    oldFolder.parent.deleteSubFolders(array, null);
  } catch (ex) {
    dump("ignoring old folder deletion exception" + ex + "\n");
  }

  try {
    localRootFolder.createSubfolder(kTestFolderName, mainWindow.msgWindow);
  } catch (ex) {
    dump("ignoring createSubfolder exception\n");
  }

  return localRootFolder.findSubFolder(kTestFolderName);
}

let gMsgNo = 0;

function checkJsInMail(aLocalTestFolder) { 

  let msgDbHdr = addToFolder("JS test message " + gMsgNo, jsMsgBody, 
    aLocalTestFolder);

  // select the newly created message
  mainWindow.GetThreadTree().view.selection.select(gMsgNo);
  MC.sleep(10000);

  jum.assertUndefined(mainWindow.content.wrappedJSObject.jsIsTurnedOn);

  ++gMsgNo;
  return;
}

function checkJsInNonMessageContent() {

  // get rid of the header pane to make the display less confusing
  // to developers debugging this test.
  // XXX should perhaps clear the threadpane selection too for the same reason
  mainWindow.HideMessageHeaderPane();

  // load something non-message-like in the message pane
  mainWindow.GetMessagePaneFrame().location.href =
    "data:text/html;charset=utf-8,<script>jsIsTurnedOn%3Dtrue%3B<%2Fscript>bar";
  MC.sleep(10000);

  jum.assertTrue(mainWindow.content.wrappedJSObject.jsIsTurnedOn);
  return;
}

// run each test twice to ensure that there aren't any weird side effects,
// given that these loads all happen in the same docshell
function test_jsContentPolicy() {
  dump("test_jsContentPolicy() starting\n");
 
  // start from a known state.
  mainWindow.ClearMessagePane();
  MC.sleep(10000);

  // blow away any existing test folder and create a fresh one
  let localTestFolder = ensureFreshTestFolder();

  // XXXdmose icky workaround: if we don't select some other folder first,
  // selecting the test folder doesn't always cause the test folder to load,
  // perhaps because something thinks it has already loaded.  Perhaps this is
  // related to commandglue.js:FolderPaneSelectionChanged() goofiness.
  let inbox = localRootFolder.getChildNamed("Inbox");
  mainWindow.gFolderTreeView.selectFolder(inbox);

  // this starts the folder loading
  mainWindow.gFolderTreeView.selectFolder(localTestFolder);
  MC.sleep(10000);

  checkJsInMail(localTestFolder);
  checkJsInNonMessageContent();
  checkJsInMail(localTestFolder);
  checkJsInNonMessageContent();

  dump("finished test_jsContentPolicy()\n");
}
