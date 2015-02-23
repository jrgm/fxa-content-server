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
  'tests/lib/helpers',
  'tests/functional/lib/helpers'
], function (intern, registerSuite, assert, require, nodeXMLHttpRequest, FxaClient, TestHelpers, FunctionalHelpers) {
  'use strict';

  var config = intern.config;
  var OAUTH_APP = config.fxaOauthApp;
  var AUTH_SERVER_ROOT = config.fxaAuthRoot;

  var PASSWORD = 'password';
  //var TOO_YOUNG_YEAR = new Date().getFullYear() - 13;
  //var OLD_ENOUGH_YEAR = TOO_YOUNG_YEAR - 1;

  var user, email, client;

  function openFxaFromRpPopUp(self, page/*, urlSuffix */) {
    var signin = '#site-header a.header-button.persona';

    return self.get('remote')
      .get(require.toUrl(OAUTH_APP))
      .setFindTimeout(intern.config.pageLoadTimeout)

      .findByCssSelector(signin)
        .click()
      .end()

      // switch to the popup window
      .switchToWindow('fxa')

      .findByCssSelector('#fxa-' + page + '-header')
      .end();
  }

  function fillOutSignInPopUp(self, email, password) {

    return self.get('remote')
      .getCurrentUrl()

      .findByCssSelector('form input.email')
        .click()
        .clearValue()
        .type(email)
      .end()

      .findByCssSelector('form input.password')
        .click()
        .clearValue()
        .type(password)
      .end()

      .findByCssSelector('button[type="submit"]')
        .click()
      .end();
  }

  function clearMarketplaceState(context) {
    console.log('clearMarketplaceState 1'); //XXX
    return context.get('remote')
      .then(function () {
        console.log('clearMarketplaceState 2', OAUTH_APP); //XXX
        //debugger
      })
      .get(require.toUrl(OAUTH_APP))
      .setFindTimeout(config.pageLoadTimeout)
      .then(function () {
        console.log('clearMarketplaceState 3'); //XXX
        //debugger
      })
      //.clearCookies()
      .then(function () {
        console.log('clearMarketplaceState 4'); //XXX
        //debugger
      })
      // XXX ask stomlinson why not .clearLocalStorage and .clearSessionStorage
      .execute(function () {
        try {
          /* global sessionStorage, localStorage */
          localStorage.clear();
          sessionStorage.clear();
        } catch(e) {
          console.log('Failed to clearBrowserState');
          // if cookies are disabled, this will blow up some browsers.
        }
        return true;
      }, []);
  }

  registerSuite({
    name: 'oauth sign in',

    beforeEach: function () {
      email = TestHelpers.createEmail(); 
      user = TestHelpers.emailToUser(email); 
      client = new FxaClient(AUTH_SERVER_ROOT, {
        xhr: nodeXMLHttpRequest.XMLHttpRequest
      }); 

      return FunctionalHelpers.clearBrowserState(this, {
        contentServer: true 
      }).then(function () {
        clearMarketplaceState(this);
      });
    },

    'verified': function () {
      var self = this;

      return openFxaFromRpPopUp(self, 'signin')
        .then(function () {
          return client.signUp(email, PASSWORD, { preVerified: true });
        })

        .then(function () {
          return fillOutSignInPopUp(self, email, PASSWORD);
        })

        // and back to marketplace
        .switchToWindow('')

        .then(FunctionalHelpers.waitForAttributeValue('#newsletter-footer input.email', 'value'))
        .then(function (text) {
          assert.equal(text, email);
        })

        .getCurrentUrl()
        .then(function (url) {
          // we've been redirected back to the App
          assert.ok(url.indexOf(OAUTH_APP) > -1);
        })
        .end();
    }

  });

});
