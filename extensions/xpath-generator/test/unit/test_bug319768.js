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

var _nodesList = null;
var generator = null;
var genResolver = null;
var doc = null;

const C_i = Components.interfaces;

/**
 * Get a list of nodes to run the test on.
 */
function getNodesList() {
  if (_nodesList)
    return _nodesList;

  doc.QueryInterface(C_i.nsIDOMDocumentTraversal);
  var walker = doc.createTreeWalker(doc,
                                    C_i.nsIDOMNodeFilter.SHOW_ALL,
                                    null,
                                    true);
  var nodesList = [doc];
  var i;
  var node;
  while (walker.nextNode()) {
    node = walker.currentNode;
    nodesList[nodesList.length] = node;
    if (node instanceof C_i.nsIDOMElement) {
      for (i = 0; i < node.attributes.length; i++) {
        nodesList[nodesList.length] = node.attributes.item(i);
      }
    }
  }
  walker = null;

  // Let's throw a spanner in the works.
  var frag = doc.createDocumentFragment();
  nodesList[nodesList.length] = frag;
  node = doc.createElement("foo");
  frag.appendChild(node);
  nodesList[nodesList.length] = node;
  node.setAttribute("one", "green");
  node.setAttribute("two", "truck");
  for (i = 0; i < node.attributes.length; i++)
  {
    nodesList[nodesList.length] = node.attributes.item(i);
  }
  nodesList[nodesList.length] = doc.createAttribute("disconnected");

  for (i = 0; i < nodesList.length; i++) {
    do_check_true(Boolean(nodesList[i]));
  }

  _nodesList = nodesList;
  return _nodesList;
}

function runSingleTest(i, j, searchFlags) {
  generator.searchFlags = searchFlags;

  var nodesList = getNodesList();
  var targetNode = nodesList[i];
  var contextNode = nodesList[j];
  var path = null;
  var status = "success";
  var failureReport = null;
  var err = null;

  targetNode.QueryInterface(C_i.nsIDOMNode);
  contextNode.QueryInterface(C_i.nsIDOMNode);

  /* Checks to see if we should fail */
  if (targetNode.nodeType == C_i.nsIDOMNode.DOCUMENT_TYPE_NODE) {
    status = "failure-expected";
  }

  if (contextNode.nodeType == C_i.nsIDOMNode.DOCUMENT_TYPE_NODE) {
    status = "failure-expected";
  }

  if ((targetNode instanceof C_i.nsIDOMText) &&
      (targetNode.previousSibling instanceof C_i.nsIDOMText) &&
      (targetNode != contextNode)) {
    status = "failure-expected";
  }

  var positionNode;

  if (targetNode.nodeType == C_i.nsIDOMNode.ATTRIBUTE_NODE) {
    targetNode.QueryInterface(C_i.nsIDOMAttr);
    positionNode = targetNode.ownerElement;
  } else {
    positionNode = targetNode;
  }

  var compareNode;
  if (contextNode.nodeType == C_i.nsIDOMNode.ATTRIBUTE_NODE) {
    contextNode.QueryInterface(C_i.nsIDOMAttr);
    compareNode = contextNode.ownerElement;
  } else {
    compareNode = contextNode;
  }

  if (targetNode == contextNode) {
    positionNode = targetNode;
    compareNode = targetNode;
  }

  if (positionNode && compareNode) {
    positionNode.QueryInterface(C_i.nsIDOM3Node);
    try {
      position = positionNode.compareDocumentPosition(compareNode);
    }
    catch (e) {
      position = C_i.nsIDOM3Node.DOCUMENT_POSITION_DISCONNECTED;
    }
  } else {
    position = C_i.nsIDOM3Node.DOCUMENT_POSITION_DISCONNECTED;
  }

  if (position & C_i.nsIDOM3Node.DOCUMENT_POSITION_DISCONNECTED) {
    status = "failure-expected";
  }

  var err = null;

  try {
    path = generator.generateXPath(targetNode, contextNode);
  }
  catch (e) {
    if (status == "failure-expected")
      status = "success";
    else
      status = "test-failed";

    failureReport = {
      i: i,
      j: j,
      targetNode: targetNode,
      contextNode: contextNode,
      err: e,
      path: path,
      status: status
    }
    err = e;
  }

  if (!err) {
    const UNORDERED_NODE = C_i.nsIDOMXPathResult.ANY_UNORDERED_NODE_TYPE;
    doc.QueryInterface(C_i.nsIDOMXPathEvaluator);
    try {
      var expr = doc.createExpression(path, genResolver);
      var xpathResult = expr.evaluate(contextNode, UNORDERED_NODE, null);
      xpathResult.QueryInterface(C_i.nsIDOMXPathResult);

      var checkNode = xpathResult.singleNodeValue;

      if (checkNode != targetNode) {
        status = "test-failed";
        failureReport = {
          i: i,
          j: j,
          targetNode: targetNode,
          contextNode: contextNode,
          path: path,
          checkNode: checkNode,
          status: status,
          err: null
        }
      }
    } catch (e) {
      status = "busted";
      failureReport = {
        i: i,
        j: j,
        targetNode: targetNode,
        contextNode: contextNode,
        err: e,
        path: path,
        status: status
      }
      err = e;
    }
  }

  return {
    status: status,
    failureReport: failureReport,
    err: err,
    path: path
  };
}

var failCount;

function runTestSuite(aSearchFlags) {
  var nodesList = getNodesList();
  var j;

  for (i = 0; i < nodesList.length; i++) {
    var targetNode = nodesList[i];
    for (j = 0; j < nodesList.length; j++) {
      var contextNode = nodesList[j];

      var results = runSingleTest(i, j, aSearchFlags);
      var status = results.status;

      if (status == "failure-expected") {
        failCount[failCount.length] = {
          i: i,
          j: j,
          targetNode: targetNode,
          contextNode: contextNode,
          path: results.path,
          status: status,
          searchFlags: aSearchFlags,
          err: null
        }
      } else if (results.failureReport && status != "success") {
        results.failureReport.searchFlags = aSearchFlags;
        failCount[failCount.length] = results.failureReport;
      }
    } // end for (j = 0; j < nodesList.length; j++)
  } // end for (i = 0; i < nodesList.length; i++)
}

function run_test() {
  generator = Components.classes["@mozilla.org/xpath-generator;1"]
                        .createInstance(C_i.nsIXPathGenerator);
  genResolver = generator.resolver;
  const MAX_FLAGS = C_i.nsIXPathGenerator.IGNORE_ID_TYPE_ATTRS |
                    C_i.nsIXPathGenerator.USE_DESCENDANT_AXIS;

  // Check namespace handling.
  generator.addNamespace("foo namespace 1", "foo");
  do_check_eq(genResolver.lookupNamespaceURI("foo"), "foo namespace 1");

  const filePath = "/extensions/xpath-generator/test/unit/test_xpathgen.xml";
  doc = do_parse_document(filePath, "application/xml");
  do_check_true(doc.documentElement.localName != "parsererror");

  failCount = [];
  for (var i = 0; i <= MAX_FLAGS; i++) {
    runTestSuite(i);
  }

  doc = null;
  genResolver = null;
  generator = null;

  /* Known failures:
({i:49, j:49,
  targetNode: nsIDOMDocumentFragment,
  contextNode: nsIDOMDocumentFragment,
  path:".", status:"busted", searchFlags:0,
  err:NS_ERROR_FAILURE})

({i:50, j:49,
  targetNode: nsIDOMElement (parent == nsIDOMDocumentFragment 49),
  contextNode: nsIDOMDocumentFragment,
  path:"foo", status:"busted", searchFlags:0,
  err: NS_ERROR_FAILURE})

({i:51, j:49,
  targetNode: nsIDOMAttr (ownerElement == nsIDOMElement 50),
  contextNode: nsIDOMDocumentFragment,
  path:"foo/@one", status:"busted", searchFlags:0
  err: NS_ERROR_FAILURE})

({i:52, j:49,
  targetNode: nsIDOMAttr (ownerElement == nsIDOMElement 49),
  contextNode: nsIDOMDocumentFragment,
  path:"foo/@two", status:"busted", searchFlags:0,
  err: NS_ERROR_FAILURE})

({i:53, j:53,
  targetNode: nsIDOMAttr (ownerElement == null),
  contextNode: nsIDOMAttr (ownerElement == null),
  path:".", status:"busted", searchFlags:0,
  err: NS_ERROR_OUT_OF_MEMORY})
   */

  const EXPECTED_FAILURES = (MAX_FLAGS + 1) * 5;

  if (failCount.length != EXPECTED_FAILURES) {
    for (i = 0; i < failCount.length; i++) {
      failCount[i].targetNode = failCount[i].targetNode ?
                                failCount[i].targetNode.toString() :
                                null;
      failCount[i].contextNode = failCount[i].contextNode ?
                                 failCount[i].contextNode.toString() :
                                 null;
      failCount[i].err = failCount[i].err ?
                         failCount[i].err.toString() :
                         null;
      failCount[i] = failCount[i].toSource();
    }
    dump("\n\n");
    dump(failCount.join("\n\n"));
    dump("\n\n");
    dump("expected test failures: " + EXPECTED_FAILURES + "\n");
    do_throw("actual tests failed: " + failCount.length + "\n");
  }
}
