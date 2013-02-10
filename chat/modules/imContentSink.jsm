/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/imServices.jsm");

const EXPORTED_SYMBOLS = [
  "cleanupImMarkup", // used to clean up incoming IMs.
                     // This will use the global ruleset of acceptable stuff
                     // except if another (custom one) is provided
  "createDerivedRuleset", // used to create a ruleset that inherits from the
                          // default one
                          // useful if you want to allow or forbid
                          // an additionnal thing in a specific
                          // conversation but take into account all
                          // the other global settings.
  "addGlobalAllowedTag",
  "removeGlobalAllowedTag",
  "addGlobalAllowedAttribute",
  "removeGlobalAllowedAttribute",
  "addGlobalAllowedStyleRule",
  "removeGlobalAllowedStyleRule"
];

/*
 * Structure of a ruleset:
 * A ruleset is a JS object containing 3 sub-objects: attrs, tags and styles.
 *  - attrs: an object containing a list of attributes allowed for all tags.
 *      example: attrs: { 'style': true }
 *
 *  - tags: an object with the allowed tags. each tag can allow specific attributes.
 *      example: 'a': {'href': true}
 *
 *    each attribute can have a function returning a boolean indicating if
 *    the attribute is accepted.
 *      example: 'href': function(aValue) aValue == 'about:blank'
 *
 *  - styles: an object with the allowed CSS style rule.
 *      example: 'font-size': true
 *    FIXME: make this accept functions to filter the CSS values too.
 *
 *  See the 3 examples of rulesets below.
 */

const kAllowedURLs = function(aValue) /^(https?|ftp|mailto):/.test(aValue);
const kAllowedMozClasses =
  function(aClassName) aClassName == "moz-txt-underscore" ||
                       aClassName == "moz-txt-tag";

// in strict mode, remove all formatings. Keep only links and line breaks.
const kStrictMode = {
  attrs: { },

  tags: {
    'a': {
      'title': true,
      'href': kAllowedURLs
    },
    'br': true,
    'p': true
  },

  styles: { }
};

// standard mode allows basic formattings (bold, italic, underlined)
const kStandardMode = {
  attrs: {
    'style': true
  },

  tags: {
    'div': true,
    'a': {
      'title': true,
      'href': kAllowedURLs
    },
    'em': true,
    'strong': true,
    'b': true,
    'i': true,
    'u': true,
    'span': {
      'class': kAllowedMozClasses
    },
    'br': true,
    'code': true,
    'ul': true,
    'li': true,
    'ol': true,
    'cite': true,
    'blockquote': true,
    'p': true
  },

  styles: {
    'font-style': true,
    'font-weight': true,
    '-moz-text-decoration-line': true
  }
};

// permissive mode allows about anything that isn't going to mess up the chat window
const kPermissiveMode = {
  attrs: {
    'style': true
  },

  tags : {
    'div': true,
    'a': {
      'title': true,
      'href': kAllowedURLs
    },
    'font': {
      'face': true,
      'color': true,
      'size': true
    },
    'em': true,
    'strong': true,
    'b': true,
    'i': true,
    'u': true,
    'span': {
      'class': kAllowedMozClasses
    },
    'br': true,
    'hr': true,
    'code': true,
    'ul': true,
    'li': true,
    'ol': true,
    'cite': true,
    'blockquote': true,
    'p': true
  },

  // FIXME: should be possible to use functions to filter values
  styles : {
    'color': true,
    'font': true,
    'font-family': true,
    'font-size': true,
    'font-style': true,
    'font-weight': true,
    '-moz-text-decoration-color': true,
    '-moz-text-decoration-style': true,
    '-moz-text-decoration-line': true
  }
};

const kModePref = "messenger.options.filterMode";
const kModes = [kStrictMode, kStandardMode, kPermissiveMode];

var gGlobalRuleset = null;

function initGlobalRuleset()
{
  gGlobalRuleset = newRuleset();

  Services.prefs.addObserver(kModePref, styleObserver, false);
}

var styleObserver = {
  observe: function so_observe(aObject, aTopic, aMsg) {
    if (aTopic != "nsPref:changed" || aMsg != kModePref)
      throw "bad notification";

    if (!gGlobalRuleset)
      throw "gGlobalRuleset not initialized";

    setBaseRuleset(getModePref(), gGlobalRuleset);
  }
};

function getModePref()
{
  let baseNum = Services.prefs.getIntPref(kModePref);
  if (baseNum < 0 || baseNum > 2)
    baseNum = 1;

  return kModes[baseNum];
}

function setBaseRuleset(aBase, aResult)
{
  aResult.tags.__proto__ = aBase.tags;
  aResult.attrs.__proto__ = aBase.attrs;
  aResult.styles.__proto__ = aBase.styles;
}

function newRuleset(aBase)
{
  let result = {
    tags: {},
    attrs: {},
    styles: {}
  };
  setBaseRuleset(aBase || getModePref(), result);
  return result;
}

function createDerivedRuleset()
{
  if (!gGlobalRuleset)
    initGlobalRuleset();
  return newRuleset(gGlobalRuleset);
}

function addGlobalAllowedTag(aTag, aAttrs)
{
  gGlobalRuleset.tags[aTag] = aAttrs || true;
}
function removeGlobalAllowedTag(aTag)
{
  delete gGlobalRuleset.tags[aTag];
}

function addGlobalAllowedAttribute(aAttr, aRule)
{
  gGlobalRuleset.attrs[aAttr] = aRule || true;
}
function removeGlobalAllowedAttribute(aAttr)
{
  delete gGlobalRuleset.attrs[aAttr];
}

function addGlobalAllowedStyleRule(aStyle, aRule)
{
  gGlobalRuleset.styles[aStyle] = aRule || true;
}
function removeGlobalAllowedStyleRule(aStyle)
{
  delete gGlobalRuleset.styles[aStyle];
}

function cleanupNode(aNode, aRules, aTextModifiers)
{
  for (let i = 0; i < aNode.childNodes.length; ++i) {
    let node = aNode.childNodes[i];
    if (node instanceof Components.interfaces.nsIDOMHTMLElement) {
      // check if node allowed
      let nodeName = node.localName.toLowerCase();
      if (!(nodeName in aRules.tags)) {
        // this node is not allowed, replace it with its children
        while (node.hasChildNodes())
          aNode.insertBefore(node.removeChild(node.firstChild), node);
        aNode.removeChild(node);
        // We want to process again the node at the index i which is
        // now the first child of the node we removed
        --i;
        continue;
      }

      // we are going to keep this child node, clean up its children
      cleanupNode(node, aRules, aTextModifiers);

      // cleanup attributes
      let attrs = node.attributes;
      let acceptFunction = function(aAttrRules, aAttr) {
        // an attribute is always accepted if its rule is true, or conditionnaly
        // accepted if its rule is a function that evaluates to true
        // if its rule does not exist, it is refused
          let localName = aAttr.localName;
          let rule = localName in aAttrRules && aAttrRules[localName];
          return (rule === true ||
                  (typeof rule == "function" && rule(aAttr.value)));
      };
      for (let j = 0; j < attrs.length; ++j) {
        let attr = attrs[j];
        // we check both the list of accepted attributes for all tags
        // and the list of accepted attributes for this specific tag.
        if (!(acceptFunction(aRules.attrs, attr) ||
              ((typeof aRules.tags[nodeName] ==  "object") &&
               acceptFunction(aRules.tags[nodeName], attr)))) {
          node.removeAttribute(attr.name);
          --j;
        }
      }

      // cleanup style
      let style = node.style;
      for (let j = 0; j < style.length; ++j) {
        if (!(style[j] in aRules.styles)) {
          style.removeProperty(style[j]);
          --j;
        }
      }
    }
    else {
      // We are on a text node, we need to apply the functions
      // provided in the aTextModifiers array.

      // Each of these function should return the number of nodes added:
      //  * -1 if the current textnode was deleted
      //  * 0 if the node count is unchanged
      //  * positive value if nodes were added.
      //     For instance, adding an <img> tag for a smiley adds 2 nodes:
      //      - the img tag
      //      - the new text node after the img tag.

      // This is the number of nodes we need to process. If new nodes
      // are created, the next text modifier functions have more nodes
      // to process.
      let textNodeCount = 1;
      for each (let modifier in aTextModifiers)
        for (let n = 0; n < textNodeCount; ++n) {
          let textNode = aNode.childNodes[i + n];

          // If we are processing nodes created by one of the previous
          // text modifier function, some of the nodes are likely not
          // text node, skip them.
          if (!(textNode instanceof Components.interfaces.nsIDOMText))
            continue;

          let result = modifier(textNode);
          textNodeCount += result;
          n += result;
        }

      // newly created nodes should not be filtered, be sure we skip them!
      i += textNodeCount - 1;
    }
  }
}

function cleanupImMarkup(aText, aRuleset, aTextModifiers)
{
  if (!gGlobalRuleset)
    initGlobalRuleset();

  let parser = Components.classes["@mozilla.org/xmlextras/domparser;1"]
                         .createInstance(Components.interfaces.nsIDOMParser);
  let doc = parser.parseFromString(aText, "text/html");
  let div = doc.querySelector("body");
  cleanupNode(div, aRuleset || gGlobalRuleset, aTextModifiers || []);
  return div.innerHTML;
}
