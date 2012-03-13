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
 * The Original Code is Instantbird.
 *
 * The Initial Developer of the Original Code is
 * Patrick Cloke <clokep@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Mark "Mook" Yen <Mook.moz+Instantbird.code@gmail.com>
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

const EXPORTED_SYMBOLS = ["DEBUG", "LOG", "WARN", "ERROR", "_",
                          "ctcpFormatToText", "ctcpFormatToHTML"];

const {classes: Cc, interfaces: Ci} = Components;

Components.utils.import("resource:///modules/imXPCOMUtils.jsm");
initLogModule("irc", this);

XPCOMUtils.defineLazyGetter(this, "_", function()
  l10nHelper("chrome://chat/locale/irc.properties")
);

XPCOMUtils.defineLazyGetter(this, "TXTToHTML", function() {
  let cs = Cc["@mozilla.org/txttohtmlconv;1"].getService(Ci.mozITXTToHTMLConv);
  return function(aTXT) cs.scanTXT(aTXT, cs.kEntities);
});

// The supported formatting control characters, as described as deprecated in
// http://www.invlogic.com/irc/ctcp.html#3.11
const CTCP_TAGS = {"\x02": "b", // \002, ^B, Bold
                   "\x16": "i", // \026, ^V, Reverse or Inverse (Italics)
                   "\x1F": "u", // \037, ^_, Underline
                   "\x03": mIRCColoring, // \003, ^C, Coloring
                   "\x0F": null}; // \017, ^O, Clear all formatting

// Generate an expression that will search for any of the control characters.
const CTCP_TAGS_STRING = "[" + Object.keys(CTCP_TAGS).join("") + "]";
const CTCP_TAGS_EXP = new RegExp(CTCP_TAGS_STRING);
const CTCP_TAGS_EXP_GLOBAL = new RegExp(CTCP_TAGS_STRING, "g");

// Remove all CTCP formatting characters.
function ctcpFormatToText(aString) aString.replace(CTCP_TAGS_EXP_GLOBAL, "")

// Close the tags in the opposite order they were opened.
function closeStack(aStack)
  aStack.reverse().map(function(aTag) "</" + aTag.split(" ", 1) + ">").join("")

/**
 * Convert a string from CTCP escaped formatting to HTML markup.
 * @param aString the string with CTCP formatting to parse
 * @return The HTML output string
 */
function ctcpFormatToHTML(aString) {
  let next,
      stack = [],
      input = TXTToHTML(aString),
      output = "",
      length;

  while ((next = CTCP_TAGS_EXP.exec(input))) {
    if (next.index > 0)
      output += input.substr(0, next.index);
    length = 1;
    let tag = CTCP_TAGS[input[next.index]];
    if (tag === null) {
      // Clear all formatting.
      output += closeStack(stack);
      stack = [];
    }
    else if (typeof tag == "function") {
      [stack, output, length] = tag(stack, input.substr(next.index), output);
    }
    else {
      let offset = stack.indexOf(tag);
      if (offset == -1) {
        // Tag not found; open new tag.
        output += "<" + tag + ">";
        stack.push(tag);
      }
      else {
        // Tag found; close existing tag (and all tags after it).
        output += closeStack(stack.slice(offset));
        // Reopen the tags that came after it.
        stack.slice(offset + 1)
             .forEach(function(aTag) output += "<" + aTag + ">");
        // Remove the tag from the stack.
        stack.splice(offset, 1);
      }
    }

    // Avoid infinite loops, if.
    length = (length <= 0) ? 1 : length;
    // Skip to after the last match.
    input = input.substr(next.index + length);
  }
  // Return unmatched bits and close any open tags at the end.
  return output + input + closeStack(stack);
}

// mIRC colors are defined at http://www.mirc.com/colors.html.
// This expression matches \003<one or two digits>[,<one or two digits>].
const M_IRC_COLORS_EXP = /^\x03(?:(\d\d?)(?:,(\d\d?))?)?/;
const M_IRC_COLOR_MAP = {
  "0": "white",
  "1": "black",
  "2": "navy", // blue (navy)
  "3": "green",
  "4": "red",
  "5": "maroon", // brown (maroon)
  "6": "purple",
  "7": "orange", // orange (olive)
  "8": "yellow",
  "9": "lime", // light green (lime)
  "10": "teal", // teal (a green/blue cyan)
  "11": "aqua", // light cyan (cyan) (aqua)
  "12": "blue", // light blue (royal)",
  "13": "fuchsia", // pink (light purple) (fuchsia)
  "14": "grey",
  "15": "silver", // light grey (silver)
  "99": "transparent"
};

function mIRCColoring(aStack, aInput, aOutput) {
  function getColor(aKey) {
    let key = aKey;
    // Single digit numbers can (must?) be prefixed by a zero.
    if (key.length == 2 && key[0] == "0")
      key = key[1];

    if (M_IRC_COLOR_MAP.hasOwnProperty(key))
      return M_IRC_COLOR_MAP[key];

    return null;
  }

  let matches,
      stack = aStack,
      input = aInput,
      output = aOutput,
      length = 1;

  if ((matches = M_IRC_COLORS_EXP.exec(input))) {
    let format = ["font"];

    if (!matches[1]) {
      // Find the first font tag.
      let offset = stack.map(function(aTag) aTag.indexOf("font") == 0)
                        .indexOf(true);

      // Close all tags after the first font tag.
      output += closeStack(stack.slice(offset));
      // Remove the font tags from the stack.
      stack = stack.filter(function(aTag) aTag.indexOf("font"));
      // Reopen the other tags.
      stack.slice(offset)
           .forEach(function(aTag) output += "<" + aTag + ">");
    }
    else {
      // The foreground color.
      let color = getColor(matches[1]);
      if (color)
        format.push("color=\"" + color + "\"");

      // The background color.
      if (matches[2]) {
        let color = getColor(matches[2]);
        if (color)
          format.push("background=\"" + color + "\"");
      }

      if (format.length > 1) {
        output += "<" + format.join(" ") + ">";
        stack.push(format.join(" "));
        length = matches[0].length;
      }
    }
  }

  return [stack, output, length];
}
