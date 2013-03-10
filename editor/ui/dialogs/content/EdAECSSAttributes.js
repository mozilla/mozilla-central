/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// build attribute list in tree form from element attributes
function BuildCSSAttributeTable()
{
  var style = gElement.style;
  if (style == undefined)
  {
    dump("Inline styles undefined\n");
    return;
  }

  var declLength = style.length;

  if (declLength == undefined || declLength == 0)
  {
    if (declLength == undefined) {
      dump("Failed to query the number of inline style declarations\n");
    }

    return;
  }

  if (declLength > 0)
  {
    for (var i = 0; i < declLength; ++i)
    {
      var name = style.item(i);
      var value = style.getPropertyValue(name);
      AddTreeItem( name, value, "CSSAList", CSSAttrs );
    }
  }

  ClearCSSInputWidgets();
}

function onChangeCSSAttribute()
{
  var name = TrimString(gDialog.AddCSSAttributeNameInput.value);
  if ( !name )
    return;

  var value = TrimString(gDialog.AddCSSAttributeValueInput.value);

  // First try to update existing attribute
  // If not found, add new attribute
  if ( !UpdateExistingAttribute( name, value, "CSSAList" ) && value)
    AddTreeItem( name, value, "CSSAList", CSSAttrs );
}

function ClearCSSInputWidgets()
{
  gDialog.AddCSSAttributeTree.view.selection.clearSelection();
  gDialog.AddCSSAttributeNameInput.value ="";
  gDialog.AddCSSAttributeValueInput.value = "";
  SetTextboxFocus(gDialog.AddCSSAttributeNameInput);
}

function onSelectCSSTreeItem()
{
  if (!gDoOnSelectTree)
    return;

  var tree = gDialog.AddCSSAttributeTree;
  if (tree && tree.view.selection.count)
  {
    gDialog.AddCSSAttributeNameInput.value = GetTreeItemAttributeStr(getSelectedItem(tree));
    gDialog.AddCSSAttributeValueInput.value = GetTreeItemValueStr(getSelectedItem(tree));
  }
}

function onInputCSSAttributeName()
{
  var attName = TrimString(gDialog.AddCSSAttributeNameInput.value).toLowerCase();
  var newValue = "";

  var existingValue = GetAndSelectExistingAttributeValue(attName, "CSSAList");
  if (existingValue)
    newValue = existingValue;

  gDialog.AddCSSAttributeValueInput.value = newValue;
}

function editCSSAttributeValue(targetCell)
{
  if (IsNotTreeHeader(targetCell))
    gDialog.AddCSSAttributeValueInput.inputField.select();
}

function UpdateCSSAttributes()
{
  var CSSAList = document.getElementById("CSSAList");
  var styleString = "";
  for(var i = 0; i < CSSAList.childNodes.length; i++)
  {
    var item = CSSAList.childNodes[i];
    var name = GetTreeItemAttributeStr(item);
    var value = GetTreeItemValueStr(item);
    // this code allows users to be sloppy in typing in values, and enter
    // things like "foo: " and "bar;". This will trim off everything after the
    // respective character.
    if (name.contains(":"))
      name = name.substring(0, name.lastIndexOf(":"));
    if (value.contains(";"))
      value = value.substring(0, value.lastIndexOf(";"));
    if (i == (CSSAList.childNodes.length - 1))
      styleString += name + ": " + value + ";";   // last property
    else
      styleString += name + ": " + value + "; ";
  }
  if (styleString)
  {
    // Use editor transactions if modifying the element directly in the document
    doRemoveAttribute("style");
    doSetAttribute("style", styleString);  // NOTE BUG 18894!!!
  } 
  else if (gElement.getAttribute("style"))
    doRemoveAttribute("style");
}

function RemoveCSSAttribute()
{
  var treechildren = gDialog.AddCSSAttributeTree.lastChild;

  // We only allow 1 selected item
  if (gDialog.AddCSSAttributeTree.view.selection.count)
  {
    var item = getSelectedItem(gDialog.AddCSSAttributeTree);

    // Remove the item from the tree
    // We always rebuild complete "style" string,
    //  so no list of "removed" items 
    treechildren.removeChild (item);

    ClearCSSInputWidgets();
  }
}

function SelectCSSTree( index )
{
  gDoOnSelectTree = false;
  try {
    gDialog.AddCSSAttributeTree.selectedIndex = index;
  } catch (e) {}
  gDoOnSelectTree = true;
}
