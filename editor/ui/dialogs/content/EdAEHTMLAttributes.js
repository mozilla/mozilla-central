/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

function BuildHTMLAttributeNameList()
{
  gDialog.AddHTMLAttributeNameInput.removeAllItems();
  
  var elementName = gElement.localName.toLowerCase();
  var attNames = gHTMLAttr[elementName];

  if (attNames && attNames.length)
  {
    var menuitem;

    for (var i = 0; i < attNames.length; i++)
    {
      var name = attNames[i];

      if (name == "_core")
      {
        // Signal to append the common 'core' attributes.
        for (var j = 0; j < gCoreHTMLAttr.length; j++)
        {
          name = gCoreHTMLAttr[j];

          // only filtering rule used for core attributes as of 8-20-01
          // Add more rules if necessary.
          if (name.contains("^"))
          {
            menuitem = gDialog.AddHTMLAttributeNameInput.appendItem(name.replace(/\^/g, ""));
            menuitem.setAttribute("limitFirstChar", "true");
          }
          else
            gDialog.AddHTMLAttributeNameInput.appendItem(name);
        }
      }
      else if (name == "-")
      {
        // Signal for separator
        var popup = gDialog.AddHTMLAttributeNameInput.firstChild;
        if (popup)
        {
          var sep = document.createElementNS(XUL_NS, "menuseparator");
          if (sep)
            popup.appendChild(sep);
        }        
      }
      else
      {
        // Get information about value filtering
        let forceOneChar = name.contains("!");
        let forceInteger = name.contains("#");
        let forceSignedInteger = name.contains("+");
        let forceIntOrPercent = name.contains("%");
        let limitFirstChar = name.contains("\^");
        //let required = name.contains("$");

        // Strip flag characters
        name = name.replace(/[!^#%$+]/g, "");

        menuitem = gDialog.AddHTMLAttributeNameInput.appendItem(name);
        if (menuitem)
        {
          // Signify "required" attributes by special style
          //TODO: Don't do this until next version, when we add
          //      explanatory text and an 'Autofill Required Attributes' button
          //if (required)
          //  menuitem.setAttribute("class", "menuitem-highlight-1");

          // Set flags to filter value input
          if (forceOneChar)
            menuitem.setAttribute("forceOneChar","true");
          if (limitFirstChar)
            menuitem.setAttribute("limitFirstChar", "true");
          if (forceInteger)
            menuitem.setAttribute("forceInteger", "true");
          if (forceSignedInteger)
            menuitem.setAttribute("forceSignedInteger", "true");
          if (forceIntOrPercent)
            menuitem.setAttribute("forceIntOrPercent", "true");
        }
      }
    }
  }
}

// build attribute list in tree form from element attributes
function BuildHTMLAttributeTable()
{
  var nodeMap = gElement.attributes;
  var i;
  if (nodeMap.length > 0) 
  {
    var added = false;
    for(i = 0; i < nodeMap.length; i++)
    {
      let name = nodeMap[i].name.trim().toLowerCase();
      if ( CheckAttributeNameSimilarity( nodeMap[i].nodeName, HTMLAttrs ) ||
           name.startsWith("on") || name == "style" ) {
        continue;   // repeated or non-HTML attribute, ignore this one and go to next
      }
      if (!name.startsWith("_moz") &&
          AddTreeItem(name, nodeMap[i].value, "HTMLAList", HTMLAttrs))
      {
        added = true;
      }
    }

    if (added)
      SelectHTMLTree(0);
  }
}

function ClearHTMLInputWidgets()
{
  gDialog.AddHTMLAttributeTree.view.selection.clearSelection();
  gDialog.AddHTMLAttributeNameInput.value ="";
  gDialog.AddHTMLAttributeValueInput.value = "";
  SetTextboxFocus(gDialog.AddHTMLAttributeNameInput);
}

function onSelectHTMLTreeItem()
{
  if (!gDoOnSelectTree)
    return;

  var tree = gDialog.AddHTMLAttributeTree;
  if (tree && tree.view.selection.count)
  {
    var inputName = TrimString(gDialog.AddHTMLAttributeNameInput.value).toLowerCase();
    var selectedItem = getSelectedItem(tree);
    var selectedName = selectedItem.firstChild.firstChild.getAttribute("label");

    if (inputName == selectedName)
    {
      // Already editing selected name - just update the value input
      gDialog.AddHTMLAttributeValueInput.value = GetTreeItemValueStr(selectedItem);
    }
    else
    {
      gDialog.AddHTMLAttributeNameInput.value = selectedName;

      // Change value input based on new selected name
      onInputHTMLAttributeName();
    }
  }
}

function onInputHTMLAttributeName()
{
  let attName = gDialog.AddHTMLAttributeNameInput.value.toLowerCase().trim();

  // Clear value widget, but prevent triggering update in tree
  gUpdateTreeValue = false;
  gDialog.AddHTMLAttributeValueInput.value = "";
  gUpdateTreeValue = true; 

  if (attName)
  {
    // Get value list for current attribute name
    var valueListName;

    // Most elements have the "dir" attribute,
    //   so we have just one array for the allowed values instead
    //   requiring duplicate entries for each element in EdAEAttributes.js
    if (attName == "dir")
      valueListName = "all_dir";
    else
      valueListName = gElement.localName.toLowerCase() + "_" + attName;

    // Strip off leading "_" we sometimes use (when element name is reserved word)
    if (valueListName.startsWith("_"))
      valueListName = valueListName.slice(1);

    var newValue = "";
    var listLen = 0;

    // Index to which widget we were using to edit the value
    var deckIndex = gDialog.AddHTMLAttributeValueDeck.getAttribute("selectedIndex");

    if (valueListName in gHTMLAttr)
    {
      var valueList = gHTMLAttr[valueListName];

      listLen = valueList.length;
      if (listLen == 1)
        newValue = valueList[0];

      // Note: For case where "value list" is actually just 
      // one (default) item, don't use menulist for that
      if (listLen > 1)
      {
        gDialog.AddHTMLAttributeValueMenulist.removeAllItems();

        if (deckIndex != "1")
        {
          // Switch to using editable menulist
          gDialog.AddHTMLAttributeValueInput = gDialog.AddHTMLAttributeValueMenulist;
          gDialog.AddHTMLAttributeValueDeck.setAttribute("selectedIndex", "1");
        }
        // Rebuild the list
        for (var i = 0; i < listLen; i++)
        {
          if (valueList[i] == "-")
          {
            // Signal for separator
            var popup = gDialog.AddHTMLAttributeValueInput.firstChild;
            if (popup)
            {
              var sep = document.createElementNS(XUL_NS, "menuseparator");
              if (sep)
                popup.appendChild(sep);
            }        
          } else {
            gDialog.AddHTMLAttributeValueMenulist.appendItem(valueList[i]);
          }
        }
      }
    }
    
    if (listLen <= 1 && deckIndex != "0")
    {
      // No list: Use textbox for input instead
      gDialog.AddHTMLAttributeValueInput = gDialog.AddHTMLAttributeValueTextbox;
      gDialog.AddHTMLAttributeValueDeck.setAttribute("selectedIndex", "0");
    }

    // If attribute already exists in tree, use associated value,
    //  else use default found above
    var existingValue = GetAndSelectExistingAttributeValue(attName, "HTMLAList");
    if (existingValue)
      newValue = existingValue;
      
    gDialog.AddHTMLAttributeValueInput.value = newValue;

    if (!existingValue)
      onInputHTMLAttributeValue();
  }
}

function onInputHTMLAttributeValue()
{
  if (!gUpdateTreeValue)
    return;

  var name = TrimString(gDialog.AddHTMLAttributeNameInput.value);
  if (!name)
    return;

  // Trim spaces only from left since we must allow spaces within the string
  //  (we always reset the input field's value below)
  var value = TrimStringLeft(gDialog.AddHTMLAttributeValueInput.value);
  if (value)
  {
    // Do value filtering based on type of attribute
    // (Do not use "forceInteger()" to avoid multiple
    //  resetting of input's value and flickering)
    var selectedItem = gDialog.AddHTMLAttributeNameInput.selectedItem;

    if (selectedItem)
    {
      if ( selectedItem.getAttribute("forceOneChar") == "true" &&
           value.length > 1 )
        value = value.slice(0, 1);

      if ( selectedItem.getAttribute("forceIntOrPercent") == "true" )
      {
        // Allow integer with optional "%" as last character
        var percent = TrimStringRight(value).slice(-1);
        value = value.replace(/\D+/g,"");
        if (percent == "%")
          value += percent;
      }
      else if ( selectedItem.getAttribute("forceInteger") == "true" )
      {
        value = value.replace(/\D+/g,"");
      }
      else if ( selectedItem.getAttribute("forceSignedInteger") == "true" )
      {
        // Allow integer with optional "+" or "-" as first character
        var sign = value[0];
        value = value.replace(/\D+/g,"");
        if (sign == "+" || sign == "-")
          value = sign + value;
      }
      
      // Special case attributes 
      if (selectedItem.getAttribute("limitFirstChar") == "true")
      {
        // Limit first character to letter, and all others to 
        //  letters, numbers, and a few others
        value = value.replace(/^[^a-zA-Z\u0080-\uFFFF]/, "").replace(/[^a-zA-Z0-9_\.\-\:\u0080-\uFFFF]+/g,'');
      }

      // Update once only if it changed
      if (value != gDialog.AddHTMLAttributeValueInput.value)
        gDialog.AddHTMLAttributeValueInput.value = value;
    }
  }

  // Update value in the tree list
  // If not found, add new attribute
  if (!UpdateExistingAttribute(name, value, "HTMLAList") && value)
    AddTreeItem(name, value, "HTMLAList", HTMLAttrs);
}

function editHTMLAttributeValue(targetCell)
{
  if (IsNotTreeHeader(targetCell))
    gDialog.AddHTMLAttributeValueInput.inputField.select();
}


// update the object with added and removed attributes
function UpdateHTMLAttributes()
{
  var HTMLAList = document.getElementById("HTMLAList");
  var i;

  // remove removed attributes
  for (i = 0; i < HTMLRAttrs.length; i++)
  {
    var name = HTMLRAttrs[i];

    if (gElement.hasAttribute(name))
      doRemoveAttribute(name);
  }

  // Set added or changed attributes
  for( i = 0; i < HTMLAList.childNodes.length; i++)
  {
    var item = HTMLAList.childNodes[i];
    doSetAttribute( GetTreeItemAttributeStr(item), GetTreeItemValueStr(item));
  }
}

function RemoveHTMLAttribute()
{
  var treechildren = gDialog.AddHTMLAttributeTree.lastChild;

  // We only allow 1 selected item
  if (gDialog.AddHTMLAttributeTree.view.selection.count)
  {
    var item = getSelectedItem(gDialog.AddHTMLAttributeTree);
    var attr = GetTreeItemAttributeStr(item);

    // remove the item from the attribute array
    HTMLRAttrs[HTMLRAttrs.length] = attr;
    RemoveNameFromAttArray(attr, HTMLAttrs);

    // Remove the item from the tree
    treechildren.removeChild(item);

    // Clear inputs and selected item in tree
    ClearHTMLInputWidgets();
  }
}

function SelectHTMLTree( index )
{

  gDoOnSelectTree = false;
  try {
    gDialog.AddHTMLAttributeTree.selectedIndex = index;
  } catch (e) {}
  gDoOnSelectTree = true;
}
