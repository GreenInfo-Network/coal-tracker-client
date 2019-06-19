/*
// jQuery Ajax File Uploader
//
// @author: Jordan Feldstein <jfeldstein.com>
//
//  - Ajaxifies an individual <input type="file">
//  - Files are sandboxed. Doesn't matter how many, or where they are, on the page.
//  - Allows for extra parameters to be included with the file
//  - onStart callback can cancel the upload by returning false
*/


(function($) {
    $.fn.ajaxfileupload = function(options) {
        var settings = {
          params: {},
          action: '',
          onStart: function() { },
          onComplete: function(response) { },
          onCancel: function() { },
          valid_extensions : ['gif','png','jpg','jpeg'],
          submit_button : null
        };

        var uploading_file = false;

        if ( options ) { 
          $.extend( settings, options );
        }


        // 'this' is a jQuery collection of one or more (hopefully) 
        //  file elements, but doesn't check for this yet
        return this.each(function() {
          var $element = $(this);

          // Skip elements that are already setup. May replace this 
          //  with uninit() later, to allow updating that settings
          if($element.data('ajaxUploader-setup') === true) return;

          $element.change(function()
          {
            // since a new image was selected, reset the marker
            uploading_file = false;

            // only update the file from here if we haven't assigned a submit button
            if (settings.submit_button == null)
            {
              upload_file();
            }
          });

          if (settings.submit_button == null)
          {
            // do nothing
          } else
          {
            settings.submit_button.click(function()
            {
              // only attempt to upload file if we're not uploading
              if (!uploading_file)
              {
                upload_file();
              }
            });
          }

          var upload_file = function()
          {
            if($element.val() == '') return settings.onCancel.apply($element, [settings.params]);
            // make sure extension is valid
            var ext = $element.val().split('.').pop().toLowerCase();
            if($.inArray(ext, settings.valid_extensions) == -1) {
                // Gregor 2013, hack here to maker it really alert the error; previous behavior was alert(Object) which was worthless
                return alert('The selected file type is invalid.\nFile must be one of the following:\n' + settings.valid_extensions.join(', '));
            } else
            { 
              uploading_file = true;

              // Creates the form, extra inputs and iframe used to 
              //  submit / upload the file
              wrapElement($element);

            // prevent the Upload button from flip-flopping as it's embedded into the virtual form
            $element.parent('form').css({ 'display':'inline'});

              // Call user-supplied (or default) onStart(), setting it's this context to the file DOM element
              // Greg A @ GreenInfo: if the return value is false, we cancel the submission
              // Otherwise, the return is the params object which will be turned into name:value parameters within the form
              // and submitted as if they were regular field data in this "virtual form"
              // NOTE: THIS IS INCOMPATIBLE with the params: config option, which is okay cuz it never worked anyway...
              var params = settings.onStart.apply($element, [settings.params]);
              if(params === false) return;
              if (params) {
                for (var key in params) {
                    var hidfield = $('<input></input>').prop('type','hidden').prop('name',key).val(params[key]).appendTo( $element.parent('form') );
                }
              }
              // go ahead and submit the form
              $element.parent('form').submit(function(e) { e.stopPropagation(); }).submit();
            }
          };

          // Mark this element as setup
          $element.data('ajaxUploader-setup', true);

          /*
          // Internal handler that tries to parse the response 
          //  and clean up after ourselves. 
          */
          var handleResponse = function(loadedFrame, element) {
            var response, responseStr = loadedFrame.contentWindow.document.body.innerHTML;
            try {
              //response = $.parseJSON($.trim(responseStr));
              response = JSON.parse(responseStr);
            } catch(e) {
              response = responseStr;
            }

            // Tear-down the wrapper form
            element.siblings().remove();
            element.unwrap();

            uploading_file = false;

            // Pass back to the user
            settings.onComplete.apply(element, [response, settings.params]);
          };

          /*
          // Wraps element in a <form> tag, and inserts hidden inputs for each
          //  key:value pair in settings.params so they can be sent along with
          //  the upload. Then, creates an iframe that the whole thing is 
          //  uploaded through. 
          */
          var wrapElement = function(element) {
            // Create an iframe to submit through, using a semi-unique ID
            var frame_id = 'ajaxUploader-iframe-' + Math.round(new Date().getTime() / 1000)
            $('body').after('<iframe width="0" height="0" style="display:none;" name="'+frame_id+'" id="'+frame_id+'"/>');
            $('#'+frame_id).load(function() {
              handleResponse(this, element);
            });

            // Wrap it in a form
            element.wrap(function() {
              return '<form action="' + settings.action + '" method="POST" enctype="multipart/form-data" target="'+frame_id+'" />'
            })
            // Insert <input type='hidden'>'s for each param
            .before(function() {
              var key, html = '';
              for(key in settings.params) {
                html += '<input type="hidden" name="' + key + '" value="' + settings.params[key] + '" />';
              }
              return html;
            });
          }



        });
      }
})( jQuery )
