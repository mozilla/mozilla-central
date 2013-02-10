/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource:///modules/imServices.jsm");

const EXPORTED_SYMBOLS = [
  "smileImMarkup", // used to add smile:// img tags into IM markup.
  "smileTextNode", // used to add smile:// img tags to the content of a textnode
  "smileString", // used to add smile:// img tags into a string without parsing it as HTML. Be sure the string doesn't contain HTML tags.
  "getSmileRealURI", // used to retrive the chrome URI for a smile:// URI
  "getSmileyList" // used to display a list of smileys in the UI
];

const kEmoticonsThemePref = "messenger.options.emoticonsTheme";
const kThemeFile = "theme.js";

__defineGetter__("gTheme", function() {
  delete this.gTheme;
  gPrefObserver.init();
  return this.gTheme = getTheme();
});

var gPrefObserver = {
  init: function po_init() {
    Services.prefs.addObserver(kEmoticonsThemePref, gPrefObserver, false);
  },

  observe: function so_observe(aObject, aTopic, aMsg) {
    if (aTopic != "nsPref:changed" || aMsg != kEmoticonsThemePref)
      throw "bad notification";

    gTheme = getTheme();
  }
};

function getSmileRealURI(aSmile)
{
  aSmile = Components.classes["@mozilla.org/intl/texttosuburi;1"]
                     .getService(Components.interfaces.nsITextToSubURI)
                     .unEscapeURIForUI("UTF-8", aSmile);
  if (aSmile in gTheme.iconsHash)
    return gTheme.baseUri + gTheme.iconsHash[aSmile].filename;

  throw "Invalid smile!";
}

function getSmileyList(aThemeName)
{
  let theme = aThemeName == gTheme.name ? gTheme : getTheme(aThemeName);
  if (!theme.json)
    return null;

  let addAbsoluteUrls = function(aSmiley) {
    return {filename: aSmiley.filename,
            src: theme.baseUri + aSmiley.filename,
            textCodes: aSmiley.textCodes};
  };
  return theme.json.smileys.map(addAbsoluteUrls);
}

function getTheme(aName)
{
  let name = aName || Services.prefs.getCharPref(kEmoticonsThemePref);

  let theme = {
    name: name,
    iconsHash: null,
    json: null,
    regExp: null
  };

  if (name == "none")
    return theme;

  if (name == "default")
    theme.baseUri = "chrome://instantbird-emoticons/skin/";
  else
    theme.baseUri = "chrome://" + theme.name + "/skin/";
  try {
    let channel = Services.io.newChannel(theme.baseUri + kThemeFile, null, null);
    let stream = channel.open();
    let json = Components.classes["@mozilla.org/dom/json;1"]
                         .createInstance(Components.interfaces.nsIJSON);
    theme.json = json.decodeFromStream(stream, stream.available());
    stream.close();
    theme.iconsHash = {};
    for each (let smiley in theme.json.smileys) {
      for each (let textCode in smiley.textCodes)
        theme.iconsHash[textCode] = smiley;
    }
  } catch(e) {
    Components.utils.reportError(e);
  }
  return theme;
}

function getRegexp()
{
  if (gTheme.regExp) {
    gTheme.regExp.lastIndex = 0;
    return gTheme.regExp;
  }

  // return null if smileys are disabled
  if (!gTheme.iconsHash)
    return null;

  if ("" in gTheme.iconsHash) {
    Components.utils.reportError("Emoticon " +
                                 gTheme.iconsHash[""].filename +
                                 " matches the empty string!");
    delete gTheme.iconsHash[""];
  }

  let emoticonList = [];
  for (let emoticon in gTheme.iconsHash)
    emoticonList.push(emoticon);

  let exp = /[[\]{}()*+?.\\^$|]/g;
  emoticonList = emoticonList.sort()
                             .reverse()
                             .map(function(x) x.replace(exp, "\\$&"));

  if (!emoticonList.length) {
    // the theme contains no valid emoticon, make sure we will return
    // early next time
    gTheme.iconsHash = null;
    return null;
  }

  gTheme.regExp = new RegExp(emoticonList.join('|'), 'g');
  return gTheme.regExp;
}

// unused. May be useful later to process a string instead of an HTML node
function smileString(aString)
{
  const kSmileFormat = '<img class="ib-img-smile" src="smile://$&" alt="$&" title="$&"/>';

  let exp = getRegexp();
  return exp ? aString.replace(exp, kSmileFormat) : aString;
}

function smileTextNode(aNode)
{
  /*
   * Skip text nodes that contain the href in the child text node.
   * We must check both the testNode.textContent and the aNode.data since they
   * cover different cases:
   *   textContent: The URL is split over multiple nodes for some reason
   *   data: The URL is not the only content in the link, skip only the one node
   * Check the class name to skip any autolinked nodes from mozTXTToHTMLConv.
   */
  let testNode = aNode;
  while ((testNode = testNode.parentNode)) {
    if (testNode instanceof Components.interfaces.nsIDOMHTMLAnchorElement &&
        (testNode.getAttribute("href") == testNode.textContent.trim() ||
         testNode.getAttribute("href") == aNode.data.trim() ||
         testNode.className.contains("moz-txt-link-")))
      return 0;
  }

  let result = 0;
  let exp = getRegexp();
  if (!exp)
    return result;

  let match;
  while ((match = exp.exec(aNode.data))) {
    let smileNode = aNode.splitText(match.index);
    aNode = smileNode.splitText(exp.lastIndex - match.index);
    // at this point, smileNode is a text node with only the text
    // of the smiley and aNode is a text node with the text after
    // the smiley. The text in aNode hasn't been processed yet.
    let smile = smileNode.data;
    let elt = aNode.ownerDocument.createElement("img");
    elt.setAttribute("src", "smile://" + smile);
    elt.setAttribute("title", smile);
    elt.setAttribute("alt", smile);
    elt.setAttribute("class", "ib-img-smile");
    smileNode.parentNode.replaceChild(elt, smileNode);
    result += 2;
    exp.lastIndex = 0;
  }
  return result;
}

function smileNode(aNode)
{
  for (let i = 0; i < aNode.childNodes.length; ++i) {
    let node = aNode.childNodes[i];
    if (node instanceof Components.interfaces.nsIDOMHTMLElement) {
      // we are on a tag, recurse to process its children
      smileNode(node);
    } else if (node instanceof Components.interfaces.nsIDOMText) {
      // we are on a text node, process it
      smileTextNode(node);
    }
  }
}

function smileImMarkup(aDocument, aText)
{
  if (!aDocument)
    throw "providing an HTML document is required";

  // return early if smileys are disabled
  if (!gTheme.iconsHash)
    return aText;

  let div = aDocument.createElement("div");
  div.innerHTML = aText;
  smileNode(div);
  return div.innerHTML;
}
