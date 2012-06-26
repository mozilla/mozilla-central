/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

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

/*
 * The supported formatting control characters, as described in
 * http://www.invlogic.com/irc/ctcp.html#3.11
 * If a string is given, it will replace the control character; if null is
 * given, the current HTML tag stack will be closed; if a function is given,
 * it expects two parameters:
 *  aStack  The ordered list of open HTML tags.
 *  aInput  The current input string.
 * There are three output values returned in an array:
 *  The new ordered list of open HTML tags.
 *  The new text output to append.
 *  The number of characters (from the start of the input string) that the
 *  function handled.
 */
const CTCP_TAGS = {"\x02": "b", // \002, ^B, Bold
                   "\x16": "i", // \026, ^V, Reverse or Inverse (Italics)
                   "\x1F": "u", // \037, ^_, Underline
                   "\x03": mIRCColoring, // \003, ^C, Coloring
                   "\x0F": null}; // \017, ^O, Clear all formatting

// Generate an expression that will search for any of the control characters.
const CTCP_TAGS_EXP = new RegExp("[" + Object.keys(CTCP_TAGS).join("") + "]");

// Remove all CTCP formatting characters.
function ctcpFormatToText(aString) {
  let next,
      input = aString,
      output = "",
      length;

  while ((next = CTCP_TAGS_EXP.exec(input))) {
    if (next.index > 0)
      output += input.substr(0, next.index);
    // We assume one character will be stripped.
    length = 1;
    let tag = CTCP_TAGS[input[next.index]];
    // If the tag is a function, calculate how many characters are handled.
    if (typeof tag == "function")
      [, , length] = tag([], input.substr(next.index));

    // Avoid infinite loops.
    length = Math.max(1, length);
    // Skip to after the last match.
    input = input.substr(next.index + length);
  }
  // Append the unmatched bits before returning the output.
  return output + input;
}

function openStack(aStack)
  aStack.map(function(aTag) "<" + aTag + ">").join("")

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
      newOutput,
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
      [stack, newOutput, length] = tag(stack, input.substr(next.index));
      output += newOutput;
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
        output += openStack(stack.slice(offset + 1));
        // Remove the tag from the stack.
        stack.splice(offset, 1);
      }
    }

    // Avoid infinite loops.
    length = Math.max(1, length);
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

function mIRCColoring(aStack, aInput) {
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
      output = "",
      length = 1;

  if ((matches = M_IRC_COLORS_EXP.exec(input))) {
    let format = ["font"];

    // Only \003 was found with no formatting digits after it, close the
    // first open font tag.
    if (!matches[1]) {
      // Find the first font tag.
      let offset = stack.map(function(aTag) aTag.indexOf("font") == 0)
                        .indexOf(true);

      // Close all tags from the first font tag on.
      output = closeStack(stack.slice(offset));
      // Remove the font tags from the stack.
      stack = stack.filter(function(aTag) aTag.indexOf("font"));
      // Reopen the other tags.
      output += openStack(stack.slice(offset));
    }
    else {
      // Otherwise we have a match and are setting new colors.
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
        let tag = format.join(" ");
        output = "<" + tag + ">";
        stack.push(tag);
        length = matches[0].length;
      }
    }
  }

  return [stack, output, length];
}
