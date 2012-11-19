/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Each tag entry in our list looks like this:
//    <listitem>
//      <listcell>
//        <textbox/>
//      </listcell>
//      <listcell>
//        <colorpicker type='button'/>
//      </listcell>
//    </listitem>
// For ease of handling, all tag data is stored in <listitem>.tagInfo also.

const kOrdinalCharLow  = "a";
const kOrdinalCharHigh = "z";
const kOrdinalPadding  = String.fromCharCode(kOrdinalCharLow.charCodeAt(0) - 1);

var gInstantApply = document.documentElement.instantApply; // read only once
var gTagService   = Components.classes["@mozilla.org/messenger/tagservice;1"]
                              .getService(Components.interfaces.nsIMsgTagService);
var gTagList      = null;  // tagList root element
var gAddButton    = null;
var gDeleteButton = null;
var gRaiseButton  = null;
var gLowerButton  = null;

var gDeletedTags  = {}; // tags marked for deletion in non-instant apply mode


function Startup()
{
  gTagList      = document.getElementById('tagList');
  gAddButton    = document.getElementById('addTagButton');
  gDeleteButton = document.getElementById('deleteTagButton');
  gRaiseButton  = document.getElementById('raiseTagButton');
  gLowerButton  = document.getElementById('lowerTagButton');
  InitTagList();
  if (!gInstantApply)
    window.addEventListener("dialogaccept", this.OnOK, true);
  UpdateButtonStates();
}

function InitTagList()
{
  // Read the tags from preferences via the tag service.
  var tagArray = gTagService.getAllTags({});
  for (var i = 0; i < tagArray.length; ++i)
  {
    var t = tagArray[i];
    var tagInfo = {tag:     t.tag,
                   key:     t.key,
                   color:   t.color,
                   ordinal: t.ordinal,
                   new:     false,  // not added in this run
                   changed: false}; // not changed (yet)
    AppendTagEntry(tagInfo, null);
  }
}

// read text and color from the listitem
function UpdateTagInfo(aTagInfo, aEntry)
{
  var tag   = aEntry.firstChild.firstChild.value;
  var color = aEntry.lastChild.lastChild.color;
  if (tag != aTagInfo.tag || color != aTagInfo.color)
  {
    aTagInfo.changed = true;  // never unset changed flag here!
    aTagInfo.tag     = tag;
    aTagInfo.color   = color;
  }
}

// set text and color of the listitem
function UpdateTagEntry(aTagInfo, aEntry)
{
  aEntry.firstChild.firstChild.value = aTagInfo.tag;
  aEntry.lastChild.lastChild.color = aTagInfo.color || 'inherit';
}

function AppendTagEntry(aTagInfo, aRefChild)
{
  // Creating a colorpicker dynamically in an onload handler is really sucky.
  // You MUST first set its type attribute (to select the correct binding), then
  // add the element to the DOM (to bind the binding) and finally set the color
  // property(!) afterwards. Try in any other order and fail... :-(
  var tagCell = document.createElement('listcell');
  var textbox = document.createElement('textbox');
  textbox.setAttribute('flex', 1);
  textbox.setAttribute('value', aTagInfo.tag);
  tagCell.appendChild(textbox);

  var colorCell = document.createElement('listcell');
  var colorpicker = document.createElement('colorpicker');
  colorpicker.setAttribute('type', 'button');
  colorpicker.setAttribute('color', aTagInfo.color || 'inherit')
  colorCell.appendChild(colorpicker);

  var entry = document.createElement('listitem');
  entry.addEventListener('focus', OnFocus, true);
  entry.addEventListener('change', OnChange, false);
  entry.setAttribute('allowevents', 'true');  // activate textbox and colorpicker
  entry.tagInfo = aTagInfo;
  entry.appendChild(tagCell);
  entry.appendChild(colorCell);

  gTagList.insertBefore(entry, aRefChild);
  return entry;
}

function OnFocus(aEvent)
{
  gTagList.selectedItem = this;
  UpdateButtonStates();
}

function FocusTagEntry(aEntry)
{
  // focus the entry's textbox
  gTagList.ensureElementIsVisible(aEntry);
  aEntry.firstChild.firstChild.focus();
}

function GetTagOrdinal(aTagInfo)
{
  if (aTagInfo.ordinal)
    return aTagInfo.ordinal;
  return aTagInfo.key;
}

function SetTagOrdinal(aTagInfo, aOrdinal)
{
  var ordinal = aTagInfo.ordinal;
  aTagInfo.ordinal = (aTagInfo.key != aOrdinal) ? aOrdinal : '';
  if (aTagInfo.ordinal != ordinal)
    aTagInfo.changed = true;
}

function BisectString(aPrev, aNext)
{
  // find a string which is lexically greater than aPrev and lesser than aNext:
  // - copy leading parts common to aPrev and aNext into the result
  // - find the first position where aPrev and aNext differ:
  //   - if we can squeeze a character in between there: fine, done!
  //   - if not:
  //     - if the rest of aNext is longer than one character, we can squeeze
  //       in just the first aNext rest-character and be done!
  //     - else we try to "increment" aPrev a bit to fit in
  if ((aPrev >= aNext) || (aPrev + kOrdinalCharLow >= aNext))
    return ''; // no such string exists

  // pad the shorter string
  var lenPrev = aPrev.length;
  var lenNext = aNext.length;
  var lenMax  = Math.max(lenPrev, lenNext);

  // loop over both strings at once, padding if necessary
  var constructing = false;
  var result = '';
  for (var i = 0; i < lenMax; ++i)
  {
    var prevChar = (i < lenPrev) ? aPrev[i] : kOrdinalPadding;
    var nextChar = constructing ? kOrdinalCharHigh
                                : (i < lenNext) ? aNext[i]
                                                : kOrdinalPadding;
    var prevCode = prevChar.charCodeAt(0);
    var nextCode = nextChar.charCodeAt(0);
    if (prevCode == nextCode) 
    {
      // copy common characters
      result += prevChar;
    }
    else if (prevCode + 1 < nextCode)
    {
      // found a real bisecting string
      result += String.fromCharCode((prevCode + nextCode) / 2);
      return result;
    }
    else
    {
      // nextCode is greater than prevCode, but there's no place in between.
      // But if aNext[i+1] exists, then nextChar will suffice and we're done!
      // ("x" < "xsomething")
      if (i + 1 < lenNext)
      {
        // found a real bisecting string
        return result + nextChar;
      }
      // just copy over prevChar and enter construction mode
      result += prevChar;
      constructing = true;
    }
  }
  return '';  // nothing found
}

function RecalculateOrdinal(aEntry)
{
  // Calculate a new ordinal for the given entry, assuming that both its
  // predecessor's and successor's are correct, i.e. ord(p) < ord(s)!
  var tagInfo = aEntry.tagInfo;
  var ordinal = tagInfo.key;
  // get neighbouring ordinals
  var prevOrdinal = '', nextOrdinal = '';
  var prev = aEntry.previousSibling;
  if (prev && prev.nodeName == 'listitem') // first.prev == listhead
    prevOrdinal = GetTagOrdinal(prev.tagInfo);
  var next = aEntry.nextSibling;
  if (next)
  {
    nextOrdinal = GetTagOrdinal(next.tagInfo);
  }
  else
  {
    // ensure key < nextOrdinal if entry is the last/only entry
    nextOrdinal = prevOrdinal || ordinal;
    nextOrdinal = String.fromCharCode(nextOrdinal.charCodeAt(0) + 2);
  }

  if (prevOrdinal < ordinal && ordinal < nextOrdinal)
  {
    // no ordinal needed, just clear it
    SetTagOrdinal(tagInfo, '')
    return;
  }

  // so we need a new ordinal, because key <= prevOrdinal or key >= nextOrdinal
  ordinal = BisectString(prevOrdinal, nextOrdinal);
  if (ordinal)
  {
    // found a new ordinal
    SetTagOrdinal(tagInfo, ordinal)
    return;
  }

  // couldn't find an ordinal before the nextOrdinal, so take that instead
  // and recalculate a new one for the next entry
  SetTagOrdinal(tagInfo, nextOrdinal);
  if (next)
    ApplyChange(next);
}

function OnChange(aEvent)
{
  ApplyChange(aEvent.currentTarget);
}

function ApplyChange(aEntry)
{
  if (!aEntry)
  {
    dump('ApplyChange: aEntry is null! (called by ' + ApplyChange.caller.name + ')\n');
    return;
  }

  // the tag data got changed, so write it back to the system
  var tagInfo = aEntry.tagInfo;
  UpdateTagInfo(tagInfo, aEntry);
  // ensure unique tag name
  var dupeList = ReadTagListFromUI(aEntry);
  var uniqueTag = DisambiguateTag(tagInfo.tag, dupeList);
  if (tagInfo.tag != uniqueTag)
  {
    tagInfo.tag = uniqueTag;
    tagInfo.changed = true;
    UpdateTagEntry(tagInfo, aEntry);
  }

  if (gInstantApply)
  {
    // If the item was newly added, we still can rename the key,
    // so that it's in sync with the actual tag.
    if (tagInfo.new && tagInfo.key)
    {
      // Do not clear the "new" flag!
      // The key will only stick after closing the dialog.
      gTagService.deleteKey(tagInfo.key);
      tagInfo.key = '';
    }
    if (!tagInfo.key)
    {
      // create a new key, based upon the new tag
      gTagService.addTag(tagInfo.tag, '', '');
      tagInfo.key = gTagService.getKeyForTag(tagInfo.tag);
    }

    // Recalculate the sort ordinal, if necessary.
    // We assume that the neighbour's ordinals are correct,
    // i.e. that ordinal(pos - 1) < ordinal(pos + 1)!
    RecalculateOrdinal(aEntry);
    WriteTag(tagInfo);
  }
}

function WriteTag(aTagInfo)
{
//dump('********** WriteTag: ' + aTagInfo.toSource() + '\n');
  try
  {
    gTagService.addTagForKey(aTagInfo.key,
                             aTagInfo.tag,
                             aTagInfo.color,
                             aTagInfo.ordinal);
    aTagInfo.changed = false;
  }
  catch (e)
  {
    dump('WriteTag: update exception:\n' + e);
  }
}

function UpdateButtonStates()
{
  var entry = gTagList.selectedItem;
  // disable Delete if no selection
  gDeleteButton.disabled = !entry;
  // disable Raise if no selection or first entry
  gRaiseButton.disabled = !entry || !gTagList.getPreviousItem(entry, 1);
  // disable Lower if no selection or last entry
  gLowerButton.disabled = !entry || !gTagList.getNextItem(entry, 1);
}

function ReadTagListFromUI(aIgnoreEntry)
{
  // reads distinct tag names from the UI
  var dupeList = {}; // indexed by tag
  for (var entry = gTagList.firstChild; entry; entry = entry.nextSibling)
    if ((entry != aIgnoreEntry) && (entry.localName == 'listitem'))
      dupeList[entry.firstChild.firstChild.value] = true;
  return dupeList;
}

function DisambiguateTag(aTag, aTagList)
{
  if (aTag in aTagList)
  {
    var suffix = 2;
    while (aTag + ' ' + suffix in aTagList)
      ++suffix;
    aTag += ' ' + suffix;
  }
  return aTag;
}

function AddTag()
{
  // Add a new tag to the UI here.
  // It will be be written to the preference system
  // (a) directly on each change for instant apply, or
  // (b) only if the dialogaccept handler is executed.

  // create new unique tag name
  var dupeList = ReadTagListFromUI();
  var tag = DisambiguateTag(gAddButton.getAttribute('defaulttagname'), dupeList);

  // create new tag list entry
  var tagInfo = {tag:     tag,
                 key:     '',
                 color:   'inherit',
                 ordinal: '',
                 new:     true,
                 changed: true};
  var refChild = gTagList.getNextItem(gTagList.selectedItem, 1);
  var newEntry = AppendTagEntry(tagInfo, refChild);
  ApplyChange(newEntry);
  FocusTagEntry(newEntry);
}

function DeleteTag()
{
  // Delete the selected tag from the UI here. If it was added during this
  // preference dialog session, we can drop it at once; if it was read from
  // the preferences system, we may need to remember killing it in OnOK.
  var entry = gTagList.selectedItem;
  var key = entry.tagInfo.key;
  if (key)
  {
    if (gInstantApply)
      gTagService.deleteKey(key);
    else
      gDeletedTags[key] = true; // dummy value
  }
  // after removing, move focus to next entry, if it exist, else try previous
  var newFocusItem = gTagList.getNextItem(entry, 1) ||
                     gTagList.getPreviousItem(entry, 1);
  gTagList.removeItemAt(gTagList.getIndexOfItem(entry));
  if (newFocusItem)
    FocusTagEntry(newFocusItem);
  else
    UpdateButtonStates();
}

function MoveTag(aMoveUp)
{
  // Move the selected tag one position up or down in the tagList's child order.
  // This reordering may require changing ordinal strings.
  var entry = gTagList.selectedItem;
  var tagInfo = entry.tagInfo;
  UpdateTagInfo(tagInfo, entry); // remember changed values
  var successor = aMoveUp ? gTagList.getPreviousItem(entry, 1)
                          : gTagList.getNextItem(entry, 2);
  entry.parentNode.insertBefore(entry, successor);
  FocusTagEntry(entry);
  tagInfo.changed = true;
  UpdateTagEntry(tagInfo, entry); // needs to be visible
  ApplyChange(entry);
}

function Restore()
{
  // clear pref panel tag list
  // Remember any known keys for deletion in the OKHandler.
  while (gTagList.getRowCount())
  {
    var key = gTagList.removeItemAt(0).tagInfo.key;
    if (key)
    {
      if (gInstantApply)
        gTagService.deleteKey(key);
      else
        gDeletedTags[key] = true; // dummy value
    }
  }
  // add default items (no ordinal strings for those)
  for (var i = 1; i <= 5; ++i)
  {
    // create default tags from the former label defaults
    var key   = "$label" + i;
    var tag   = GetLocalizedStringPref("mailnews.labels.description." + i);
    var color = Services.prefs.getDefaultBranch("mailnews.labels.color.").getCharPref(i);
    var tagInfo = {tag:     tag,
                   key:     key,
                   color:   color,
                   ordinal: '',
                   new:     false,
                   changed: true};
    var newEntry = AppendTagEntry(tagInfo, null);
    ApplyChange(newEntry);
  }
  FocusTagEntry(gTagList.getItemAtIndex(0));
}

function OnOK()
{
  // remove all deleted tags from the preferences system
  for (var key in gDeletedTags)
    gTagService.deleteKey(key);

  // Write tags to the preferences system, creating keys and ordinal strings.
  for (var entry = gTagList.firstChild; entry; entry = entry.nextSibling)
  {
    if (entry.localName == 'listitem')
    {
      // only write listitems which have changed (this includes new ones)
      var tagInfo = entry.tagInfo;
      if (tagInfo.changed)
      {
        if (!tagInfo.key)
        {
          // newly added tag, need to create a key and read it
          gTagService.addTag(tagInfo.tag, '', '');
          tagInfo.key = gTagService.getKeyForTag(tagInfo.tag);
        }
        if (tagInfo.key)
        {
          // Recalculate the sort ordinal, if necessary.
          // We assume that the neighbour's ordinals are correct,
          // i.e. that ordinal(pos - 1) < ordinal(pos + 1)!
          RecalculateOrdinal(entry);
          // update the tag definition
          WriteTag(tagInfo);
        }
      }
    }
  }
}
