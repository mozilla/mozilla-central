function test() {
  const TEST_URI = "http://example.com/browser/browser/devtools/commandline/" +
                   "test/browser_dbg_cmd.html";

  DeveloperToolbarTest.test(TEST_URI, function() {
    testDbgCmd();
  });
}

function testCommands(dbg, cmd) {
  // Wait for the initial resume...
  dbg._controller.activeThread.addOneTimeListener("resumed", function () {
    info("Starting tests.");

    let contentDoc = content.window.document;
    let output = contentDoc.querySelector("input[type=text]");
    let btnDoit = contentDoc.querySelector("input[type=button]");

    cmd("dbg interrupt", function() {
      ok(true, "debugger is paused");
      dbg._controller.activeThread.addOneTimeListener("resumed", function () {
        ok(true, "debugger continued");
        dbg._controller.activeThread.addOneTimeListener("paused", function() {
          cmd("dbg step in", function() {
            cmd("dbg step in", function() {
              cmd("dbg step in", function() {
                is(output.value, "step in", "debugger stepped in");
                cmd("dbg step over", function() {
                  is(output.value, "step over", "debugger stepped over");
                  cmd("dbg step out", function() {
                    is(output.value, "step out", "debugger stepped out");
                    cmd("dbg continue", function() {
                      cmd("dbg continue", function() {
                        is(output.value, "dbg continue", "debugger continued");
                        DeveloperToolbarTest.exec({
                          typed: "dbg close",
                          blankOutput: true
                        });

                        let tab = gBrowser.selectedTab;
                        ok(!gDevTools.getToolboxForTarget(tab),
                          "Debugger was closed.");
                        finish();
                      });
                    });
                  });
                });
              });
            });
          });
        });
        EventUtils.sendMouseEvent({type:"click"}, btnDoit);
      });
      DeveloperToolbarTest.exec({
        typed: "dbg continue",
        blankOutput: true
      });
    });
  });
}

function testDbgCmd() {
  DeveloperToolbarTest.exec({
    typed: "dbg open",
    blankOutput: true
  });

  let tab = gBrowser.selectedTab;
  let toolbox = gDevTools.getToolboxForTarget(tab);

  toolbox.once("jsdebugger-ready", function dbgReady() {
    let dbg = gDevTools.getPanelForTarget("jsdebugger", gBrowser.selectedTab);
    ok(dbg, "DebuggerPanel exists");

    function cmd(aTyped, aCallback) {
      dbg._controller.activeThread.addOneTimeListener("paused", aCallback);
      DeveloperToolbarTest.exec({
        typed: aTyped,
        blankOutput: true
      });
    }

    if (dbg._controller.activeThread) {
      testCommands(dbg, cmd);
    } else {
      dbg.once("connected", testCommands.bind(null, dbg, cmd));
    }
  });
}
