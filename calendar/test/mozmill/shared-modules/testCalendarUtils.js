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
 * The Original Code is Mozilla Mozmill Test Code.
 *
 * The Initial Developer of the Original Code is Merike Sell.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Merike Sell <merikes@gmail.com>
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

const MODULE_NAME = 'CalendarUtils';

const RELATIVE_ROOT = '.';
const MODULE_REQUIRES = ['ModalDialogAPI'];

const sleep = 500;

/**
 *  Accept to send notification email with event to attendees
 */
function acceptSendingNotificationMail(){
  let api = collector.getModule('ModalDialogAPI');
  let md = new api.modalDialog(
    function(dialog){
      dialog.waitThenClick(new elementslib.Lookup(dialog.window.document, '/id("commonDialog")/'
        + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
    }
  );
  md.start();
}

/**
 *  Add an attachment with url
 */
function handleAddingAttachment(url){
  let api = collector.getModule('ModalDialogAPI');
  let md = new api.modalDialog(
    function(attachment){
      attachment.sleep(sleep);
      attachment.type(new elementslib.Lookup(attachment.window.document, '/id("commonDialog")/[4]/'
        + '[1]/id("loginContainer")/id("loginTextbox")/anon({"class":"textbox-input-box"})/'
        + 'anon({"anonid":"input"})'), url);
      attachment.click(new elementslib.Lookup(attachment.window.document, '/id("commonDialog")/'
      + 'anon({"anonid":"buttons"})/{"dlgtype":"accept"}'));
    }
  );
  md.start();
}

/**
 *  Choose to delete just one occurrence of a repeating event
 */
function handleOccurrenceDeletion(){
  let api = collector.getModule('ModalDialogAPI');
  let md = new api.modalDialog(
    function(dialog){
      acceptSendingNotificationMail();
      dialog.waitThenClick(new elementslib.ID(dialog.window.document, "accept-occurrence-button"));
    }
  );
  md.start();
}

/**
 *  Choose to delete all occurrences of a repeating event
 */
function handleParentDeletion(){
  let api = collector.getModule('ModalDialogAPI');
  let md = new api.modalDialog(
    function(dialog){
      acceptSendingNotificationMail();
      dialog.waitThenClick(new elementslib.ID(dialog.window.document, "accept-parent-button"));
    }
  );
  md.start();
}
