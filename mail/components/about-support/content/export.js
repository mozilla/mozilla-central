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
 * The Original Code is aboutSupport.xhtml.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Foundation
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Curtis Bartley <cbartley@mozilla.com>
 *   Siddharth Agarwal <sid.bugzilla@gmail.com>
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


/**
 * Create warning text to add to any private data.
 * @returns A HTML paragraph node containing the warning.
 */
function createWarning() {
  let bundle = Services.strings.createBundle(
    "chrome://messenger/locale/aboutSupportMail.properties");
  return createParentElement("p", [
    createElement("strong", bundle.GetStringFromName("warningLabel")),
    // Add some whitespace between the label and the text
    document.createTextNode(" "),
    document.createTextNode(bundle.GetStringFromName("warningText")),
  ]);
}

function getClipboardTransferable() {
  // Get the HTML and text representations for the important part of the page.
  let hidePrivateData = !document.getElementById("check-show-private-data").checked;
  let contentsDiv = createCleanedUpContents(hidePrivateData);
  let dataHtml = contentsDiv.innerHTML;
  let dataText = createTextForElement(contentsDiv, hidePrivateData);

  // We can't use plain strings, we have to use nsSupportsString.
  let supportsStringClass = Cc["@mozilla.org/supports-string;1"];
  let ssHtml = supportsStringClass.createInstance(Ci.nsISupportsString);
  let ssText = supportsStringClass.createInstance(Ci.nsISupportsString);

  let transferable = Cc["@mozilla.org/widget/transferable;1"]
                       .createInstance(Ci.nsITransferable);

  // Add the HTML flavor.
  transferable.addDataFlavor("text/html");
  ssHtml.data = dataHtml;
  transferable.setTransferData("text/html", ssHtml, dataHtml.length * 2);

  // Add the plain text flavor.
  transferable.addDataFlavor("text/unicode");
  ssText.data = dataText;
  transferable.setTransferData("text/unicode", ssText, dataText.length * 2);

  return transferable;
}

function copyToClipboard() {
  let transferable = getClipboardTransferable();
  // Store the data into the clipboard.
  let clipboard = Cc["@mozilla.org/widget/clipboard;1"]
                    .getService(Ci.nsIClipboard);
  clipboard.setData(transferable, null, clipboard.kGlobalClipboard);
}

function sendViaEmail() {
  // Get the HTML representation for the important part of the page.
  let hidePrivateData = !document.getElementById("check-show-private-data").checked;
  let contentsDiv = createCleanedUpContents(hidePrivateData);
  let dataHtml = contentsDiv.innerHTML;
  // The editor considers whitespace to be significant, so replace all
  // whitespace with a single space.
  dataHtml = dataHtml.replace(/\s+/g, " ");

  // Set up parameters and fields to use for the compose window.
  let params = Cc["@mozilla.org/messengercompose/composeparams;1"]
                 .createInstance(Ci.nsIMsgComposeParams);
  params.type = Ci.nsIMsgCompType.New;
  params.format = Ci.nsIMsgCompFormat.HTML;

  let fields = Cc["@mozilla.org/messengercompose/composefields;1"]
                 .createInstance(Ci.nsIMsgCompFields);
  fields.forcePlainText = false;
  fields.body = dataHtml;
  // In general we can have non-ASCII characters, and compose's charset
  // detection doesn't seem to work when the HTML part is pure ASCII but the
  // text isn't. So take the easy way out and force UTF-8.
  fields.characterSet = "UTF-8";
  fields.bodyIsAsciiOnly = false;
  params.composeFields = fields;

  // Our params are set up. Now open a compose window.
  MailServices.compose.OpenComposeWindowWithParams(null, params);
}

function createCleanedUpContents(aHidePrivateData) {
  // Get the important part of the page.
  let contentsDiv = document.getElementById("contents");
  // Deep-clone the entire div.
  let clonedDiv = contentsDiv.cloneNode(true);
  // Go in and replace text with the text we actually want to copy.
  // (this mutates the cloned node)
  cleanUpText(clonedDiv, aHidePrivateData);
  // Insert a warning if we need to
  if (!aHidePrivateData)
    clonedDiv.insertBefore(createWarning(), clonedDiv.firstChild);
  return clonedDiv;
}

function cleanUpText(aElem, aHidePrivateData) {
  let node = aElem.firstChild;
  while (node) {
    let className = ("className" in node && node.className) || "";
    // Delete uionly nodes.
    if (className.indexOf(CLASS_DATA_UIONLY) != -1) {
      // Advance to the next node before removing the current node, since
      // node.nextSibling is null after removeChild
      let nextNode = node.nextSibling;
      aElem.removeChild(node);
      node = nextNode;
      continue;
    }
    // Replace private data with a blank string
    else if (aHidePrivateData && className.indexOf(CLASS_DATA_PRIVATE) != -1) {
      node.textContent = "";
    }
    // Replace public data with a blank string
    else if (!aHidePrivateData && className.indexOf(CLASS_DATA_PUBLIC) != -1) {
      node.textContent = "";
    }
    else {
      // Replace localized text with non-localized text
      let copyData = node.getUserData("copyData");
      if (copyData != null)
        node.textContent = copyData;
    }

    if (node.nodeType == Node.ELEMENT_NODE)
      cleanUpText(node, aHidePrivateData);

    // Advance!
    node = node.nextSibling;
  }
}

// Return the plain text representation of an element.  Do a little bit
// of pretty-printing to make it human-readable.
function createTextForElement(elem, aHidePrivateData) {
  // Generate the initial text.
  let textFragmentAccumulator = [];
  generateTextForElement(elem, aHidePrivateData, "", textFragmentAccumulator);
  let text = textFragmentAccumulator.join("");

  // Trim extraneous whitespace before newlines, then squash extraneous
  // blank lines.
  text = text.replace(/[ \t]+\n/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  // Actual CR/LF pairs are needed for some Windows text editors.
  if ("@mozilla.org/windows-registry-key;1" in Cc)
    text = text.replace(/\n/g, "\r\n");

  return text;
}

/**
 * Elements to replace entirely with custom text. Keys are element ids, values
 * are functions that return the text. The functions themselves are defined in
 * the files for their respective sections.
 */
var gElementsToReplace = {
  "accounts-table": getAccountsText,
  "extensions-table": getExtensionsText,
};

function generateTextForElement(elem, aHidePrivateData, indent,
                                textFragmentAccumulator) {
  // Add a little extra spacing around most elements.
  if (["td", "th", "span", "a"].indexOf(elem.tagName) == -1)
    textFragmentAccumulator.push("\n");

  // If this element is one of our elements to replace with text, do it.
  if (elem.id in gElementsToReplace) {
    let replaceFn = gElementsToReplace[elem.id];
    textFragmentAccumulator.push(replaceFn(aHidePrivateData, indent + "  "));
    return;
  };

  let childCount = elem.childElementCount;

  // We're not going to spread a two-column <tr> across multiple lines, so
  // handle that separately.
  if (elem.tagName == "tr" && childCount == 2) {
    textFragmentAccumulator.push(indent);
    textFragmentAccumulator.push(elem.children[0].textContent.trim() + ": " +
                                 elem.children[1].textContent.trim());
    return;
  }

  // Generate the text representation for each child node.
  let node = elem.firstChild;
  while (node) {
    if (node.nodeType == Node.TEXT_NODE) {
      // Text belonging to this element uses its indentation level.
      generateTextForTextNode(node, indent, textFragmentAccumulator);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
      // Recurse on the child element with an extra level of indentation (but
      // only if there's more than one child).
      generateTextForElement(node, aHidePrivateData,
                             indent + (childCount > 1 ? "  " : ""),
                             textFragmentAccumulator);
    }
    // Advance!
    node = node.nextSibling;
  }
}

function generateTextForTextNode(node, indent, textFragmentAccumulator) {
  // If the text node is the first of a run of text nodes, then start
  // a new line and add the initial indentation.
  let prevNode = node.previousSibling;
  if (!prevNode || prevNode.nodeType == Node.TEXT_NODE)
    textFragmentAccumulator.push("\n" + indent);

  // Trim the text node's text content and add proper indentation after
  // any internal line breaks.
  let text = node.textContent.trim().replace("\n", "\n" + indent, "g");
  textFragmentAccumulator.push(text);
}
