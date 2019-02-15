(function($) {
  'use strict';

  var ACOS = function() {};

  ACOS.sendEvent = function(event, payload, cb) {

    var protocolData = {
      'user_id': $('input[name="user_id"]').attr('value'),
      'lis_outcome_service_url': $('input[name="lis_outcome_service_url"]').attr('value'),
      'lis_result_sourcedid': $('input[name="lis_result_sourcedid"]').attr('value')
    };

    var target = window.location.pathname;
    if (target[target.length - 1] == '/') {
      target = target.substring(0, target.length - 1);
    }

    var data = {
      "event": event,
      "payload": JSON.stringify(payload),
      "protocolData": JSON.stringify(protocolData)
    };

    if (event === 'log' && window.AcosLogging && AcosLogging.logkey && AcosLogging.loggingSession) {
      data.logkey = AcosLogging.logkey;
      data.loggingSession = AcosLogging.loggingSession;
    }

    if (event === 'log' && window.AcosLogging && AcosLogging.noLogging) {
      return;
    } else {
      $.post(target + "/event", data).done(function(response) {
        if (cb) {
          cb(response.content);
        }
      });
    }

  };

  // Make the namespace globally available
  window.ACOS = ACOS;

}(jQuery));
