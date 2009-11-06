/**
 * A mock gloda indexer.  Right now it just exists to let us cause the indexer
 *  to think it is indexing but really have nothing going on.
 */
var MockIndexer = {
  /* public interface */
  name: "mock_indexer",
  enable: function() {
    this.enabled = true;
  },
  disable: function() {
    this.enabled = false;
  },
  get workers() {
    return [["forever", this._worker_index_forever]];
  },
  initialSweep: function() {
    this.initialSweepCalled = false;
  },
  /* mock interface */
  enabled: false,
  initialSweepCalled: false,
  indexForever: function() {
    GlodaIndexer.indexJob(new IndexingJob("forever", null));
  },
  stopIndexingForever: function() {
    GlodaIndexer.callbackDriver();
  },
  /* implementation */
  _worker_index_forever: function(aJob, aCallbackHandle) {
    // pretend that something async is happening, but nothing is really
    //  happening!  muahahaha!
    //
    yield GlodaIndexer.kWorkAsync;
    yield GlodaIndexer.kWorkDone;
  }
};
GlodaIndexer.registerIndexer(MockIndexer);
