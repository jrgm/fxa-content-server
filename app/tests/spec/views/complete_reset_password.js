/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';


define([
  'chai',
  'sinon',
  'lib/promise',
  'lib/auth-errors',
  'lib/metrics',
  'lib/fxa-client',
  'views/complete_reset_password',
  'models/reliers/relier',
  'models/auth_brokers/base',
  '../../mocks/router',
  '../../mocks/window',
  '../../lib/helpers'
],
function (chai, sinon, p, AuthErrors, Metrics, FxaClient, View, Relier,
      Broker, RouterMock, WindowMock, TestHelpers) {
  var assert = chai.assert;
  var wrapAssertion = TestHelpers.wrapAssertion;

  describe('views/complete_reset_password', function () {
    var view;
    var routerMock;
    var windowMock;
    var isPasswordResetComplete;
    var metrics;
    var fxaClient;
    var relier;
    var broker;

    var EMAIL = 'testuser@testuser.com';
    var PASSWORD = 'password';
    var TOKEN = 'feed';
    var CODE = 'dea0fae1abc2fab3bed4dec5eec6ace7';

    function testEventLogged(eventName) {
      assert.isTrue(TestHelpers.isEventLogged(metrics, eventName));
    }

    function testEventNotLogged(eventName) {
      assert.isFalse(TestHelpers.isEventLogged(metrics, eventName));
    }

    beforeEach(function () {
      routerMock = new RouterMock();
      windowMock = new WindowMock();
      windowMock.location.pathname = 'complete_reset_password';
      metrics = new Metrics();
      relier = new Relier();
      broker = new Broker();
      fxaClient = new FxaClient();

      windowMock.location.search = '?code=dea0fae1abc2fab3bed4dec5eec6ace7&email=testuser@testuser.com&token=feed';

      view = new View({
        router: routerMock,
        window: windowMock,
        metrics: metrics,
        fxaClient: fxaClient,
        relier: relier,
        broker: broker
      });

      // mock in isPasswordResetComplete
      isPasswordResetComplete = false;
      view.fxaClient.isPasswordResetComplete = function () {
        return p(isPasswordResetComplete);
      };

      return view.render()
          .then(function () {
            $('#container').html(view.el);
          });
    });

    afterEach(function () {
      metrics.destroy();

      view.remove();
      view.destroy();

      view = windowMock = metrics = null;
    });

    describe('render', function () {
      it('shows form if token, code and email are all present', function () {
        return view.render()
            .then(function () {
              testEventNotLogged('complete_reset_password.link_expired');
              assert.ok(view.$('#fxa-complete-reset-password-header').length);
            });
      });

      it('shows malformed screen if the token is missing', function () {
        windowMock.location.search = TestHelpers.toSearchString({
          code: 'faea',
          email: 'testuser@testuser.com'
        });

        return view.render()
            .then(function () {
              testEventLogged('complete_reset_password.link_damaged');
            })
            .then(function () {
              assert.ok(view.$('#fxa-reset-link-damaged-header').length);
            });
      });

      it('shows malformed screen if the token is invalid', function () {
        windowMock.location.search = TestHelpers.toSearchString({
          token: 'invalid_token', // not a hex string
          code: 'dea0fae1abc2fab3bed4dec5eec6ace7',
          email: 'testuser@testuser.com'
        });

        return view.render()
            .then(function () {
              testEventLogged('complete_reset_password.link_damaged');
            })
            .then(function () {
              assert.ok(view.$('#fxa-reset-link-damaged-header').length);
            });
      });

      it('shows malformed screen if the code is missing', function () {
        windowMock.location.search = TestHelpers.toSearchString({
          token: 'feed',
          email: 'testuser@testuser.com'
        });

        return view.render()
            .then(function () {
              testEventLogged('complete_reset_password.link_damaged');
            })
            .then(function () {
              assert.ok(view.$('#fxa-reset-link-damaged-header').length);
            });
      });

      it('shows malformed screen if the code is invalid', function () {
        windowMock.location.search = TestHelpers.toSearchString({
          token: 'feed',
          code: 'invalid_code', // not a hex string
          email: 'testuser@testuser.com'
        });

        return view.render()
            .then(function () {
              testEventLogged('complete_reset_password.link_damaged');
            })
            .then(function () {
              assert.ok(view.$('#fxa-reset-link-damaged-header').length);
            });
      });

      it('shows malformed screen if the email is missing', function () {
        windowMock.location.search = '?token=feed&code=dea0fae1abc2fab3bed4dec5eec6ace7';
        return view.render()
            .then(function () {
              testEventLogged('complete_reset_password.link_damaged');
            })
            .then(function () {
              assert.ok(view.$('#fxa-reset-link-damaged-header').length);
            });
      });

      it('shows malformed screen if the email is invalid', function () {
        windowMock.location.search = TestHelpers.toSearchString({
          token: 'feed',
          code: 'dea0fae1abc2fab3bed4dec5eec6ace7',
          email: 'does_not_validate'
        });

        return view.render()
            .then(function () {
              testEventLogged('complete_reset_password.link_damaged');
            })
            .then(function () {
              assert.ok(view.$('#fxa-reset-link-damaged-header').length);
            });
      });

      it('shows the expired screen if the token has already been used', function () {
        isPasswordResetComplete = true;
        return view.render()
            .then(function () {
              testEventLogged('complete_reset_password.link_expired');
            })
            .then(function () {
              assert.ok(view.$('#fxa-reset-link-expired-header').length);
            });
      });
    });

    describe('updatePasswordVisibility', function () {
      it('pw field set to text when clicked', function () {
        $('.show-password').click();
        assert.equal($('#password').attr('type'), 'text');
        assert.equal($('#vpassword').attr('type'), 'text');
      });

      it('pw field set to password when clicked again', function () {
        $('.show-password').click();
        $('.show-password').click();
        assert.equal($('#password').attr('type'), PASSWORD);
        assert.equal($('#vpassword').attr('type'), PASSWORD);
      });
    });

    describe('isValid', function () {
      it('returns true if password & vpassword valid and the same', function () {
        view.$('#password').val(PASSWORD);
        view.$('#vpassword').val(PASSWORD);
        assert.isTrue(view.isValid());
      });

      it('returns false if password & vpassword are different', function () {
        view.$('#password').val('password');
        view.$('#vpassword').val('other_password');
        assert.isFalse(view.isValid());
      });

      it('returns false if password invalid', function () {
        view.$('#password').val('passwor');
        view.$('#vpassword').val('password');
        assert.isFalse(view.isValid());
      });

      it('returns false if vpassword invalid', function () {
        view.$('#password').val('password');
        view.$('#vpassword').val('passwor');
        assert.isFalse(view.isValid());
      });
    });

    describe('showValidationErrors', function () {
      it('shows an error if the password is invalid', function (done) {
        view.$('#password').val('passwor');
        view.$('#vpassword').val('password');

        view.on('validation_error', function (which, msg) {
          wrapAssertion(function () {
            assert.ok(msg);
          }, done);
        });

        view.showValidationErrors();
      });

      it('shows an error if the vpassword is invalid', function (done) {
        view.$('#password').val('password');
        view.$('#vpassword').val('passwor');

        view.on('validation_error', function (which, msg) {
          wrapAssertion(function () {
            assert.ok(msg);
          }, done);
        });

        view.showValidationErrors();
      });
    });

    describe('validateAndSubmit', function () {
      it('shows an error if passwords are different', function () {
        view.$('#password').val('password1');
        view.$('#vpassword').val('password2');

        return view.validateAndSubmit()
            .then(function () {
              assert(false, 'unexpected success');
            }, function () {
              assert.ok(view.$('.error').text().length);
            });
      });

      it('signs the user in and redirects to `/reset_password_complete` if broker does not say halt', function () {
        view.$('[type=password]').val(PASSWORD);

        sinon.stub(fxaClient, 'signIn', function () {
          return p(true);
        });
        sinon.stub(fxaClient, 'completePasswordReset', function () {
          return p(true);
        });
        sinon.spy(broker, 'afterCompleteResetPassword');

        return view.validateAndSubmit()
            .then(function () {
              assert.isTrue(fxaClient.completePasswordReset.calledWith(
                  EMAIL, PASSWORD, TOKEN, CODE));
              assert.isTrue(fxaClient.signIn.calledWith(
                  EMAIL, PASSWORD, relier));
              assert.equal(routerMock.page, 'reset_password_complete');
              assert.isTrue(broker.afterCompleteResetPassword.called);
              assert.isTrue(TestHelpers.isEventLogged(
                      metrics, 'complete_reset_password.verification.success'));
            });
      });

      it('halts if the broker says halt', function () {
        view.$('[type=password]').val(PASSWORD);

        sinon.stub(fxaClient, 'signIn', function () {
          return p(true);
        });
        sinon.stub(fxaClient, 'completePasswordReset', function () {
          return p(true);
        });
        sinon.stub(broker, 'afterCompleteResetPassword', function () {
          return p({ halt: true });
        });

        return view.validateAndSubmit()
            .then(function () {
              assert.isTrue(fxaClient.completePasswordReset.calledWith(
                  EMAIL, PASSWORD, TOKEN, CODE));
              assert.isTrue(fxaClient.signIn.calledWith(
                  EMAIL, PASSWORD, relier));
              assert.notEqual(routerMock.page, 'reset_password_complete');
              assert.isTrue(broker.afterCompleteResetPassword.called);
            });
      });

      it('reload view to allow user to resend an email on INVALID_TOKEN error', function () {
        view.$('[type=password]').val('password');

        sinon.stub(view.fxaClient, 'completePasswordReset', function () {
          return p.reject(AuthErrors.toError('INVALID_TOKEN'));
        });

        // isPasswordResetComplete needs to be overridden as well for when
        // render is re-loaded the token needs to be expired.
        sinon.stub(view.fxaClient, 'isPasswordResetComplete', function () {
          return p(true);
        });

        return view.validateAndSubmit()
            .then(function () {
              assert.ok(view.$('#fxa-reset-link-expired-header').length);
            });
      });

      it('shows error message if server returns an error', function () {
        view.$('[type=password]').val('password');

        sinon.stub(view.fxaClient, 'completePasswordReset', function () {
          return p.reject(new Error('uh oh'));
        });

        return view.validateAndSubmit()
            .then(assert.fail, function () {
              assert.ok(view.$('.error').text().length);
            });
      });
    });

    describe('resendResetEmail', function () {
      it('redirects to /confirm_reset_password if auth server is happy', function () {
        sinon.stub(view.fxaClient, 'passwordReset', function () {
          return p(true);
        });

        return view.resendResetEmail()
            .then(function () {
              assert.equal(routerMock.page, 'confirm_reset_password');
              assert.isTrue(view.fxaClient.passwordReset.calledWith(
                  EMAIL, relier));
            });
      });

      it('shows server response as an error otherwise', function () {
        sinon.stub(view.fxaClient, 'passwordReset', function () {
          return p.reject(new Error('server error'));
        });

        return view.resendResetEmail()
            .then(function () {
              assert.equal(view.$('.error').text(), 'server error');
            });
      });
    });
  });
});
