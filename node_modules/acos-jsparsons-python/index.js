/* global module, require, __dirname */
/* jshint globalstrict: true */
'use strict';
var nj = require('nunjucks');
var fs = require('fs');

var JSPARSONSPython = function() {};  

var baseDir = __dirname;
var content = JSON.parse(fs.readFileSync(baseDir + '/content/python-basics.json', 'utf8'));

JSPARSONSPython.initialize = function(req, params, handlers, cb) {    
  var templateDir = baseDir + '/templates/';
  nj.configure(templateDir, { autoescape: false });

  var initial = content[params.name].initial.replace(/\n/g,'\\n');
  var instructions = content[params.name].instructions;

  var unitTestDiv;
  if(content[params.name].type === 'UNITTEST') {
    var unittests = content[params.name].unittest.replace(/\n/g,'\\n');
    unitTestDiv = '<div id="unittest"></div>';
    params.headContent += nj.render('head_unittest.html', {'initial': initial, 'unittests': unittests });
  } else if (content[params.name].type === 'VARTEST') {
    var vartests = content[params.name].vartests.replace(/\n/g, '\\n');
    unitTestDiv = '<div id="unittest"></div>';
    params.headContent += nj.render('head_vartest.html', {'initial': initial, 'vartests': vartests });
  } else {
    params.headContent += nj.render('head_simple.html', {'initial': initial });
  }

  params.bodyContent += nj.render('body.html', {'instructions': instructions, 'unittest': unitTestDiv});
  cb();
};

JSPARSONSPython.register = function(handlers,app, conf) {
  handlers.contentPackages['jsparsons-python'] = JSPARSONSPython;
  handlers.contentTypes.jsparsons.installedContentPackages.push(JSPARSONSPython);
};

var getContentFromFile = function(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));  
};

JSPARSONSPython.namespace = 'jsparsons-python';
JSPARSONSPython.contentTypeNamespace = 'jsparsons';
JSPARSONSPython.packageType = 'content';


JSPARSONSPython.meta = {
  'name': 'jsparsons-python',
  'shortDescription': 'Exercise package containing examples of Parson\'s problems in Python.',
  'description': '',
  'author': 'Lassi Haaranen',
  'license': 'MIT',
  'version': '0.1.0',
  'url': '',
  'teaserContent': ['ps_hello', 'ps_simple_function'],
  'contents': content
};

module.exports = JSPARSONSPython;