/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([], function () {
  'use strict';

  var environments = {
    prod: {
      fmd: 'https://find.firefox.com',
      marketplace: 'https://marketplace.firefox.com',
      hello: 'https://hello.firefox.com',
      readinglist: 'https://readinglist.firefox.com'      
    },
    stage: {
      fmd: 'TBD',
      marketplace: 'http://mkt-stage.dev.lcip.org',
      hello: 'https://loop.stage.mozaws.net',
      readinglist: 'https://readinglist.stage.mozaws.net'      
    }
  };

  return environments;
});

