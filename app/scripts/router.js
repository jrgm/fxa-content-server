/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

define([
  'underscore',
  'jquery',
  'backbone',
  'lib/promise',
  'views/sign_in',
  'views/force_auth',
  'views/sign_up',
  'views/confirm',
  'views/legal',
  'views/tos',
  'views/pp',
  'views/cannot_create_account',
  'views/complete_sign_up',
  'views/reset_password',
  'views/confirm_reset_password',
  'views/complete_reset_password',
  'views/ready',
  'views/settings',
  'views/settings/avatar',
  'views/settings/avatar_change',
  'views/settings/avatar_crop',
  'views/settings/avatar_gravatar',
  'views/settings/avatar_camera',
  'views/change_password',
  'views/delete_account',
  'views/cookies_disabled',
  'views/clear_storage',
  'views/unexpected_error'
],
function (
  _,
  $,
  Backbone,
  p,
  SignInView,
  ForceAuthView,
  SignUpView,
  ConfirmView,
  LegalView,
  TosView,
  PpView,
  CannotCreateAccountView,
  CompleteSignUpView,
  ResetPasswordView,
  ConfirmResetPasswordView,
  CompleteResetPasswordView,
  ReadyView,
  SettingsView,
  AvatarView,
  AvatarChangeView,
  AvatarCropView,
  AvatarGravatarView,
  AvatarCameraView,
  ChangePasswordView,
  DeleteAccountView,
  CookiesDisabledView,
  ClearStorageView,
  UnexpectedErrorView
) {

  function showView(View, options) {
    return function () {
      // passed in options block can override
      // default options.
      var viewOptions = _.extend({
        metrics: this.metrics,
        window: this.window,
        router: this,
        language: this.language,
        relier: this.relier,
        broker: this.broker,
        fxaClient: this.fxaClient,
        user: this.user,
        interTabChannel: this.interTabChannel,
        canGoBack: this.canGoBack
      }, options || {});

      this.showView(new View(viewOptions));

      // back is enabled after the first view is rendered.
      this.canGoBack = true;
    };
  }

  var Router = Backbone.Router.extend({
    routes: {
      '(/)': 'redirectToSignupOrSettings',
      'signin(/)': showView(SignInView),
      'oauth/signin(/)': showView(SignInView),
      'oauth/signup(/)': showView(SignUpView),
      'signup(/)': showView(SignUpView),
      'signup_complete(/)': showView(ReadyView, { type: 'sign_up' }),
      'cannot_create_account(/)': showView(CannotCreateAccountView),
      'verify_email(/)': showView(CompleteSignUpView),
      'confirm(/)': showView(ConfirmView),
      'settings(/)': showView(SettingsView),
      'settings/avatar(/)': showView(AvatarView),
      'settings/avatar/change(/)': showView(AvatarChangeView),
      'settings/avatar/crop(/)': showView(AvatarCropView),
      'settings/avatar/gravatar(/)': showView(AvatarGravatarView),
      'settings/avatar/camera(/)': showView(AvatarCameraView),
      'change_password(/)': showView(ChangePasswordView),
      'delete_account(/)': showView(DeleteAccountView),
      'legal(/)': showView(LegalView),
      'legal/terms(/)': showView(TosView),
      'legal/privacy(/)': showView(PpView),
      'reset_password(/)': showView(ResetPasswordView),
      'confirm_reset_password(/)': showView(ConfirmResetPasswordView),
      'complete_reset_password(/)': showView(CompleteResetPasswordView),
      'reset_password_complete(/)': showView(ReadyView, { type: 'reset_password' }),
      'force_auth(/)': showView(ForceAuthView),
      'cookies_disabled(/)': showView(CookiesDisabledView),
      'clear(/)': showView(ClearStorageView),
      'unexpected_error(/)': showView(UnexpectedErrorView)
    },

    initialize: function (options) {
      options = options || {};

      this.window = options.window || window;

      this.metrics = options.metrics;
      this.language = options.language;
      this.relier = options.relier;
      this.broker = options.broker;
      this.fxaClient = options.fxaClient;
      this.user = options.user;
      this.interTabChannel = options.interTabChannel;

      // back is only enabled after the first view is rendered.
      this.canGoBack = false;

      this.$stage = $('#stage');

      this.watchAnchors();
    },

    navigate: function (url, options) {
      // Only add search parameters if they do not already exist.
      // Search parameters are added to the URLs because they are sometimes
      // used to pass state from the browser to the screens. Perhaps we should
      // take the search parameters on startup, toss them into Session, and
      // forget about this malarky?
      if (! /\?/.test(url)) {
        url = url + this.window.location.search;
      }

      options = options || { trigger: true };
      return Backbone.Router.prototype.navigate.call(this, url, options);
    },

    redirectToSignupOrSettings: function () {
      var url = this.user.getCurrentAccount().get('sessionToken') ?
                  '/settings' : '/signup';
      this.navigate(url, { trigger: true, replace: true });
    },

    showView: function (viewToShow) {
      if (this.currentView) {
        this.currentView.destroy();
      }

      this.currentView = viewToShow;

      // render will return false if the view could not be
      // rendered for any reason, including if the view was
      // automatically redirected.
      var self = this;
      return viewToShow.render()
        .then(function (isShown) {
          if (! isShown) {
            return;
          }

          // Render the new view and explicitly set the `display: block`
          // using .css. When embedded in about:accounts, the content
          // is not yet visible and show will not display the element.
          self.$stage.html(viewToShow.el).css('display', 'block');
          viewToShow.afterVisible();

          viewToShow.logScreen();

          // The user may be scrolled part way down the page
          // on screen transition. Force them to the top of the page.
          self.window.scrollTo(0, 0);

          self.$logo = $('#fox-logo');
          var name = self.currentView.el.className;

          if (name === 'sign-in' || name === 'sign-up') {
            self.$logo.addClass('fade-down-logo');
          }

          self.$logo.css('opacity', 1);
        })
        .fail(function (err) {
          // The router's navigate method doesn't set ephemeral messages,
          // so use the view's higher level navigate method.
          return viewToShow.navigate('unexpected_error', {
            error: err
          });
        });
    },

    watchAnchors: function () {
      var self = this;
      $(document).on('click', 'a[href^="/"]', function (event) {
        // someone killed this event, ignore it.
        if (event.isDefaultPrevented()) {
          return;
        }

        if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
          event.preventDefault();

          // Remove leading slashes
          var url = $(this).attr('href').replace(/^\//, '');

          // Instruct Backbone to trigger routing events
          self.navigate(url);
        }
      });
    }
  });

  return Router;
});
