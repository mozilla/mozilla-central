var tab1, tab2;

function focus_in_navbar()
{
  var parent = document.activeElement.parentNode;
  while (parent && parent.id != "nav-bar")
    parent = parent.parentNode;

  return (parent != null);
}

function test()
{
  waitForExplicitFinish();

  tab1 = gBrowser.addTab();
  tab2 = gBrowser.addTab();

  EventUtils.synthesizeMouse(tab1, 9, 9, {});
  setTimeout(step2, 0);
}

function step2()
{
  is(gBrowser.selectedTab, tab1, "mouse on tab selects tab");
  isnot(document.activeElement, tab1, "mouse on tab not activeElement");

  EventUtils.synthesizeMouse(tab1, 9, 9, {});
  setTimeout(step3, 0);
}

function step3()
{
  isnot(document.activeElement, tab1, "mouse on tab again activeElement");

  document.getElementById("urlbar").focus();
  while (focus_in_navbar())
    EventUtils.synthesizeKey("VK_TAB", { });

  is(document.activeElement, tab1, "tab key to tab activeElement");

  EventUtils.synthesizeMouse(tab1, 9, 9, {});
  setTimeout(step4, 0);
}

function step4()
{
  is(document.activeElement, tab1, "mouse on tab while focused still activeElement");

  EventUtils.synthesizeMouse(tab2, 9, 9, {});
  setTimeout(step5, 0);
}

function step5()
{
  // The tabbox selects a tab within a setTimeout in a bubbling mousedown event
  // listener, and focuses the current tab if another tab previously had focus.
  is(document.activeElement, tab2, "mouse on another tab while focused still activeElement");

  content.focus();
  EventUtils.synthesizeMouse(tab2, 9, 30, {button: 1, type: "mousedown"});
  setTimeout(step6, 0);
}

function step6()
{
  isnot(document.activeElement, tab2, "tab not focused via middle click");

  gBrowser.removeTab(tab1);
  gBrowser.removeTab(tab2);

  finish();
}
