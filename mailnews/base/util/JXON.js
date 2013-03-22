/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// This is a modification of the JXON parsers found on the page
// <https://developer.mozilla.org/en-US/docs/JXON>

var EXPORTED_SYMBOLS = ["JXON"];

const JXON = new (function() {
  const sValueProp = "value"; /* you can customize these values */
  const sAttributesProp = "attr";
  const sAttrPref = "@";
  const sElementListPrefix = "$";
  const sConflictSuffix = "_"; // used when there's a name conflict with special JXON properties
  const aCache = [];
  const rIsNull = /^\s*$/;
  const rIsBool = /^(?:true|false)$/i;

  function parseText(sValue) {
    //if (rIsNull.test(sValue))
    //  return null;
    if (rIsBool.test(sValue)) 
      return sValue.toLowerCase() === "true";
    if (isFinite(sValue))
      return parseFloat(sValue);
    if (isFinite(Date.parse(sValue)))
      return new Date(sValue);
    return sValue;
  };

  function EmptyTree() {
  }
  EmptyTree.prototype = {
    toString : function () {
      return "null";
    },
    valueOf : function () {
      return null;
    },
  };

  function objectify(vValue) {
    if (vValue === null)
      return new EmptyTree();
    else if (vValue instanceof Object)
      return vValue;
    else
      return new vValue.constructor(vValue); // What does this? copy?
  };

  function createObjTree(oParentNode, nVerb, bFreeze, bNesteAttr) {
    const nLevelStart = aCache.length;
    const bChildren = oParentNode.hasChildNodes();
    const bAttributes = oParentNode.attributes &&
                        oParentNode.attributes.length;
    const bHighVerb = Boolean(nVerb & 2);

    var sProp = 0;
    var vContent = 0;
    var nLength = 0;
    var sCollectedTxt = "";
    var vResult = bHighVerb ? {} : /* put here the default value for empty nodes: */ true;

    if (bChildren) {
      for (var oNode, nItem = 0; nItem < oParentNode.childNodes.length; nItem++) {
        oNode = oParentNode.childNodes.item(nItem);
        if (oNode.nodeType === 4) // CDATASection
          sCollectedTxt += oNode.nodeValue; 
        else if (oNode.nodeType === 3) // Text
          sCollectedTxt += oNode.nodeValue;
        else if (oNode.nodeType === 1) // Element
          aCache.push(oNode);
      }
    }

    const nLevelEnd = aCache.length;
    const vBuiltVal = parseText(sCollectedTxt);

    if (!bHighVerb && (bChildren || bAttributes))
      vResult = nVerb === 0 ? objectify(vBuiltVal) : {};

    for (var nElId = nLevelStart; nElId < nLevelEnd; nElId++) {
      sProp = aCache[nElId].nodeName;
      if (sProp == sValueProp || sProp == sAttributesProp)
        sProp = sProp + sConflictSuffix;
      vContent = createObjTree(aCache[nElId], nVerb, bFreeze, bNesteAttr);
      if (!vResult.hasOwnProperty(sProp)) {
        vResult[sProp] = vContent;
        vResult[sElementListPrefix + sProp] = [];
      }
      vResult[sElementListPrefix + sProp].push(vContent);
      nLength++;
    }

    if (bAttributes) {
      const nAttrLen = oParentNode.attributes.length;
      const sAPrefix = bNesteAttr ? "" : sAttrPref;
      const oAttrParent = bNesteAttr ? {} : vResult;

      for (var oAttrib, nAttrib = 0; nAttrib < nAttrLen; nLength++, nAttrib++) {
        oAttrib = oParentNode.attributes.item(nAttrib);
        oAttrParent[sAPrefix + oAttrib.name] = parseText(oAttrib.value);
      }

      if (bNesteAttr) {
        if (bFreeze)
          Object.freeze(oAttrParent);
        vResult[sAttributesProp] = oAttrParent;
        nLength -= nAttrLen - 1;
      }
    }

    if (nVerb === 3 || (nVerb === 2 || nVerb === 1 && nLength > 0) && sCollectedTxt)
      vResult[sValueProp] = vBuiltVal;
    else if (!bHighVerb && nLength === 0 && sCollectedTxt)
      vResult = vBuiltVal;

    if (bFreeze && (bHighVerb || nLength > 0))
      Object.freeze(vResult);

    aCache.length = nLevelStart;

    return vResult;
  };

  function loadObjTree(oXMLDoc, oParentEl, oParentObj) {
    var vValue, oChild;

    if (oParentObj instanceof String || oParentObj instanceof Number ||
        oParentObj instanceof Boolean)
      oParentEl.appendChild(oXMLDoc.createTextNode(oParentObj.toString())); /* verbosity level is 0 */
    else if (oParentObj.constructor === Date)
      oParentEl.appendChild(oXMLDoc.createTextNode(oParentObj.toGMTString()));

    for (var sName in oParentObj) {
      vValue = oParentObj[sName];
      if (isFinite(sName) || vValue instanceof Function)
        continue; /* verbosity level is 0 */
      if (sName === sValueProp) {
        if (vValue !== null && vValue !== true) {
          oParentEl.appendChild(oXMLDoc.createTextNode(
              vValue.constructor === Date ? vValue.toGMTString() : String(vValue)));
        }
      } else if (sName === sAttributesProp) { /* verbosity level is 3 */
        for (var sAttrib in vValue)
          oParentEl.setAttribute(sAttrib, vValue[sAttrib]);
      } else if (sName.charAt(0) === sAttrPref) {
        oParentEl.setAttribute(sName.slice(1), vValue);
      } else if (vValue.constructor === Array) {
        for (var nItem = 0; nItem < vValue.length; nItem++) {
          oChild = oXMLDoc.createElement(sName);
          loadObjTree(oXMLDoc, oChild, vValue[nItem]);
          oParentEl.appendChild(oChild);
        }
      } else {
        oChild = oXMLDoc.createElement(sName);
        if (vValue instanceof Object)
          loadObjTree(oXMLDoc, oChild, vValue);
        else if (vValue !== null && vValue !== true)
          oChild.appendChild(oXMLDoc.createTextNode(vValue.toString()));
        oParentEl.appendChild(oChild);
     }
   }
  };

  this.build = function(oXMLParent, nVerbosity /* optional */, bFreeze /* optional */, bNesteAttributes /* optional */) {
    const _nVerb = arguments.length > 1 &&
        typeof nVerbosity === "number" ? nVerbosity & 3 :
        /* put here the default verbosity level: */ 1;
    return createObjTree(oXMLParent, _nVerb, bFreeze || false,
        arguments.length > 3 ? bNesteAttributes : _nVerb === 3);
  };

  this.unbuild = function(oObjTree) {
    const oNewDoc = document.implementation.createDocument("", "", null);
    loadObjTree(oNewDoc, oNewDoc, oObjTree);
    return oNewDoc;
  };
})();
