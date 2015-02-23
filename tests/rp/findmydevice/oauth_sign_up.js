/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

define([
  'intern',
  'intern!object',
  'intern/chai!assert',
  'require',
  'intern/node_modules/dojo/node!xmlhttprequest',
  'app/bower_components/fxa-js-client/fxa-client',
  'tests/lib/restmail',
  'tests/lib/helpers',
  'tests/functional/lib/helpers',
  'tests/rp/environments'
], function (intern, registerSuite, assert, require, nodeXMLHttpRequest, FxaClient,
             restmail, TestHelpers, FunctionalHelpers, environments) {
  'use strict';

  var config = intern.config;
  var AUTH_SERVER_ROOT = config.fxaAuthRoot;
  // var SIGNIN_ROOT = config.fxaContentRoot + 'oauth/signin';

  var OAUTH_APP = environments.prod.fmd;

  var PASSWORD = 'password';
  var TOO_YOUNG_YEAR = new Date().getFullYear() - 13;
  var OLD_ENOUGH_YEAR = TOO_YOUNG_YEAR - 1;
  var user;
  var email;

  var client;

  registerSuite({
    name: 'oauth sign up',

    beforeEach: function () {
      email = TestHelpers.createEmail();
      user = TestHelpers.emailToUser(email);
      client = new FxaClient(AUTH_SERVER_ROOT, {
        xhr: nodeXMLHttpRequest.XMLHttpRequest
      });

      return FunctionalHelpers.clearBrowserState(this, {
        contentServer: true,
        'FMD': true // XXX implement clearing RP browser state
      });
    },

    'signup, verify same browser': function () {
      var self = this;

      // The background image is over 1MB, which is very slow to load on
      // slower networks. So set a long timeout to compensate.
      // https://github.com/mozilla-services/FindMyDevice/issues/326
      this.timeout = 90000;


      return this.get('remote')
        .get(require.toUrl(OAUTH_APP))
        .setFindTimeout(intern.config.pageLoadTimeout)

        .findByCssSelector('#cta .sign-up')
        .click()
        .end()

        // FMD is odd. Both "signin" and "signup" point to '/signin', with
        // '/?action=signup' appended to '/signin' for the latter case.
        // This winds up, for the signup case, after the redirect bounce,
        // winding up at 'accounts.f.c/oauth/signin?args'. So bug to be
        // filed, but hack around it for now.

        .findByCssSelector('#fxa-signin-header')
        .end()

        // Now go to signup for reals
        .findByCssSelector('a.sign-up')
        .click()
        .end()

        .getCurrentUrl()
        .then(function (url) {
          assert.ok(url.indexOf('client_id=') > -1);
          assert.ok(url.indexOf('scope=') > -1);
          assert.ok(url.indexOf('state=') > -1);
        })
        .end()

        .then(function () {
          return FunctionalHelpers.fillOutSignUp(self, email, PASSWORD, OLD_ENOUGH_YEAR);
        })

        .findByCssSelector('#fxa-confirm-header')
        .end()

        .then(function () {
          return FunctionalHelpers.openVerificationLinkSameBrowser(self, email, 0);
        })

        .switchToWindow('newwindow')

        // wait for the verified window in the new tab
        .findById('fxa-sign-up-complete-header')
        .end()

        .getCurrentUrl()
        .then(function (url) {
          assert.ok(url.indexOf('signup_complete') > -1);
          assert.ok(url.indexOf('uid=') > -1);
          assert.ok(url.indexOf('code=') > -1);
          assert.ok(url.indexOf('service=') > -1);
        })
        .end()

        .findByCssSelector('.account-ready-service')
        .getVisibleText()
        .then(function (text) {
          // user sees the name of the RP, but cannot redirect
          assert.ok(/find my device/i.test(text));
        })
        .end()

        // switch to the original window
        .closeCurrentWindow()
        .switchToWindow('')

        .findByCssSelector('a.signout')
        .end()

        .findByCssSelector('div.hero h1')
        .getVisibleText()
        .then(function (text) {
          // Since this is a new account, of course they have no devices.
          assert.ok(/you don't have any devices/i.test(text));
        })
        .end();
    }
  });

});
