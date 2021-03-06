/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * A metrics module!
 *
 * An instantiated metrics object has two primary APIs:
 *
 * metrics.logEvent(<event_name>);
 * metrics.startTimer(<timer_name>)/metrics.stopTimer(<timer_name);
 *
 * Metrics are automatically sent to the server on window.unload
 * but can also be sent by calling metrics.flush();
 */

define([
  'underscore',
  'backbone',
  'jquery',
  'speedTrap',
  'lib/xhr',
  'lib/promise',
  'lib/url',
  'lib/strings'
], function (_, Backbone, $, speedTrap, xhr, p, Url, Strings) {
  'use strict';

  // Speed trap is a singleton, convert it
  // to an instantiable function.
  var SpeedTrap = function () {};
  SpeedTrap.prototype = speedTrap;

  var ALLOWED_FIELDS = [
    'campaign',
    'context',
    'duration',
    'entrypoint',
    'events',
    'migration',
    'lang',
    'marketingClicked',
    'marketingLink',
    'marketingType',
    'navigationTiming',
    'referrer',
    'screen',
    'service',
    'timers'
  ];

  var TEN_MINS_MS = 10 * 60 * 1000;

  function Metrics (options) {
    options = options || {};

    // by default, send the metrics to the content server.
    this._collector = options.collector || '';

    this._ajax = options.ajax || xhr.ajax;

    this._speedTrap = new SpeedTrap();
    this._speedTrap.init();

    // `timers` and `events` are part of the public API
    this.timers = this._speedTrap.timers;
    this.events = this._speedTrap.events;

    this._window = options.window || window;

    this._lang = options.lang || 'unknown';
    this._context = options.context || 'web';
    this._entrypoint = options.entrypoint || 'none';
    this._migration = options.migration || 'none';
    this._service = options.service || 'none';
    this._campaign = options.campaign || 'none';

    this._inactivityFlushMs = options.inactivityFlushMs || TEN_MINS_MS;
  }

  _.extend(Metrics.prototype, Backbone.Events, {
    ALLOWED_FIELDS: ALLOWED_FIELDS,

    init: function () {
      this._flush = _.bind(this.flush, this);
      $(this._window).on('unload', this._flush);

      // Set the initial inactivity timeout to clear navigation timing data.
      this._resetInactivityFlushTimeout();
    },

    destroy: function () {
      $(this._window).off('unload', this._flush);
      this._clearInactivityFlushTimeout();
    },

    /**
     * Send the collected data to the backend.
     */
    flush: function () {
      // Inactivity timer is restarted when the next event/timer comes in.
      // This avoids sending empty result sets if the tab is
      // just sitting there open with no activity.
      this._clearInactivityFlushTimeout();

      var filteredData = this.getFilteredData();
      this._speedTrap.events.clear();
      this._speedTrap.timers.clear();

      var url = this._collector + '/metrics';

      // use a synchronous request to block the page from unloading
      // until the request is complete.
      return this._send(filteredData, url, false);
    },

    _clearInactivityFlushTimeout: function () {
      clearTimeout(this._inactivityFlushTimeout);
    },

    _resetInactivityFlushTimeout: function () {
      this._clearInactivityFlushTimeout();

      var self = this;
      this._inactivityFlushTimeout =
          setTimeout(function () {
            self.logEvent('inactivity.flush');
            self.flush();
          }, this._inactivityFlushMs);
    },


    /**
     * Get all the data, whether it's allowed to be sent or not.
     */
    getAllData: function () {
      var loadData = this._speedTrap.getLoad();
      var unloadData = this._speedTrap.getUnload();

      var allData = _.extend({
        context: this._context,
        service: this._service,
        lang: this._lang,
        entrypoint: this._entrypoint,
        migration: this._migration,
        marketingType: this._marketingType || 'none',
        marketingLink: this._marketingLink || 'none',
        marketingClicked: this._marketingClicked || false,
        campaign: this._campaign
      }, loadData, unloadData);

      return allData;
    },

    /**
     * Get the filtered data.
     * Filtered data is data that is allowed to be sent,
     * that is defined and not an empty string.
     */
    getFilteredData: function () {
      var allData = this.getAllData();

      var filteredData = {};
      _.forEach(ALLOWED_FIELDS, function (itemName) {
        if (typeof allData[itemName] !== 'undefined' &&
            allData[itemName] !== '') {
          filteredData[itemName] = allData[itemName];
        }
      });

      return filteredData;
    },

    _send: function (data, url, async) {
      var self = this;
      return this._ajax({
        async: async !== false,
        type: 'POST',
        url: url,
        contentType: 'application/json',
        data: JSON.stringify(data)
      })
      .then(function () {
        self.trigger('flush.success', data);
        return data;
      }, function (jqXHR) {
        self.trigger('flush.error');
        throw jqXHR.statusText;
      });
    },

    /**
     * Log an event
     */
    logEvent: function (eventName) {
      this._resetInactivityFlushTimeout();
      this.events.capture(eventName);
    },

    /**
     * Start a timer
     */
    startTimer: function (timerName) {
      this._resetInactivityFlushTimeout();
      this.timers.start(timerName);
    },

    /**
     * Stop a timer
     */
    stopTimer: function (timerName) {
      this._resetInactivityFlushTimeout();
      this.timers.stop(timerName);
    },

    /**
     * Log an error.
     */
    logError: function (error) {
      this.logEvent(this.errorToId(error));
    },

    /**
     * Convert an error to an identifier that can be used for logging.
     */
    errorToId: function (error) {
      var id = Strings.interpolate('error.%s.%s.%s', [
        error.context || 'unknown context',
        error.namespace || 'unknown namespace',
        error.errno || String(error)
      ]);
      return id;
    },

    /**
     * Log a screen
     */
    logScreen: function (screenName) {
      this.logEvent(this.screenToId(screenName));
    },

    /**
     * Convert a screenName an identifier
     */
    screenToId: function (screenName) {
      return 'screen.' + screenName;
    },

    /**
     * Log which marketing snippet is shown to the user
     */
    logMarketingImpression: function (type, link) {
      this._marketingType = type;
      this._marketingLink = link;
    },

    /**
     * Log whether the user clicked on the marketing link
     */
    logMarketingClick: function () {
      this._marketingClicked = true;
    }
  });

  return Metrics;
});


