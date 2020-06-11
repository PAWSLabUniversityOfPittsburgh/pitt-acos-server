/*******************************************
 * Acos - Advanced Content Server
 * Server for hosting smart learning content
 *
 * Licensed under MIT license.
 */

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var fs = require('fs');
var colors = require('colors');
var nunjucks = require('nunjucks');
var archiver = require('archiver');
var crypto = require('crypto');
var _ = require('lodash');
var cors = require('cors')

var app = express();

if (app.get('env') !== 'development') {
  // In production use, Nginx or similar should be used as a proxy
  app.enable('trust proxy');
}

// Views
nunjucks.configure(path.join(__dirname, 'views'), {
  autoescape: true,
  express: app
});

// Enable if needed:
//app.use(favicon(__dirname + '/public/favicon.ico'));

if (process.env.NODE_ENV !== 'test') {
  app.use(logger('dev'));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(compression());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors())

// ********************************************************************************
// ACOS code begins


// ********************************************************************************
// Initialization

var config = require('./config');

console.log('[ACOS Server]' + ' INFO: '.green + 'Starting ACOS at ' + new Date() + '\n');

// Make sure that the directory for log files exist
config.logDirectory = config.logDirectory || 'logs';
if (config.logDirectory[0] != '/') {
  config.logDirectory = __dirname + '/' + config.logDirectory;
}
fs.mkdir(config.logDirectory, 0775, function(err) {});

config.publicLogDirectory = config.publicLogDirectory || 'public_logs';
if (config.publicLogDirectory[0] != '/') {
  config.publicLogDirectory = __dirname + '/' + config.publicLogDirectory;
}
fs.mkdir(config.publicLogDirectory, 0775, function(err) {});

// Register all installed packages
var handlers = { 'protocols': {}, 'contentTypes': {}, 'contentPackages': {}, 'tools': {}, 'loggers': {}, 'libraries': {} };

var initPackage = function(name, package) {
  try {

    if (package.packageType === 'content' && !handlers.contentTypes[package.contentTypeNamespace]) {
      console.log('[ACOS Server]' + ' ERROR:'.red +
        ' Package '.red + name.yellow + ' could not be loaded.\n The required content type with'.red +
        ' namespace '.red + package.contentTypeNamespace.yellow + ' is missing.\n'.red);
    }

    if (package.register) {
      package.register(handlers, app, config);
      // Serve static content that is inside the installed package
      app.use('/static/' + package.namespace, express.static(__dirname + '/node_modules/' + name + '/static'));
      console.log('[ACOS Server] ' + 'INFO:'.green +
        ' Package ' + name.yellow + ' is installed.');
    } else {
      console.log('[ACOS Server]' + ' ERROR:'.red +
        ' Package '.red + name.yellow + ' could not be loaded.\n The required function '.red +
        'register'.yellow + ' is missing.\n'.red);
    }
  } catch (e) { //Loading failed, perhaps a configuration error
    console.log('[ACOS Server]' + ' ERROR:'.red +
      ' Package '.red + name.yellow + ' could not be loaded.\n An error occurred during the initialization.\n'.red);
  }
};

// Install packages defined in the config file or use auto-discovery
if (!config.autoDiscovery) {
  console.log('[ACOS Server] ' + 'INFO:'.green + ' Reading installed packages from config.js'.magenta);
  for (var i = 0; i < config.installedPackages.length; i++) {
    var package = require(config.installedPackages[i]);
    initPackage(config.installedPackages[i], package);
  }
} else {
  console.log('[ACOS Server] ' + 'INFO:'.green + ' Loading installed packages by using auto-discovery.'.magenta);

  // Packages should start with 'acos-' to be auto-discovered
  var directories = _.filter(fs.readdirSync(__dirname + '/node_modules'), function(d) {
    return /^acos-/.test(d) && fs.statSync(__dirname + '/node_modules/' + d).isDirectory();
  });

  var packages = [];
  directories.forEach(function(directory) {
    var package = require(directory);
    if (package.packageType) {
      packages.push({ name: directory, package: package });
    }
  });

  // Packages should be installed in a specific order because of the dependencies
  packages = _.groupBy(packages, 'package.packageType');
  var packageTypesInitOrder = ['protocol', 'content-type', 'content', 'library', 'tool', 'other'];
  packageTypesInitOrder.forEach(function(typeName) {
    if (packages[typeName]) {
      console.log('\n[ACOS Server] ' + 'INFO:'.green + ' Auto-discovering packages with type:'.cyan + ' ' + typeName.magenta);
      packages[typeName].forEach(function(package) {
        initPackage(package.name, package.package);
      });
    }
  });

}

// Propagate keywords to upper levels
var keywords = null;
Object.keys(handlers.contentTypes).forEach(function(contentType) {

  handlers.contentTypes[contentType].meta.keywords = handlers.contentTypes[contentType].meta.keywords || [];

  (handlers.contentTypes[contentType].installedContentPackages || []).forEach(function(contentPackage) {

    contentPackage.meta.keywords = contentPackage.meta.keywords || [];

    Object.keys(contentPackage.meta.contents || []).forEach(function(content) {
      keywords = contentPackage.meta.contents[content].keywords;
      if (keywords) {
        contentPackage.meta.keywords.push.apply(contentPackage.meta.keywords, keywords);
      }
    });

    contentPackage.meta.keywords = _.uniq(contentPackage.meta.keywords);
    handlers.contentTypes[contentType].meta.keywords.push.apply(handlers.contentTypes[contentType].meta.keywords, contentPackage.meta.keywords);

  });

  handlers.contentTypes[contentType].meta.keywords = _.uniq(handlers.contentTypes[contentType].meta.keywords);

});

// ********************************************************************************
// Prioritize API URLs
var api = express.Router();
var pitt_router = express.Router();
app.use('/api/v1', api);
app.use(pitt_router)
// ********************************************************************************

// ********************************************************************************
// Serving content

//This is added to serve requests like: /html/jsparsons/jsparsons-python?resource_name=ps_hello
var resource_name_urlPrefix = '/:protocol([a-zA-Z0-9_-]+)/:contentType([a-zA-Z0-9_-]+)/:contentPackage([a-zA-Z0-9_-]+)';
pitt_router.get(resource_name_urlPrefix, function(req, res) {
	serve_content(req,res,req.query.resource_name)
});

//This is added to serve requests like: /html/jsparsons/jsparsons-python?resource_name=ps_hello over post requiest (mostly for LTI protocol)
pitt_router.post(resource_name_urlPrefix, function(req, res) {
	serve_content(req,res,req.query.resource_name)
});

// ********************************************************************************
// Event handling
pitt_router.post(resource_name_urlPrefix + '/event', handle_event);

//I think this route should be removed as there is no way to specify content name in Canvas without changing the base url
// OpenDSA integration done using resource_link_title which turns out that it is a custom way. Should get the name through URL parameter
// URLs are, for example, /html/jsparsons/jsparsons-python/ where no resource name provided through url parameter (mostly for lti protocol)
var postUrlPrefix = '/:protocol([a-zA-Z0-9_-]+)/:contentType([a-zA-Z0-9_-]+)/:contentPackage([a-zA-Z0-9_-]+)';
pitt_router.post(postUrlPrefix, function(req, res) {
	serve_content(req,res,req.body.resource_link_title)
});

pitt_router.post(postUrlPrefix + '/event', handle_event);

// URLs are, for example, /html/jsparsons/jsparsons-python/ps_hello
var getUrlPrefix = '/:protocol([a-zA-Z0-9_-]+)/:contentType([a-zA-Z0-9_-]+)/:contentPackage([a-zA-Z0-9_-]+)/:name([a-zA-Z0-9_-]+)';
pitt_router.get(getUrlPrefix, function(req, res) {
	serve_content(req,res,req.params.name)
});

pitt_router.post(getUrlPrefix + '/event', handle_event);

//TODO: Need to allow protocol packages or other packages to extend global router with their own functions. 
pitt_router.post('/lti/submit_content_item_form', function(req, res) {
  //submit_content_item_form(req, res)

  var content_item_return_url = req.body.content_item_return_url
  var selected_content_name = req.body.selected_content
  var consumer_key = req.body.oauth_consumer_key

  var launch_url = req.body.content_url_base + '?resource_name=' + selected_content_name

  var contentItems = {
    '@context' : 'http://purl.imsglobal.org/ctx/lti/v1/ContentItem',
    '@graph': [
        {
            '@type' : 'LtiLinkItem',
            '@id': selected_content_name,
            mediaType: 'application/vnd.ims.lti.v1.ltilink',
            title: 'ACOS ' + selected_content_name,
            text: 'ACOS ' + selected_content_name + ' content',
            url: launch_url,
            placementAdvice : {
                displayWidth : '800',
                displayHeight : '600',
                presentationDocumentTarget : 'iframe'
            }
        }
    ]
  };

  var nonce = crypto.randomBytes(16).toString('base64');
  var responseObject = {
    lti_message_type: 'ContentItemSelection',
    lti_version: 'LTI-1p0',
    content_items: JSON.stringify(contentItems),
    oauth_version: '1.0',
    oauth_nonce: nonce,
    oauth_timestamp: getUnixTimestamp(),
    oauth_consumer_key: consumer_key,
    oauth_callback: 'about:blank',
    oauth_signature_method: 'HMAC-SHA1'
  };

  //TODO: Need to retrieve it from a storage
  var consumer_secret = '$2a$10$DU9AhVQc5KuSQbMPT7o5Q.FyIl0WfcMcEJPpphEJleLHbqEinG3zm' 

  responseObject.oauth_signature = 
    generate_auth_signature(content_item_return_url, responseObject,consumer_secret)

  var formData = {
    responseObject: responseObject,
    content_item_return_url: content_item_return_url
  }
  res.render('content_selection_form.html', formData)
});

function generate_auth_signature (url, requestBody, secret) {
  let signatureBaseString = 'POST&' + encodeURIComponent(url) + '&';
  let first = true;

  for (const key of Object.keys(requestBody).sort()) {
      if( key === 'oauth_signature' ){
          continue;
      }
      if (!first){
          signatureBaseString += encodeURIComponent('&' + key + '=' + encodeURIComponent(requestBody[key]));
      } else {
          signatureBaseString += encodeURIComponent(key + '=' + encodeURIComponent(requestBody[key]));
          first = false;
      }
  }
  signatureBaseString = signatureBaseString
      .replace(/\!/g, '%2521')
      .replace(/\*/g, '%252A')
      .replace(/'/g, '%2527')
      .replace(/\(/g, '%2528')
      .replace(/\)/g, '%2529')
      .replace(/%5B/g, '%255B')
      .replace(/%40/g, '%2540')
      .replace(/%5D/g, '%255D');

  secret = encodeURIComponent(secret)
  
  const computedSignature = crypto.createHmac('sha1', secret + '&').update(signatureBaseString).digest('base64');
  
  return computedSignature;
}

function special_encode(string) {
  return encodeURIComponent(string).replace(/[!'()]/g, escape).replace(/\*/g, '%2A');
};

function getUnixTimestamp() {
  const unix = Math.round(+new Date()/1000);
  return unix;
}

function submit_content_item_form(req, res) {
  if (handlers.protocols['lti']) {
    handlers.protocols['lti'].submit_content_item_form(req, res, handlers);
  } else {
    res.status(404).send('LTI protocol not supported!');
  }
}

function serve_content(req,res,resource_name) {
	if (handlers.protocols[req.params.protocol] && handlers.contentTypes[req.params.contentType] && handlers.contentPackages[req.params.contentPackage]) {
    var params = {
      'type': 'serve_content', // one from [serve_content, show_front_page, content_selection]
      'name': resource_name, // name of the requested exercise
      'headContent': '', // required additions to HTML head section
      'bodyContent': '' // required additions to HTML body section
    };

    var sendResponse = function() {
      if (!params.error) {

        if (app.get('env') === 'development') {
          console.log('[ACOS Server] ' + 'INFO:'.green + ' Content requested => protocol: ' + req.params.protocol.yellow +
            ', content type: ' + req.params.contentType.yellow +
            ', content package: ' + req.params.contentPackage.yellow +
            ', name: ' + resource_name);
        }

        if(params.name && params.type === 'serve_content') {
          res.render('content.html', params);
        } else if(params.type == 'content_selection') {
          res.render('content_selection.html', params)
        }

      } else {

        if (app.get('env') === 'development') {
          console.log('[ACOS Server] ' + 'ERROR:'.red + ' Initialization failed => protocol: ' + req.params.protocol.yellow +
            ', content type: ' + req.params.contentType.yellow +
            ', content package: ' + req.params.contentPackage.yellow +
            ', name: ' + resource_name);
        }
        res.status(404).send('Initialization failed!');
      }

    };

    var initialize = function() {
      // Initialize the protocol (which initializes the content type and content package)
      handlers.protocols[req.params.protocol].initialize(req, params, handlers, sendResponse);
    };

    if (req.query.noLogging) {
      // Inject information that no logging is allowed
      var loggingScript = '<script> var AcosLogging = {noLogging: true};</script>';
      params.headContent += loggingScript;
      initialize();
    } else if (req.query.logkey && /^[0-9a-z]+$/.test(req.query.logkey)) {
      // Inject the logging key to the response
      crypto.randomBytes(256, function(err, bytes) {
        var loggingScript = '<script> var AcosLogging = {};';
        loggingScript += 'AcosLogging.logkey = "' + req.query.logkey + '";';
        loggingScript += 'AcosLogging.loggingSession = "' + crypto.createHash('sha1').update(bytes).digest('hex') + '";';
        loggingScript += '</script>';
        params.headContent += loggingScript;
        initialize();
      });
    } else {
      initialize();
    }

  } else {
	  res.status(404).send('Unsupported request!');
  }

}

function handle_event(req, res) {
	if (handlers.protocols[req.params.protocol] && handlers.contentTypes[req.params.contentType] && handlers.contentPackages[req.params.contentPackage]) {

    var event = req.body.event;
    var payload = JSON.parse(req.body.payload);
    var protocolData = JSON.parse(req.body.protocolData);

    // Sync additional handlers
    for (var logger in handlers.loggers) {
      handlers.loggers[logger].handleEvent(event, payload, req, res, protocolData);
    }

    // Async handlers in protocol, content type and content package

    var createChain = function(chain) {

      var wrap = function(call, callback) {
        return function() {
          var args = [];
          for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
          }
          args.push(callback);
          call.apply(this, args);
        };
      };

      var chained = function(event, payload, req, res, protocolData, responseObj) {
        // Chain ready
      };
      for (var i = 0; i < chain.length; i++) {
        chained = wrap(chain[i], chained);
      }

      return chained;

    };

    var chain = [];

    // Protocol is responsible for sending the response
    chain.push(handlers.protocols[req.params.protocol].handleEvent);

    // Check which event handlers are defined
    if (handlers.contentTypes[req.params.contentType].handleEvent) {
      chain.push(handlers.contentTypes[req.params.contentType].handleEvent);
    }
    if (handlers.contentPackages[req.params.contentPackage].handleEvent) {
      chain.push(handlers.contentPackages[req.params.contentPackage].handleEvent);
    }

    // Start the chain
    var responseObj = { protocol: {}, content: {} };
    createChain(chain)(event, payload, req, res, protocolData, responseObj);

  } else {
    res.status(404).send('Unsupported request!');
  }
}


// ********************************************************************************
// Front page
pitt_router.get('/', render_front_page);

function render_front_page(req, res) {
    var params = { 'protocols': [], 'contentTypes': [], 'contentPackages': [], 'tools': [] };
  
    for (var protocol in handlers.protocols) {
      params.protocols.push(protocol);
    }
  
    for (var contentType in handlers.contentTypes) {
      params.contentTypes.push(contentType);
    }
  
    for (var contentPackage in handlers.contentPackages) {
      params.contentPackages.push(handlers.contentPackages[contentPackage]);
    }
  
    for (var tool in handlers.tools) {
      params.tools.push(tool);
    }
  
    res.render('index.html', params);
}


// ********************************************************************************
// Getting logs
pitt_router.get('/logs/:logKey([a-z0-9]+)', function(req, res) {

  fs.stat(config.publicLogDirectory + '/' + req.params.logKey, function(err, stat) {

    if (!err && stat.isDirectory()) {
      var archive = archiver('zip');

      archive.on('error', function(err) {
        res.status(500).send({ error: err.message });
      });

      res.attachment('logs-' + req.params.logKey + '.zip');
      archive.pipe(res);
      archive.directory(config.publicLogDirectory + '/' + req.params.logKey, '/');
      archive.finalize();
    } else {
      res.sendStatus(404);
    }
  });

});





// ********************************************************************************
// API

// These fields will be in the response, if the field is available
var fields = ['name', 'title', 'description', 'author', 'license', 'version', 'created', 'modified', 'keywords', 'concepts'];

var contentTypesAsJSON = function(filters, expand) {
  var contentTypes = [];
  var allContentTypes = handlers.contentTypes;

  Object.keys(allContentTypes).forEach(function(key) {

    if (filters.keyword && allContentTypes[key].meta.keywords.indexOf(filters.keyword) < 0) {
      return;
    }

    if (filters.author && (allContentTypes[key].meta.author || '') !== filters.author) {
      return;
    }

    var currentContentType = {};

    fields.forEach(function(field) {
      if (allContentTypes[key].meta[field]) {
        currentContentType[field] = allContentTypes[key].meta[field];
      }
    });

    currentContentType.url = config.serverAddress + 'api/v1/content/' + allContentTypes[key].meta.name;

    if (expand) {
      currentContentType.subitems = contentPackagesAsJSON(key, filters, true);
    }

    contentTypes.push(currentContentType);

  });

  return contentTypes;

};

var contentPackagesAsJSON = function(contentType, filters, expand) {
  if (handlers.contentTypes[contentType]) {
    var contentPackages = [];
    var packages = handlers.contentTypes[contentType].installedContentPackages;

    packages.forEach(function(package) {

      if (filters.keyword && package.meta.keywords.indexOf(filters.keyword) < 0) {
        return;
      }

      if (filters.author && package.meta.author !== filters.author) {
        return;
      }

      var currentPackage = {};

      fields.forEach(function(field) {
        if (package.meta[field]) {
          currentPackage[field] = package.meta[field];
        }
      });

      currentPackage.url = config.serverAddress + 'api/v1/content/' + contentType + '/' + package.meta.name;

      if (expand) {
        currentPackage.subitems = contentPackageAsJSON(contentType, package.meta.name, filters, true, false);
      }

      contentPackages.push(currentPackage);
    });
    return contentPackages;
  } else {
    return null;
  }
};

var contentPackageAsJSON = function(contentType, contentPackage, filters, expand, expandProtocolUrls) {
  if (handlers.contentPackages[contentPackage]) {

    var allContent = handlers.contentPackages[contentPackage].meta.contents || [];
    var content = [];

    Object.keys(allContent).forEach(function(key) {

      if (filters.keyword && (allContent[key].keywords || []).indexOf(filters.keyword) < 0) {
        return;
      }

      if (filters.author && (allContent[key].author || handlers.contentPackages[contentPackage].meta.author) !== filters.author) {
        return;
      }

      var currentContent = {};

      fields.forEach(function(field) {
        if (allContent[key][field]) {
          currentContent[field] = allContent[key][field];
        }
      });

      currentContent.name = key;
      currentContent.url = config.serverAddress + 'api/v1/content/' + contentType + '/' + contentPackage + '/' + currentContent.name;
      currentContent.html_url = config.serverAddress + 'html/' + contentType + '/' + contentPackage + '/' + currentContent.name;

      if (expandProtocolUrls) {
        currentContent.protocol_urls = {};
        for (var protocol in handlers.protocols) {
          currentContent.protocol_urls[protocol] = config.serverAddress + '/' +  protocol + '/' + contentType + '/' + contentPackage + '/' + currentContent.name;
        }
      }

      content.push(currentContent);
    });

    return content;

  } else {
    return null;
  }
};

var contentAsJSON = function(contentType, contentPackage, content, filters, expand, expandProtocolUrls) {
  if (handlers.contentPackages[contentPackage] && handlers.contentPackages[contentPackage].meta.contents[content]) {

    var exercise = handlers.contentPackages[contentPackage].meta.contents[content];

    var exerciseInfo = {};
    exerciseInfo.name = content;
    exerciseInfo.url = config.serverAddress + 'api/v1/content/' + contentType + '/' + contentPackage + '/' + content;
    exerciseInfo.html_url = config.serverAddress + 'html/' + contentType + '/' + contentPackage + '/' + content;

    fields.forEach(function(field) {
      if (exercise[field]) {
        exerciseInfo[field] = exercise[field];
      }
    });

    if (expandProtocolUrls) {
      exerciseInfo.protocol_urls = {};
      for (var protocol in handlers.protocols) {
        exerciseInfo.protocol_urls[protocol] = config.serverAddress + protocol + '/' + contentType + '/' + contentPackage + '/' + content;
      }
    }

    return exerciseInfo;

  } else {
    return null;
  }
};

var createFilters = function(req) {
  var filters = {};
  var allowed = ['keyword', 'author'];
  allowed.forEach(function(item) {
    if (req.query[item]) {
      filters[item] = req.query[item];
    }
  });
  return filters;
};

// **********************************************
// API

api.get('/', function(req, res) {

  var endpoints = {
    content: { url: config.serverAddress + 'api/v1/content', description: 'Lists all available content types' },
  };

  res.json(endpoints);

});

// All content types
api.get('/content', function(req, res) {
  var expand = req.query.expand && (req.query.expand.split(',').indexOf('subitems') > -1 || req.query.expand.split(',').indexOf('children') > -1);
  var filters = createFilters(req);
  var response = { contentTypes: contentTypesAsJSON(filters, expand) };
  res.json(response);
});

// All content packages in the given content type
api.get('/content/:contentType([a-zA-Z0-9_-]+)', function(req, res) {
  var expand = req.query.expand && (req.query.expand.split(',').indexOf('subitems') > -1 || req.query.expand.split(',').indexOf('children') > -1);
  var filters = createFilters(req);
  var response = contentPackagesAsJSON(req.params.contentType, filters, expand);
  if (response) {
    res.json({ contentPackages: response });
  } else {
    res.status(404).json({ 'error': 'Unknown content type.' });
  }
});

// All exercises in the given content package
api.get('/content/:contentType([a-zA-Z0-9_-]+)/:contentPackage([a-zA-Z0-9_-]+)', function(req, res) {
  var expand = req.query.expand && req.query.expand.split(',').indexOf('subitems') > -1;
  var expandProtocolUrls = req.query.expand && req.query.expand.split(',').indexOf('protocol_urls') > -1;
  var filters = createFilters(req);
  var response = contentPackageAsJSON(req.params.contentType, req.params.contentPackage, filters, expand, expandProtocolUrls);
  if (response) {
    res.json({ content: response });
  } else {
    res.status(404).json({ 'error': 'Unknown content package.' });
  }
});

// Information about the given exercise
api.get('/content/:contentType([a-zA-Z0-9_-]+)/:contentPackage([a-zA-Z0-9_-]+)/:name([a-zA-Z0-9_-]+)', function(req, res) {
  var expand = req.query.expand && (req.query.expand.split(',').indexOf('subitems') > -1 || req.query.expand.split(',').indexOf('children') > -1);
  var expandProtocolUrls = req.query.expand && req.query.expand.split(',').indexOf('protocol_urls') > -1;
  var filters = createFilters(req);
  var response = ContentAsJSON(req.params.contentType, req.params.contentPackage, name, filters, expand, expandProtocolUrls);
  if (response) {
    res.json({ item: response });
  } else {
    res.status(404).json({ 'error': 'Unknown content item.' });
  }
});


// ********************************************************************************
// Loggers

handlers.loggers.logstore = {};

handlers.loggers.logstore.handleEvent = function(event, payload, req, res, protocolData) {
  if (event === 'log' && req.body.logkey && /[0-9a-z]+/.test(req.body.logkey) && req.body.loggingSession && /[0-9a-z]+/.test(req.body.loggingSession)) {
    var secretHash = crypto.createHash('sha1').update(req.body.logkey + (config.logKey || 'acos'));
    var dir = config.publicLogDirectory + '/' + secretHash.digest('hex');

    fs.mkdir(dir, 0775, function(err) {
      var data = {
        timestamp: Date.now(),
        contentType: req.params.contentType,
        contentPackage: req.params.contentPackage,
        name: req.params.name,
        payload: payload,
        protocolData: protocolData
      };
      fs.writeFile(dir + '/' + req.body.loggingSession, JSON.stringify(data) + '\r\n', { flag: 'a' }, function(err) {});
    });
  }
};

// Dummy logger for debugging purposes
if (app.get('env') === 'development') {

  handlers.loggers.dummy = {};
  handlers.loggers.dummy.handleEvent = function(event, payload, req, res, protocolData) {
    console.log('[ACOS Server] ' + 'INFO:'.green + ' Event received => event: %s, payload: %j , protocol data: %j',
      event.yellow, payload, protocolData);
  };

}

// ********************************************************************************

console.log('\n[ACOS Server] ' + 'INFO: Server is running.'.green);

// ********************************************************************************
// ACOS code ends






// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error.html', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stack traces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error.html', {
    message: err.message,
    error: {}
  });
});


//All requests to root
app.get('*', function(req, res) {
	res.redirect('/' + req.originalUrl);  
});


module.exports = app;
