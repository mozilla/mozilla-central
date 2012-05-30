/* -*- Mode: Java; tab-width: 4; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var gContextMenuNode;
var gContextMenuFiringDocumentElement;

function InitStructBarContextMenu(button, docElement)
{
  gContextMenuFiringDocumentElement = docElement;
  gContextMenuNode = button;

  var tag = docElement.nodeName.toLowerCase();

  var structRemoveTag = document.getElementById("structRemoveTag");
  var enableRemove;

  switch (tag) {
    case "body":
    case "tbody":
    case "thead":
    case "tfoot":
    case "col":
    case "colgroup":
    case "tr":
    case "th":
    case "td":
    case "caption":
      enableRemove = false;
      break;
    default:
      enableRemove = true;
      break;
  }
  SetElementEnabled(structRemoveTag, enableRemove);

  var structChangeTag = document.getElementById("structChangeTag");
  SetElementEnabled(structChangeTag, (tag != "body"));
}

function TableCellFilter(node)
{
  switch (node.nodeName.toLowerCase())
    {
    case "td":
    case "th":
    case "caption":
      return NodeFilter.FILTER_ACCEPT;
      break;
    default:
      return NodeFilter.FILTER_SKIP;
      break;
    }
  return NodeFilter.FILTER_SKIP;
}

function StructRemoveTag()
{
  var editor = GetCurrentEditor();
  if (!editor) return;

  var element = gContextMenuFiringDocumentElement;
  var offset = 0;
  var childNodes = element.parentNode.childNodes;

  while (childNodes[offset] != element) {
    ++offset;
  }

  editor.beginTransaction();

  try {

    var tag = element.nodeName.toLowerCase();
    if (tag != "table") {
      MoveChildNodesAfterElement(editor, element, element, offset);
    }
    else {

      var nodeIterator = document.createTreeWalker(element,
                                                   NodeFilter.SHOW_ELEMENT,
                                                   TableCellFilter,
                                                   true);
      var node = nodeIterator.lastChild();
      while (node) {
        MoveChildNodesAfterElement(editor, node, element, offset);
        node = nodeIterator.previousSibling();
      }

    }
    editor.deleteNode(element);
  }
  catch (e) {};

  editor.endTransaction();
}

function MoveChildNodesAfterElement(editor, element, targetElement, targetOffset)
{
  var childNodes = element.childNodes;
  var childNodesLength = childNodes.length;
  var i;
  for (i = childNodesLength - 1; i >= 0; i--) {
    var clone = childNodes.item(i).cloneNode(true);
    editor.insertNode(clone, targetElement.parentNode, targetOffset + 1);
  }
}

function StructChangeTag()
{
  var textbox = document.createElementNS(XUL_NS, "textbox");
  textbox.setAttribute("value", gContextMenuNode.getAttribute("value"));
  textbox.setAttribute("width", gContextMenuNode.boxObject.width);
  textbox.className = "struct-textbox";

  gContextMenuNode.parentNode.replaceChild(textbox, gContextMenuNode);

  textbox.addEventListener("keypress", OnKeyPress, false);
  textbox.addEventListener("blur", ResetStructToolbar, true);

  textbox.select();
}

function StructSelectTag()
{
  SelectFocusNodeAncestor(gContextMenuFiringDocumentElement);
}

function OpenAdvancedProperties()
{
  doAdvancedProperties(gContextMenuFiringDocumentElement);
}

function OnKeyPress(event)
{
  var editor = GetCurrentEditor();

  var keyCode = event.keyCode;
  if (keyCode == 13) {
    var newTag = event.target.value;

    var element = gContextMenuFiringDocumentElement;

    var offset = 0;
    var childNodes = element.parentNode.childNodes;
    while (childNodes.item(offset) != element) {
      offset++;
    }

    editor.beginTransaction();

    try {
      var newElt = editor.document.createElement(newTag);
      if (newElt) {
        childNodes = element.childNodes;
        var childNodesLength = childNodes.length;
        var i;
        for (i = 0; i < childNodesLength; i++) {
          var clone = childNodes.item(i).cloneNode(true);
          newElt.appendChild(clone);
        }
        editor.insertNode(newElt, element.parentNode, offset+1);
        editor.deleteNode(element);
        editor.selectElement(newElt);

        window.content.focus();
      }
    }
    catch (e) {}

    editor.endTransaction();

  }
  else if (keyCode == 27) {
    // if the user hits Escape, we discard the changes
    window.content.focus();
  }
}
