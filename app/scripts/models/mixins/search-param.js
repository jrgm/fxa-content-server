/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * A mixin that allows models to get/import search parameters
 */

'use strict';

define([
  'lib/url'
], function (Url) {
  return {
    /**
     * Get a value from the URL search parameter
     *
     * @param {String} paramName - name of the search parameter to get
     */
    getSearchParam: function (paramName) {
      return Url.searchParam(paramName, this.window.location.search);
    },

    /**
     * Set a value based on a value in window.location.search. Only updates
     * model if parameter exists in window.location.search.
     *
     * @param {String} paramName - name of the search parameter
     * @param {String} [modelName] - name to set in model. If not specified,
     *      use the same value as `paramName`
     */
    importSearchParam: function (paramName, modelName) {
      modelName = modelName || paramName;

      var value = this.getSearchParam(paramName);
      if (typeof value !== 'undefined') {
        this.set(modelName, value);
      }
    }
  };
});



