/* global ACOS, alert, $, parson */
/* exported initial, unittest, displayErrors, parsonsGrade */
/* jshint globalstrict: true */

"use strict";
var initial;
var unittest;

function displayErrors(feedback) { 
  if(feedback.length > 0) { 
    alert(feedback[0]); 
  } 
}

function parsonsGrade(feedback) {
  // For acos-jsparsons-gamey-pseudo contentPackage:
  if( $("#gamified-parsons").val() === "true" ) {
    parson.user_actions.push({gamified:true});
  }
    parson.user_actions.push( { problemName: $("#js-parsons-id").val() } );
  //feedback.length for line-based graders and feedback.success for unit test graders
  if(feedback.length === 0 || feedback.success === true) {
    ACOS.sendEvent('grade', {'points': 1, 'max_points': 1, 'status': 'graded', 'feedback': 'Problem solved successfully.'}); 
    ACOS.sendEvent('log', {log:parson.user_actions, problemName: $("#js-parsons-id").val()});
  } else {
    ACOS.sendEvent('grade', {'points': 0, 'max_points': 1, 'status': 'graded', 'feedback': feedback[0]});
    ACOS.sendEvent('log', {log:parson.user_actions, problemName: $("#js-parsons-id").val()});
  } 
}
