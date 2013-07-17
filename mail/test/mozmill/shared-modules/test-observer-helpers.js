/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

const MODULE_NAME = "observer-helpers";

function installInto(module) {
  module.ObservationRecorder = ObservationRecorder;
}

/**
 * ObservationRecorder observes events, and records its observations for
 * later analysis.
 */
function ObservationRecorder() {
  this.reset();
}

ObservationRecorder.prototype = {
  /**
   * Called by the Observer Service when an event is fired.
   */
  observe: function OR_observe(aSubject, aTopic, aData) {
    if (this._topics.indexOf(aTopic) != -1) {
      if (!(aTopic in this.saw))
        this.saw[aTopic] = 0;

      this.saw[aTopic] += 1;

      if (!(aTopic in this.subject))
        this.subject[aTopic] = [];

      this.subject[aTopic].push(aSubject);

      if (!(aTopic in this.data))
        this.data[aTopic] = [];

      this.data[aTopic].push(aData);
    }
  },

  /**
   * Puts the observer back into its starting state.
   */
  reset: function OR_reset() {
    this.saw = {};
    this.data = {};
    this.subject = {};
    this._topics = [];
  },

  /**
   * Resets observations for one or more particular topics.
   *
   * @param aTopics A string representing the topic that we should
   *                be resetting observations for.  You can also
   *                pass in an Array of strings.
   *
   * Example:  obs.resetTopic("topic");
   *           obs.resetTopic(["topic1", "topic2"]);
   */
  resetTopic: function OR_resetTopic(aTopics) {
    if (!Array.isArray(aTopics))
      aTopics = [aTopics];

    for (let [, topic] in Iterator(aTopics)) {
      if (topic in this.saw)
        delete this.saw[topic];
      if (topic in this.subject)
        delete this.subject[topic];
      if (topic in this.data)
        delete this.data[topic];
    }
  },

  /**
   * Gets the ObservationRecorder ready to observe events.  Must be called
   * before any recording can be done. Subsequent calls to planFor will
   * add to the list of topics that the ObservationRecorder is ready for.
   *
   * @param aTopics A string representing the topic that the ObservationRecorder
   *                should be observing.  You can also pass in an Array of
   *                strings.
   *
   * Example:  obs.planFor("topic");
   *           obs.planFor(["topic1", "topic2"]);
   */
  planFor: function OR_planFor(aTopics) {
    if (!Array.isArray(aTopics))
      aTopics = [aTopics];

    this._topics = this._topics.concat(aTopics);
  },

  /**
   * Stops the ObservationRecorder from noticing events previously
   * planned for.  Does not erase any recorded data for these
   * events.
   *
   * @param aTopics A string representing the topic that the ObservationRecorder
   *                is already observing.  You can also pass in an Array of
   *                strings.
   *
   * Example:  obs.stopNoticing("topic");
   *           obs.stopNoticing(["topic1", "topic2"]);
   */
  stopNoticing: function OR_stopNoticing(aTopics) {
    if (!Array.isArray(aTopics))
      aTopics = [aTopics];

    this._topics = this._topics.filter(
      function (topic) aTopics.indexOf(topic) == -1
    );
  },


  /**
   * Returns true of a particular topic was observed at least once.
   *
   * @param aTopic the topic to check if the ObservationRecorder saw.
   */
  didSee: function OR_didSee(aTopic) {
    return (aTopic in this.saw && this.saw[aTopic]);
  },

  /**
   * Returns the number of times a particular topic was observed.
   *
   * @param aTopic the topic to count the number of observations of.
   */
  numSightings: function OR_numSightings(aTopic) {
    if (!(aTopic in this.saw))
      return 0;

    return this.saw[aTopic];
  }
}
