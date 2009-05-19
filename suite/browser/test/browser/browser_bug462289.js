var tab1, tab2;

function test() {
  waitForExplicitFinish();

  tab1 = gBrowser.addTab();
  tab2 = gBrowser.addTab();
  setTimeout(step1, 0);
}

function step1() {
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
  todo_is(document.activeElement, tab1, "mouse on tab again activeElement");

  document.getElementById("urlbar").inputField.focus();
  // give focus a chance to settle
  setTimeout(step3_5, 0);
}

function step3_5()
{
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
  is(document.activeElement, tab2, "mouse on another tab while focused still activeElement");

  gBrowser.removeTab(tab1);
  gBrowser.removeTab(tab2);

  finish();
}
