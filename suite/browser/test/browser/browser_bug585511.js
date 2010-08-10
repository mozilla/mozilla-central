/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

function test() {
  is(getBrowser().tabs.length, 1, "one tab is open initially");
  is(getBrowser().browsers.length, getBrowser().tabs.length, ".browsers is in sync");

  // Add several new tabs
  let tab1 = getBrowser().addTab("http://mochi.test:8888/#1");
  let tab2 = getBrowser().addTab("http://mochi.test:8888/#2");
  let tab3 = getBrowser().addTab("http://mochi.test:8888/#3");
  is(getBrowser().tabs.length, 4, "four tabs are open");
  is(getBrowser().browsers.length, getBrowser().tabs.length, ".browsers is in sync");
  getBrowser().removeTab(tab2);
  is(getBrowser().tabs.length, 3, "three tabs are open");
  is(getBrowser().browsers.length, getBrowser().tabs.length, ".browsers is in sync");
  getBrowser().removeTab(tab1);
  is(getBrowser().tabs.length, 2, "two tabs are open");
  is(getBrowser().browsers.length, getBrowser().tabs.length, ".browsers is in sync");
  getBrowser().removeTab(tab3);
  is(getBrowser().tabs.length, 1, "we've closed all our tabs");
  is(getBrowser().browsers.length, getBrowser().tabs.length, ".browsers is in sync");
}
