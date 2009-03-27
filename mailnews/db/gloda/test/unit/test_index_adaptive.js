/*
 * Test our adaptive indexing logic; the thing that tries to adjust our
 *  indexing constants based on perceived processor utilization.  We fake all
 *  the load stuff, of course.
 * 
 * Out of necessity, this test knows about the internals of the adaptive
 *  indexing logic.
 */

load("resources/glodaTestHelper.js");
load("resources/mockIndexer.js");
load("resources/mockTimer.js");

/* ===== Mock Objects ==== */

var FakeStopwatch = {
  /* (fake) public interface */
  start: function () {
    this.running = true;
    dump("stopwatch started\n");
  },
  stop: function() {
    this.running = false;
    dump("stopwatch stopped\n");
  },
  // just always claim we're 2 seconds...
  realTimeSeconds: 2.0,
  cpuTimeSeconds: 0.0,
  /* mock support */
  running: false,
  
  tooMuch: function() {
    this.cpuTimeSeconds = this.realTimeSeconds;
  },
  tooLittle: function() {
    this.cpuTimeSeconds = 0.0;
  },
  justRight: function() {
    this.cpuTimeSeconds = this.realTimeSeconds * GlodaIndexer._cpuTarget - 0.05;
  }
};

// hack in our stopwatch
GlodaIndexer._perfStopwatch = FakeStopwatch;
// hack in a timer for the stopwatch control
var perfTimer = new MockTimer(GlodaIndexer, "_perfTimer");

/* ===== Helpers ===== */
function fireCleanStabilizeAverage() {
  GlodaIndexer._perfSamples = [];
  for (let iFire = 0; iFire < GlodaIndexer._perfSamplePointCount; iFire++)
    perfTimer.fireNow();
}

/* ===== Tests ===== */

function test_sample_when_you_should() {
  // imsInit clobbered this, put it back.
  GlodaIndexer._indexInterval = GlodaIndexer._indexInterval_whenActive;
  
  do_check_false(FakeStopwatch.running);
  do_check_false(perfTimer.active);
  
  MockIndexer.indexForever();
  
  do_check_true(FakeStopwatch.running);
  do_check_true(perfTimer.active);
  
  next_test();
}

function test_throttle_up() {
  let preTokens = GlodaIndexer._indexTokens;
  let preInterval =  GlodaIndexer._indexInterval;
  
  FakeStopwatch.tooLittle();
  // fire one too few times, verify that nothing happens for those pre-firing
  //  times... (this only matters for the first time we sample per the sampler
  //  being active...)
  for (let iFire = 1; iFire < GlodaIndexer._perfSamplePointCount; iFire++) {
    perfTimer.fireNow();
    do_check_eq(preTokens, GlodaIndexer._indexTokens);
    do_check_eq(preInterval, GlodaIndexer._indexInterval);
  }
  // now fire with some actual effect
  perfTimer.fireNow();
  
  // make sure everything went in the right direction
  do_check_true(preTokens <= GlodaIndexer._indexTokens);
  do_check_true(preInterval >= GlodaIndexer._indexInterval);
  // make sure something actually happened
  do_check_true(((GlodaIndexer._indexTokens - preTokens) > 0) ||
                ((preInterval - GlodaIndexer._indexInterval) > 0));
                
  next_test();
}

function test_throttle_down() {
  let preTokens = GlodaIndexer._indexTokens;
  let preInterval =  GlodaIndexer._indexInterval;

  FakeStopwatch.tooMuch();
  fireCleanStabilizeAverage();

  // make sure everything went in the right direction
  do_check_true(preTokens >= GlodaIndexer._indexTokens);
  do_check_true(preInterval <= GlodaIndexer._indexInterval);
  // make sure something actually happened
  do_check_true(((GlodaIndexer._indexTokens - preTokens) < 0) ||
                ((preInterval - GlodaIndexer._indexInterval) < 0));
  
  next_test();
}

function test_nop_on_stable() {

  let preTokens = GlodaIndexer._indexTokens;
  let preInterval =  GlodaIndexer._indexInterval;

  FakeStopwatch.justRight();
  fireCleanStabilizeAverage();

  // make sure nothing happened
  do_check_eq(preTokens, GlodaIndexer._indexTokens);
  do_check_eq(preInterval, GlodaIndexer._indexInterval);
  
  next_test();
}

var MAX_STEPS_TO_CAPS = 100;

function test_cap_slowest() {
  FakeStopwatch.tooMuch();

  GlodaIndexer._perfSamples = [];
  
  let lastTokens = GlodaIndexer._indexTokens;
  let lastInterval =  GlodaIndexer._indexInterval;
  for (let steps = MAX_STEPS_TO_CAPS; steps; steps--) {
    perfTimer.fireNow();
    
    // make sure we're always moving in the right directions
    do_check_true(lastTokens >= GlodaIndexer._indexTokens);
    do_check_true(lastInterval <= GlodaIndexer._indexInterval);
    lastTokens = GlodaIndexer._indexTokens;
    lastInterval = GlodaIndexer._indexInterval;
    
    // make sure we never go above the cap
    do_check_true(GlodaIndexer._indexInterval <=
                  GlodaIndexer._MAX_TIMER_INTERVAL_MS);
    // if we have hit the cap, give it a few more spins 
    if (GlodaIndexer._indexInterval == GlodaIndexer._MAX_TIMER_INTERVAL_MS &&
        steps > 5)
      steps = 5;
  }
  // make sure we actual did hit the cap
  do_check_eq(GlodaIndexer._indexInterval, GlodaIndexer._MAX_TIMER_INTERVAL_MS);
  
  next_test();
}

function test_cap_fastest() {
  FakeStopwatch.tooLittle();
  
  GlodaIndexer._perfSamples = [];
  
  let lastTokens = GlodaIndexer._indexTokens;
  let lastInterval =  GlodaIndexer._indexInterval;
  for (let steps = MAX_STEPS_TO_CAPS; steps; steps--) {
    perfTimer.fireNow();
    
    // make sure we're always moving in the right directions
    do_check_true(lastTokens <= GlodaIndexer._indexTokens);
    do_check_true(lastInterval >= GlodaIndexer._indexInterval);
    lastTokens = GlodaIndexer._indexTokens;
    lastInterval = GlodaIndexer._indexInterval;
    
    // make sure we never go below the cap
    do_check_true(GlodaIndexer._indexInterval >=
                  GlodaIndexer._MIN_TIMER_INTERVAL_MS);
    // if we have hit the cap, give it a few more spins 
    if (GlodaIndexer._indexInterval == GlodaIndexer._MIN_TIMER_INTERVAL_MS &&
        steps > 5)
      steps = 5;
  }
  // make sure we actual did hit the cap
  do_check_eq(GlodaIndexer._indexInterval, GlodaIndexer._MIN_TIMER_INTERVAL_MS);
  
  next_test();
}

function test_idle() {
  let activeTokens = GlodaIndexer._indexTokens;
  let activeInterval =  GlodaIndexer._indexInterval;
  
  // go idle, make sure we switch to the right set of constants
  GlodaIndexer.observe(null, "idle", null);
  do_check_eq(GlodaIndexer._cpuTarget, GlodaIndexer._cpuTarget_whenIdle);
  do_check_eq(GlodaIndexer._indexInterval,
              GlodaIndexer._indexInterval_whenIdle);
  do_check_eq(GlodaIndexer._indexTokens, GlodaIndexer._indexTokens_whenIdle);
  
  // go active, make sure we switch back
  GlodaIndexer.observe(null, "back", null);
  do_check_eq(GlodaIndexer._cpuTarget, GlodaIndexer._cpuTarget_whenActive);
  do_check_eq(GlodaIndexer._indexInterval,
              GlodaIndexer._indexInterval_whenActive);
  do_check_eq(GlodaIndexer._indexTokens, GlodaIndexer._indexTokens_whenActive);
  
  // also make sure that what we switched to was what we were using before idle
  //  happened...
  do_check_eq(activeTokens, GlodaIndexer._indexTokens);
  do_check_eq(activeInterval, GlodaIndexer._indexInterval);
  
  next_test();
}

function test_stop_sampling_when_done() {
  do_check_true(FakeStopwatch.running);

  runOnIndexingComplete(function() {
    do_check_false(FakeStopwatch.running);
    do_check_false(perfTimer.active);
  
    next_test();
  });
  
  MockIndexer.stopIndexingForever();
}

/* ===== Driver ====== */

var tests = [
  test_sample_when_you_should,
  test_throttle_up,
  test_throttle_down,
  test_nop_on_stable,
  test_cap_slowest,
  test_cap_fastest,
  test_idle,
  test_stop_sampling_when_done
];

function run_test() {
  glodaHelperRunTests(tests);
}
