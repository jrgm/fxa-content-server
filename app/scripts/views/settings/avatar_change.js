/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

define([
  'jquery',
  'underscore',
  'views/form',
  'views/mixins/avatar-mixin',
  'stache!templates/settings/avatar_change',
  'lib/auth-errors',
  'lib/image-loader',
  'models/cropper-image'
],
function ($, _, FormView, AvatarMixin, Template, AuthErrors,
    ImageLoader, CropperImage) {

  var View = FormView.extend({
    // user must be authenticated to see Settings
    mustVerify: true,

    template: Template,
    className: 'avatar-change',

    events: {
      'click #file': 'filePicker',
      'click .remove': 'remove',
      'change #imageLoader': 'fileSet'
    },

    initialize: function () {
      // override in tests
      this.FileReader = FileReader;
    },

    context: function () {
      return {
        avatar: this.avatar
      };
    },

    beforeRender: function () {
      var self = this;

      return self._fetchProfileImage(self.currentAccount())
        .then(function (result) {
          self.avatarId = result.id;
          self.avatar = result.avatar;
        }, function () {
          // ignore errors
        });
    },

    afterRender: function () {
      // Wrapper hides the browser's file picker widget so we can use
      // our own
      var wrapper = $('<div/>').css({ height: 0, width: 0, 'overflow': 'hidden' });
      this.$(':file').wrap(wrapper);
    },

    remove: function () {
      var self = this;
      return self.currentAccount().deleteAvatar(self.avatarId)
        .then(function () {
          self.navigate('settings/avatar');
        });
    },

    filePicker: function () {
      var self = this;
      // skip the file picker if this is an automater browser
      if (self.automatedBrowser) {
        setTimeout(function () {
          require(['draggable', 'touch-punch'], function () {
            var cropImg = new CropperImage();
            self.navigate('settings/avatar/crop', {
              data: {
                cropImg: cropImg
              }
            });
          });
        }, 1000);
        
        return;
      }
      self.$('#imageLoader').click();
    },

    fileSet: function (e) {
      var self = this;
      var file = e.target.files[0];

      var imgOnerrer = function () {
        self.navigate('settings/avatar', {
          error: AuthErrors.toMessage('UNUSABLE_IMAGE')
        });
      };

      if (file.type.match('image.*')) {
        var reader = new self.FileReader();

        reader.onload = function (event) {
          var src = event.target.result;

          ImageLoader.load(src)
            .then(function (img) {
              var cropImg = new CropperImage({
                src: src,
                type: file.type,
                width: img.width,
                height: img.height
              });
              require(['draggable', 'touch-punch'], function () {
                self.navigate('settings/avatar/crop', {
                  data: {
                    cropImg: cropImg
                  }
                });
              });
            })
            .fail(imgOnerrer);
        };
        reader.readAsDataURL(file);
      } else {
        self.navigate('settings/avatar', {
          error: AuthErrors.toMessage('UNUSABLE_IMAGE')
        });
      }
    }
  });

  _.extend(View.prototype, AvatarMixin);

  return View;
});
