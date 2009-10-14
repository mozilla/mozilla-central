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
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Blake Winton <bwinton@latte.ca>
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

const EXPORTED_SYMBOLS = ["GetAttachmentKeywords"];

/**
 * Check current word has CJK character or not.
 *
 * @return true if it has CJK character.
 */
function IsCJKWord(aWord)
{
  var code;

  for (var i = 0; i < aWord.length; i++)
  {
    code = aWord.charCodeAt(i);
    if (code >= 0x2000 && code <= 0x9fff)
    {
      // Hiragana, Katakana and Kanaji
      return true;
    }
    else if (code >= 0xac00 && code <= 0xd7ff)
    {
      // Hangul
      return true;
    }
    else if (code >= 0xf900 && code <= 0xffff)
    {
      // Hiragana, Katakana and Kanaji
      return true;
    }
  }
  return false;
}

/**
 * Get the (possibly-empty) list of attachment keywords in this message.
 *
 * @return the (possibly-empty) list of attachment keywords in this message
 **/
function GetAttachmentKeywords(mailData,keywordsInCsv)
{
  // The empty string would get split to an array of size 1.  Avoid that...
  var keywordsArray = (keywordsInCsv) ? keywordsInCsv.split(",") : [];

  function escapeRegxpSpecials(inputString)
  {
    const specials = [".", "\\", "^", "$", "*", "+", "?", "|",
                      "(", ")" , "[", "]", "{", "}"];
    var re = new RegExp("(\\"+specials.join("|\\")+")", "g");
    inputString = inputString.replace(re, "\\$1");
    return inputString.replace(" ", "\\s+");
  }

  var keywordsFound = [];
  for (var i = 0; i < keywordsArray.length; i++) {
    var kw = escapeRegxpSpecials(keywordsArray[i]);
    var re;
    if (IsCJKWord(kw))
    {
      // CJK doesn't detect space and \b as word break, so we need
      // special rule for CJK.
      re = new RegExp("(([^\\s]*)\\b|\\s*)" + kw, "i");
    }
    else
    {
      re = new RegExp("(([^\\s]*)\\b|\\s*)" + kw + "\\b", "i");
    }
    var matching = re.exec(mailData);
    // Ignore the match if it was a URL.
    if (matching && !(/^http|^ftp/i.test(matching[0])))
      keywordsFound.push(keywordsArray[i]);
  }
  return keywordsFound;
}

function onmessage(event)
{
  var keywordsFound = GetAttachmentKeywords(event.data[0], event.data[1]);
  postMessage(keywordsFound);
};

