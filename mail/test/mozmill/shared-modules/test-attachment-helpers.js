/* ***** BEGIN LICENSE BLOCK *****
 *   Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * The Original Code is Thunderbird Mail Client.
 *
 * The Initial Developer of the Original Code is
 * the Mozilla Foundation.
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

var Ci = Components.interfaces;
var Cc = Components.classes;
var Cu = Components.utils;

const MODULE_NAME = "attachment-helpers";
const RELATIVE_ROOT = "../shared-modules";
const MODULE_REQUIRES = ['mock-object-helpers'];

Cu.import("resource://gre/modules/XPCOMUtils.jsm");

let gMockFilePickReg;

function setupModule(module) {
  let moh = collector.getModule('mock-object-helpers');

  gMockFilePickReg = new moh.MockObjectReplacer("@mozilla.org/filepicker;1",
                                                  MockFilePickerConstructor);
}

function installInto(module) {
  setupModule(module);

  // Now copy helper functions
  module.create_body_part = create_body_part;
  module.create_detached_attachment = create_detached_attachment;
  module.create_deleted_attachment = create_deleted_attachment;
  module.gMockFilePickReg = gMockFilePickReg;
  module.gMockFilePicker = gMockFilePicker;
  module.select_attachments = select_attachments;
}

function MockFilePickerConstructor() {
  return gMockFilePicker;
};

let gMockFilePicker = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFilePicker]),
  defaultExtension: "",
  filterIndex: null,
  displayDirectory: null,
  returnFiles: [],
  addToRecentDocs: false,

  get defaultString() {
    throw Cr.NS_ERROR_FAILURE;
  },

  get fileURL() {
    return null;
  },

  get file() {
    if (this.returnFiles.length >= 1)
      return this.returnFiles[0];
    return null;
  },

  get files() {
    let self = this;
    return {
      index: 0,
      QueryInterface: XPCOMUtils.generateQI([Ci.nsISimpleEnumerator]),
      hasMoreElements: function() {
        return this.index < self.returnFiles.length;
      },
      getNext: function() {
        return self.returnFiles[this.index++];
      }
    }
  },

  init: function gMFP_init(aParent, aTitle, aMode) {
  },

  appendFilters: function gMFP_appendFilters(aFilterMask) {
  },

  appendFilter: function gMFP_appendFilter(aTitle, aFilter) {
  },

  show: function gMFP_show() {
    return Ci.nsIFilePicker.returnOK;
  },

  set defaultString(aVal) {
  },
}

/**
 * Create a body part with attachments for the message generator
 *
 * @param body the text of the main body of the message
 * @param attachments an array of attachment objects (as strings)
 * @param boundary an optional string defining the boundary of the parts
 * @return an object suitable for passing as the |bodyPart| for create_message
 */
function create_body_part(body, attachments, boundary)
{
  if (!boundary)
    boundary = "------------CHOPCHOP";

  return {
    contentTypeHeaderValue:
      "multipart/mixed;\r\n boundary=\"" + boundary + "\"",
    toMessageString: function() {
      let str = "This is a multi-part message in MIME format.\r\n" +
                "--" + boundary + "\r\n" +
                "Content-Type: text/plain; charset=ISO-8859-1; " +
                  "format=flowed\r\n" +
                "Content-Transfer-Encoding: 7bit\r\n\r\n" + body + "\r\n\r\n";

      for (let i = 0; i < attachments.length; i++)
        str += "--" + boundary + "\r\n" + attachments[i] + "\r\n";

      str += "--" + boundary + "--";
      return str;
    }
  };
}

function help_create_detached_deleted_attachment(filename, type) {
  return "You deleted an attachment from this message. The original MIME " +
           "headers for the attachment were:\r\n" +
         "Content-Type: " + type + ";\r\n" +
         " name=\"" + filename + "\"\r\n" +
         "Content-Transfer-Encoding: 7bit\r\n" +
         "Content-Disposition: attachment;\r\n" +
         " filename=\"" + filename + "\"\r\n\r\n";
}

/**
 * Create the raw data for a detached attachment
 *
 * @param file an nsIFile for the external file for thie attachment
 * @param type the content type
 * @return a string representing the attachment
 */
function create_detached_attachment(file, type) {
  let fileHandler = Services.io.getProtocolHandler("file")
                            .QueryInterface(Ci.nsIFileProtocolHandler);
  let url = fileHandler.getURLSpecFromFile(file);
  let filename = file.leafName;

  let str = "Content-Type: text/plain;\r\n name=\"" + filename + "\"\r\n" +
            "Content-Disposition: attachment; filename=\"" + filename +
              "\"\r\n" +
            "X-Mozilla-External-Attachment-URL: " + url + "\r\n" +
            "X-Mozilla-Altered: AttachmentDetached; date=\"" +
              "Wed Oct 06 17:28:24 2010\"\r\n\r\n";

  str += help_create_detached_deleted_attachment(filename, type);
  return str;
}

/**
 * Create the raw data for a deleted attachment
 *
 * @param filename the "original" filename
 * @param type the content type
 * @return a string representing the attachment
 */
function create_deleted_attachment(filename, type) {
  let str = "Content-Type: text/x-moz-deleted; name=\"Deleted: " + filename +
              "\"\r\n" +
            "Content-Transfer-Encoding: 8bit\r\n" +
            "Content-Disposition: inline; filename=\"Deleted: " + filename +
              "\"\r\n" +
            "X-Mozilla-Altered: AttachmentDeleted; date=\""
              "Wed Oct 06 17:28:24 2010\"\r\n\r\n";
  str += help_create_detached_deleted_attachment(filename, type);
  return str;
}

/**
 * A helper function that selects either one, or a continuous range
 * of items in the attachment list.
 *
 * @param aController a composer window controller
 * @param aIndexStart the index of the first item to select
 * @param aIndexEnd (optional) the index of the last item to select
 */
function select_attachments(aController, aIndexStart, aIndexEnd) {
  let bucket = aController.e("attachmentBucket");
  bucket.clearSelection();

  if (aIndexEnd !== undefined) {
    let startItem = bucket.getItemAtIndex(aIndexStart);
    let endItem = bucket.getItemAtIndex(aIndexEnd);
    bucket.selectItemRange(startItem, endItem);
  } else {
    bucket.selectedIndex = aIndexStart;
  }

  bucket.focus();
  return bucket.selectedItems;
}


