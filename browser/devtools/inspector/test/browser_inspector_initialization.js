/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
let doc;
let salutation;

function createDocument()
{
  doc.body.innerHTML = '<div id="first" style="{ margin: 10em; ' +
    'font-size: 14pt; font-family: helvetica, sans-serif; color: #AAA}">\n' +
    '<h1>Some header text</h1>\n' +
    '<p id="salutation" style="{font-size: 12pt}">hi.</p>\n' +
    '<p id="body" style="{font-size: 12pt}">I am a test-case. This text exists ' +
    'solely to provide some things to test the inspector initialization.</p>\n' +
    'If you are reading this, you should go do something else instead. Maybe ' +
    'read a book. Or better yet, write some test-cases for another bit of code. ' +
    '<span style="{font-style: italic}">Maybe more inspector test-cases!</span></p>\n' +
    '<p id="closing">end transmission</p>\n' +
    '</div>';
  doc.title = "Inspector Initialization Test";

  let tab = gBrowser.selectedTab;
  let toolbox = gDevTools.openToolForTab("inspector", tab);
  toolbox.once("inspector-ready", function(event, panel) {
    let inspector = gDevTools.getPanelForTarget("inspector", tab);
    startInspectorTests();
  });
}

function startInspectorTests()
{
  ok(true, "Inspector started, and notification received.");

  let tab = gBrowser.selectedTab;
  let inspector = gDevTools.getPanelForTarget("inspector", tab);

  ok(inspector, "Inspector instance is accessible");
  ok(inspector.isReady, "Inspector instance is ready");
  is(inspector.target.tab, gBrowser.selectedTab, "Valid target");
  ok(inspector.highlighter, "Highlighter is up");

  let p = doc.querySelector("p");

  inspector.selection.setNode(p);

  testHighlighter(p);
  testMarkupView(p);
  testBreadcrumbs(p);
  // FIXME: testSidebars(p);

  let span = doc.querySelector("span");

  inspector.selection.setNode(span);

  testHighlighter(span);
  testMarkupView(span);
  testBreadcrumbs(span);
  // FIXME: testSidebars(span);

  let toolbox = gDevTools.openToolForTab("inspector", gBrowser.selectedTab);
  toolbox.once("destroyed", function() {
    ok("true", "'destroyed' notification received.");
    let toolbox = gDevTools.getToolboxForTarget(gBrowser.selectedTab);
    ok(!toolbox, "Toolbox destroyed.");
    executeSoon(runContextMenuTest);
  });
  toolbox.destroy();
}


function testHighlighter(node)
{
  ok(isHighlighting(), "Highlighter is highlighting");
  is(getHighlitNode(), node, "Right node is highlighted");
}

function testMarkupView(node)
{
  let i = getActiveInspector();
  is(i.markup._selectedContainer.node, node, "Right node is selected in the markup view");
}

function testBreadcrumbs(node)
{
  let b = getActiveInspector().breadcrumbs;
  let expectedText = b.prettyPrintNodeAsText(node);
  let button = b.container.querySelector("button[checked=true]");
  ok(button, "A crumbs is checked=true");
  ok(button.getAttribute("tooltiptext"), expectedText, "Crumb refers to the right node");
}

function _clickOnInspectMenuItem(node) {
  document.popupNode = node;
  var contentAreaContextMenu = document.getElementById("contentAreaContextMenu");
  var contextMenu = new nsContextMenu(contentAreaContextMenu, gBrowser);
  contextMenu.inspectNode();
}

function runContextMenuTest()
{
  salutation = doc.getElementById("salutation");
  _clickOnInspectMenuItem(salutation);
  executeSoon(function() {
    let inspector = gDevTools.getPanelForTarget("inspector", gBrowser.selectedTab);
    if (inspector && inspector.isReady) {
      executeSoon(testInitialNodeIsSelected);
    } else {
      let toolbox = gDevTools.openToolForTab("inspector", gBrowser.selectedTab);
      toolbox.once("inspector-ready", function(event, panel) {
        executeSoon(testInitialNodeIsSelected);
      });
    }
  });
}

function testInitialNodeIsSelected() {
  testHighlighter(salutation);
  testMarkupView(salutation);
  testBreadcrumbs(salutation);
  inspectNodesFromContextTestWhileOpen();
}

function inspectNodesFromContextTestWhileOpen()
{
  let closing = doc.getElementById("closing");
  getActiveInspector().selection.once("new-node", function() {
    ok(true, "Get selection's 'new-node' selection");
    executeSoon(function() {
      testHighlighter(closing);
      testMarkupView(closing);
      testBreadcrumbs(closing);
      finishInspectorTests();
    }
  )});
  _clickOnInspectMenuItem(closing);
}

function finishInspectorTests(subject, topic, aWinIdString)
{
  gBrowser.removeCurrentTab();
  finish();
}

function test()
{
  waitForExplicitFinish();
  gBrowser.selectedTab = gBrowser.addTab();
  gBrowser.selectedBrowser.addEventListener("load", function() {
    gBrowser.selectedBrowser.removeEventListener("load", arguments.callee, true);
    doc = content.document;
    waitForFocus(createDocument, content);
  }, true);

  content.location = "data:text/html,basic tests for inspector";
}

