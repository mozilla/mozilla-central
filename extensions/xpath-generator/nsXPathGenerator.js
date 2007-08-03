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
 * The Original Code is mozilla.org XPath Generator.
 *
 * The Initial Developer of the Original Code is
 * Alexander J. Vincent <ajvincent@gmail.com>.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
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

const SUPPORTED_FLAGS = 0x00000003;

const C_i = Components.interfaces;

const catMan = Components.classes["@mozilla.org/categorymanager;1"]
                         .getService(C_i.nsICategoryManager);

const ERROR_FAILURE     = Components.results.NS_ERROR_FAILURE;
const ERROR_UNEXPECTED  = Components.results.NS_ERROR_UNEXPECTED;
const INVALID_ARG       = Components.results.NS_ERROR_INVALID_ARG;
const NULL_POINTER      = Components.results.NS_ERROR_NULL_POINTER;
const NO_INTERFACE      = Components.results.NS_ERROR_NO_INTERFACE;
const DOM_NOT_SUPPORTED = (1 << 31 | (14+0x45) << 16 | 9);
//const DOM_NOT_SUPPORTED = Components.results.NS_ERROR_DOM_NOT_SUPPORTED_ERR;

/**
 * Escape the quotes in a string for XPath.
 *
 * @param aString Original string.
 *
 * @return Escaped string.
 */
function EscapeQuotes(aString) {
  if (aString.indexOf("'") == -1) {
    return "'" + aString + "'";
  }

  var quoteIndex = aString.indexOf('"');
  if (quoteIndex == -1) {
    return '"' + aString + '"';
  }

  var retval = 'concat("';
  var str = aString;

  var previousQuoteIndex = 0;
  while (quoteIndex != -1) {
    retval += str.substring(previousQuoteIndex, quoteIndex);
    retval += "\", '\"', \"";
    previousQuoteIndex = quoteIndex + 1;
    quoteIndex = str.indexOf('"');
  }

  retval += str + '")';
  return retval;
}

function XPathResolver() {
  this.mNamespaceURIMap = {};
  this.mPrefixMap = {};
  this.mPrefixesUndeclared = 0;
}
XPathResolver.prototype = {
  /**
   * Add a namespace URI and prefix.
   *
   * @param namespaceURI     The namespace URI of the namespace.
   * @param prefix           The prefix of the namespace.
   */
  addNamespace: function addNamespace(namespaceURI, prefix) {
    if (!namespaceURI || !prefix) {
      throw INVALID_ARG;
    }

    // Can we validate the prefix somehow via C_i.nsIParserService?

    if (("_" + prefix) in this.mNamespaceURIMap) {
      // The prefix has already been assigned a namespace.
      throw ERROR_FAILURE;
    }

    this.mPrefixMap["_" + namespaceURI] = prefix;
    this.mNamespaceURIMap["_" + prefix] = namespaceURI;
  },

  /**
   * Get or create a prefix corresponding to a particular namespace URI.
   *
   * @param aNamespaceURI    The namespace URI of the namespace.
   * @return prefix          The prefix of the namespace.
   */
  lookupPrefix: function lookupPrefix(aNamespaceURI) {
    if (!aNamespaceURI) {
      throw INVALID_ARG;
    }

    if (("_" + aNamespaceURI) in this.mPrefixMap) {
      return this.mPrefixMap["_" + aNamespaceURI];
    }

    var prefix = "a" + this.mPrefixesUndeclared;
    while (("_" + prefix) in this.mNamespaceURIMap) {
      this.mPrefixesUndeclared++;
      prefix = "a" + this.mPrefixesUndeclared;
    }

    this.addNamespace(aNamespaceURI, prefix);
    return prefix;
  },

  // nsIDOMXPathNSResolver
  lookupNamespaceURI: function lookupNamespaceURI(aPrefix) {
    if (!aPrefix) {
      throw INVALID_ARG;
    }
    // Can we validate the prefix somehow via nsIParserService?

    if (("_" + aPrefix) in this.mNamespaceURIMap) {
      return this.mNamespaceURIMap["_" + aPrefix];
    }
    return null;
  },

  // nsIClassInfo
  getInterfaces: function getInterfaces(aCount) {
    var array = [C_i.nsIDOMXPathNSResolver,
                 C_i.nsIClassInfo];
    aCount.value = array.length;
    return array;
  },
  getHelperForLanguage: function getHelperForLanguage(aLanguage) {
    return null;
  },
  contractID: "@mozilla.org/xpath-generator-resolver;1",
  classDescription: "XPathGeneratorResolver",
  classID: Components.ID("{e74ada91-4c42-4493-b6e0-fa0fe02449e0}"),
  implementationLanguage: C_i.nsIProgrammingLanguage.JAVASCRIPT,
  flags: C_i.nsIClassInfo.DOM_OBJECT,

  // nsISupports
  QueryInterface: function QueryInterface(aIID) {
    if (aIID.equals(C_i.nsIDOMXPathNSResolver) ||
        aIID.equals(C_i.nsIClassInfo) ||
        aIID.equals(C_i.nsISupports))
      return this;

    throw NO_INTERFACE;
  }
};

function XPathGenerator() {
  // nsIXPathGenerator
  this.resolver = new XPathResolver();

  /* XXX ajvincent Bug 360207 prevents us from doing any sanity checks
   * on users setting searchFlags (getters/setters don't work right now
   * with CAPS).  We should be able to validate what users set it to.
   */
  // nsIXPathGenerator
  this.searchFlags = 0;
}
XPathGenerator.prototype = {
  /**
   * Get an XPath step, without index, based on the current iterator node.
   *
   * @param aNode Node to generate a step from.
   *
   * @return step  XPath step retrieved.
   * @return idval id attribute value.
   */
  getStepWithoutIndex: function getStepWithoutIndex(aNode) {
    // This will throw if it isn't a node.  We need this for xpcshell tests.
    aNode.QueryInterface(C_i.nsIDOMNode);

    var step = "";

    switch (aNode.nodeType) {
      case C_i.nsIDOMNode.ELEMENT_NODE:

        aNode.QueryInterface(C_i.nsIDOMElement);

        if (!(this.searchFlags & C_i.nsIXPathGenerator.IGNORE_ID_TYPE_ATTRS)) {
          for (var i = 0; i < aNode.attributes.length; i++) {
            var attrNode = aNode.attributes.item(i);
            if (attrNode.isId) {
              step = "id(" + EscapeQuotes(attrNode.nodeValue) + ")";
              return [step, attrNode.nodeValue];
            }
          }
        }

        var prefix = "";
        if (aNode.namespaceURI) {
          prefix = this.resolver.lookupPrefix(aNode.namespaceURI);
        }

        step = prefix ? prefix + ":" : "";
        step += aNode.localName;
        break;

      case C_i.nsIDOMNode.TEXT_NODE:
      case C_i.nsIDOMNode.CDATA_SECTION_NODE:
        step = "text()";
        break;

      case C_i.nsIDOMNode.PROCESSING_INSTRUCTION_NODE:
        aNode.QueryInterface(C_i.nsIDOMProcessingInstruction);
        step = "processing-instruction('" + aNode.target + "')";
        break;

      case C_i.nsIDOMNode.COMMENT_NODE:
        step = "comment()";
        break;

      case C_i.nsIDOMNode.DOCUMENT_NODE:
      case C_i.nsIDOMNode.DOCUMENT_FRAGMENT_NODE:
        step = "/";
        break;

      default:
        throw ERROR_UNEXPECTED;
    }

    return [step, null];
  },

  /**
   * A single XPath step may match more than one node.  This filter checks
   * the properties of the target node (which is constant, from the
   * tree walker's view) with the current node of the tree walker.  If the
   * two nodes are similar enough - node value, namespace URI, local name,
   * id, etc. - then the XPath step may need an index.  I indicate this by
   * returning FILTER_ACCEPT.  The code calling me determines whether to
   * apply the index based on whether the target node was first, and I
   * found more than one matching node.
   *
   * Because this code will be called very frequently, the idval argument
   * is an optimization, really, to avoid repeated calls to
   * aTargetIterator.id.
   *
   * @param aNode1 First node.
   * @param aNode2 Second node.
   * @param idval  id attribute value for aNode1.
   *
   * @return nsIDOMNodeFilter.FILTER_ACCEPT if the step would match both.
   * @return nsIDOMNodeFilter.FILTER_SKIP   otherwise.
   *
   * @note
   */
  compareNodes: function compareNodes(aNode1, aNode2, idval) {
    if (aNode2 == aNode1) {
      return C_i.nsIDOMNodeFilter.FILTER_ACCEPT;
    }

    if ((aNode1 instanceof C_i.nsIDOMText) &&
        (aNode2 instanceof C_i.nsIDOMText)) {
      return C_i.nsIDOMNodeFilter.FILTER_ACCEPT;
    }

    if (aNode2.nodeType != aNode1.nodeType) {
      return C_i.nsIDOMNodeFilter.FILTER_SKIP;
    }

    if (idval && aNode2.nodeType == C_i.nsIDOMNode.ELEMENT_NODE) {
      for (var i = 0; i < aNode2.attributes.length; i++) {
        var attrNode = aNode2.attributes.item(i);
        if (attrNode.isId) {
          // Stupid page authors.  We'll be nice to them.
          return attrNode.nodeValue == idval ?
                 C_i.nsIDOMNodeFilter.FILTER_ACCEPT :
                 C_i.nsIDOMNodeFilter.FILTER_SKIP;
        }
      }
    }

    if (aNode2.localName != aNode1.localName ||
        aNode2.namespaceURI != aNode1.namespaceURI) {
      return C_i.nsIDOMNodeFilter.FILTER_SKIP;
    }

    return C_i.nsIDOMNodeFilter.FILTER_ACCEPT;
  },

  // nsIXPathGenerator
  addNamespace: function addNamespace(namespaceURI, prefix) {
    this.resolver.addNamespace(namespaceURI, prefix);
  },

  // nsIXPathGenerator
  generateXPath: function generateXPath(targetNode, contextNode) {
    if (!targetNode || !contextNode) {
      throw NULL_POINTER;
    }

    // XPath doesn't support doctypes, so neither do we.
    if (targetNode.nodeType == C_i.nsIDOMNode.DOCUMENT_TYPE_NODE ||
        contextNode.nodeType == C_i.nsIDOMNode.DOCUMENT_TYPE_NODE) {
      throw DOM_NOT_SUPPORTED;
    }

    if (targetNode == contextNode) {
      return ".";
    }

    // Start establishing the common ancestor.
    var fromContextToAncestor = "";
    var contextIterator = contextNode;
    if (contextNode.nodeType == C_i.nsIDOMNode.ATTRIBUTE_NODE) {
      fromContextToAncestor = "..";
      contextNode.QueryInterface(C_i.nsIDOMAttr);
      contextIterator = contextNode.ownerElement;
    }

    var targetIterator = targetNode;
    if (targetNode.nodeType == C_i.nsIDOMNode.ATTRIBUTE_NODE) {
      targetNode.QueryInterface(C_i.nsIDOMAttr);
      targetIterator = targetNode.ownerElement;
    }

    // Unowned attributes will force an abort here.
    if (!targetIterator || !contextIterator) {
      throw ERROR_FAILURE;
    }

    var doc = (targetNode.nodeType == C_i.nsIDOMNode.DOCUMENT_NODE) ?
               targetNode :
               targetNode.ownerDocument;

    // Get the ancestor node.
    // Are the target and context nodes in the same document?
    doc.QueryInterface(C_i.nsIDOMDocumentRange);
    targetIterator.QueryInterface(C_i.nsIDOM3Node);

    var range = doc.createRange();
    try {
      var compare = targetIterator.compareDocumentPosition(contextIterator);
      if (compare & C_i.nsIDOM3Node.DOCUMENT_POSITION_DISCONNECTED) {
        throw ERROR_FAILURE;
      }

      if (compare & C_i.nsIDOM3Node.DOCUMENT_POSITION_PRECEDING) {
        range.setEndAfter(targetIterator);
        if (contextIterator.parentNode) {
          range.setStartBefore(contextIterator)
        } else {
          range.setStart(contextIterator, 0);
        }
      } else {
        range.setEndAfter(contextIterator);
        if (targetIterator.parentNode) {
          range.setStartBefore(targetIterator)
        } else {
          range.setStart(targetIterator, 0);
        }
      }
    } catch (e) {
      /* The whole point of the range is to determine the common ancestor.
       * Exceptions will be triggered when there isn't one.  But all the
       * same, we don't want to feed the user a range error when it's ours.
       */

      throw ERROR_FAILURE;
    }

    var ancestor = range.commonAncestorContainer;
    range.detach();
    range = null;

    /* We now have the ancestor node.  Start generating steps from the target
     * node to the ancestor, in reverse order.  (We skip the path from context
     * to ancestor for now, as that path may be unnecessary.)
     */
    var fromAncestorToTarget = "";
    var prefix;

    if (targetNode.nodeType == C_i.nsIDOMNode.ATTRIBUTE_NODE) {
      // Attributes don't fit cleanly in tree walkers or child nodes.
      prefix = "";
      if (targetNode.namespaceURI) {
        prefix = this.resolver.lookupPrefix(targetNode.namespaceURI);
      }
      fromAncestorToTarget = "@" + (prefix ? prefix + ":" : "");
      fromAncestorToTarget += targetNode.localName;
    }

    // Initialize for walking the tree.
    var step;
    idval = null;
    var total;
    var index;

    var checkPreviousNode = false;
    var prevNode = null;

    if (!(this.searchFlags &
          C_i.nsIXPathGenerator.USE_DESCENDANT_AXIS)) {
      // The user wants a path like "xul:box[2]/xul:textbox/@value".
      while (targetIterator != ancestor) {
        checkPreviousNode = (targetIterator instanceof C_i.nsIDOMText);
        [step, idval] = this.getStepWithoutIndex(targetIterator);

        /* We now have the step, but we may need to find the subscript index.
           The target iterator's index represents the ordinal number in brackets
           at the end of a step.  We will only include the ordinal number if it
           is necessary (if the total number of nodes matching this step is
           greater than one).

           However, we do not support adjacent DOM data nodes when we're trying
           to generate a path to the second DOM node. XPath treats CDATA and
           text nodes as the same type of node, so if a text node follows a
           CDATA node immediately (with no element in between, for example), we
           must report a failure.

           If the child node list is [text, cdata, comment, text], we cannot
           match the cdata node.  If we're trying to match either
           of the text nodes, we will pass.
         */
        var indexIterator = targetIterator.parentNode.firstChild;
        prevNode = null; // There's nothing before the index iterator.
        total = 0;
        index = 0;

        while (indexIterator) {
          var filterValue = this.compareNodes(targetIterator,
                                              indexIterator,
                                              idval);
          if (filterValue == C_i.nsIDOMNodeFilter.FILTER_ACCEPT) {
            total++;

            /* Conditions:
               checkPreviousNode: targetIterator is a data node.
               !index: We haven't determined an index yet.
               indexIterator == targetIterator: We're at the node we would
                 set an index for.
               prevNode instanceof nsIDOMText: We're not at the first child
                 node, and prevNode is a data node.

               If all these conditions are met, we can't absolutely guarantee
               the XPath we generate is correct.
             */
            if (checkPreviousNode && !index &&
                (indexIterator == targetIterator) &&
                (prevNode instanceof C_i.nsIDOMText)) {
              // We don't support two adjacent character data nodes.
              throw ERROR_FAILURE;
            }
          }

          if (indexIterator == targetIterator) {
            index = total;
          }

          prevNode      = indexIterator;
          indexIterator = indexIterator.nextSibling;
        }

        if (total > 1) {
          step += "[" + index + "]";
        }

        // Add the step.
        fromAncestorToTarget = step + "/" + fromAncestorToTarget;
        if (idval) {
          break;
        }

        targetIterator = targetIterator.parentNode;
      } // end while (targetIterator != ancestor)

      var length = fromAncestorToTarget.length;
      if (length &&
          fromAncestorToTarget.charAt(length - 1) == "/") {
        fromAncestorToTarget = fromAncestorToTarget.substr(0, length - 1);
      }
    } // end if (!(this.searchFlags & nsIXPathGenerator.USE_DESCENDANT_AXIS))

    else {
      // The user wants a path like "//xul:textbox[5]/@value".
      [step, idval] = this.getStepWithoutIndex(targetIterator);

      if (step == "/") {
        // How about that?  We're done.
        return step;
      }

      // Make this a descendant axis.
      step = "descendant::" + step;

      checkPreviousNode = (targetIterator instanceof C_i.nsIDOMText);

      var filterType = checkPreviousNode ?
                       (C_i.nsIDOMNodeFilter.SHOW_TEXT |
                        C_i.nsIDOMNodeFilter.SHOW_CDATA_SECTION) :
                       1 << (targetIterator.nodeType - 1);

      var filter = {
        target: targetIterator,
        compareNodes: this.compareNodes,
        acceptNode: function acceptNode(aNode) {
          return this.compareNodes(this.target, aNode, idval);
        }
      }

      doc.QueryInterface(C_i.nsIDOMDocumentTraversal);
      var walker = doc.createTreeWalker(ancestor, filterType, filter, true);
      total = 0;
      index = 0;

      /* We now have the step, but we may need to find the subscript index.
         The target iterator's index represents the ordinal number in brackets
         at the end of a step.  We will only include the ordinal number if it
         is necessary (if the total number of nodes matching this step is
         greater than one).

         However, we do not support adjacent DOM data nodes when we're trying
         to generate a path to the second DOM node. XPath treats CDATA and
         text nodes as the same type of node, so if a text node follows a
         CDATA node immediately (with no element in between, for example), we
         must report a failure.

         If the descendant node list is [text, cdata, comment, text], we cannot
         match the cdata node.  If we're trying to match either
         of the text nodes, we will pass.
       */
      while (walker.nextNode()) {
        indexIterator = walker.currentNode;
        total++;
        prevNode = indexIterator.previousSibling;

        /* Conditions:
           checkPreviousNode: targetIterator is a data node.
           !index: We haven't determined an index yet.
           indexIterator == targetIterator: We're at the node we would
             set an index for.
           prevNode instanceof nsIDOMText: We're not at the first child
             node, and prevNode is a data node.

           If all these conditions are met, we can't absolutely guarantee
           the XPath we generate is correct.
         */
        if (checkPreviousNode &&
            !index &&
            (indexIterator == targetIterator) &&
            (prevNode instanceof C_i.nsIDOMText)) {
            // We don't support two adjacent character data nodes.
          throw ERROR_FAILURE;
        }

        if (indexIterator == targetIterator) {
          index = total;
        }
      }
      walker = null;

      if (total > 1) {
        step += "[" + index + "]";
      }

      if (fromAncestorToTarget.charAt(0) == "@") {
        fromAncestorToTarget = step + "/" + fromAncestorToTarget;
      } else {
        fromAncestorToTarget = step;
      }
    } // end if (this.searchFlags & nsIXPathGenerator.USE_DESCENDANT_AXIS)

    if (idval) {
      // We got an ID attribute, so context-to-ancestor doesn't mean anything.
      return fromAncestorToTarget;
    }

    // Generate the path from context node to ancestor.
    while (contextIterator != ancestor) {
      if (fromContextToAncestor) {
        fromContextToAncestor += "/";
      }
      fromContextToAncestor += "..";
      contextIterator = contextIterator.parentNode;
    }

    // Join the path from context to ancestor and from ancestor to target.
    if (fromContextToAncestor && fromAncestorToTarget &&
        (fromAncestorToTarget.substr(0, 2) != "//")) {
      fromContextToAncestor += "/";
    }

    return fromContextToAncestor + fromAncestorToTarget;
  },

  // nsIClassInfo
  getInterfaces: function getInterfaces(aCount) {
    var array = [C_i.nsIXPathGenerator,
                 C_i.nsIClassInfo];
    aCount.value = array.length;
    return array;
  },
  getHelperForLanguage: function getHelperForLanguage(aLanguage) {
    return null;
  },
  contractID: "@mozilla.org/xpath-generator;1",
  classDescription: "XPathGenerator",
  classID: Components.ID("{f37163a2-596f-4dfe-a2af-3aea378615d5}"),
  implementationLanguage: C_i.nsIProgrammingLanguage.JAVASCRIPT,
  flags: C_i.nsIClassInfo.DOM_OBJECT | C_i.nsIClassInfo.MAIN_THREAD_ONLY,

  // nsISupports
  QueryInterface: function QueryInterface(aIID) {
    if (aIID.equals(C_i.nsIXPathGenerator) ||
        aIID.equals(C_i.nsIClassInfo) ||
        aIID.equals(C_i.nsISupports))
      return this;

    throw NO_INTERFACE;
  }
};

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var NSGetModule = XPCOMUtils.generateNSGetModule(
  [
    XPathResolver,
    XPathGenerator
  ],
  function postRegister() {
    catMan.addCategoryEntry("JavaScript global privileged property",
                            "XPathGenerator",
                            XPathGenerator.prototype.contractID,
                            true,  /* Persist this entry */
                            true); /* Replace existing entry */
  },
  function preUnregister() {
  }
);
