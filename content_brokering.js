/**
 * This file contains API endpoints and helper functions for content brokering service. 
 * It provides information about all content types and content items 
 * available on the server in JSON format for easy parsing and integration by external applications.
 */
var express = require('express')
var brokering_api = express.Router();
var acos_handlers = {}

var config = require('./config');
var api_config = config.brokering_api
var content_types_endpoint = api_config.api_route_base + api_config.content_types_route
var api_endpoint_base = config.serverAddress + content_types_endpoint + '/'

brokering_api.get('/', function(req, res) {
    var endpoints = {
        content: { 
            url: api_endpoint_base, 
            description: 'Lists all available content types' 
        },
    };

    res.json(endpoints);
});

brokering_api.get(api_config.export_content_route, function(req, res) {
    var response = export_all_content();
    console.log(response)
    res.json(response);
})
 
// All content types
brokering_api.get(api_config.content_types_route, function(req, res) {
    var expand = req.query.expand && (req.query.expand.split(',').indexOf('subitems') > -1 || req.query.expand.split(',').indexOf('children') > -1);
    var filters = create_filters(req);
    var response = {contentTypes: get_content_types(filters, expand)};
    res.json(response);
});

// All content packages in the given content type
brokering_api.get(api_config.content_packages_route, function(req, res) {
    var expand = req.query.expand && (req.query.expand.split(',').indexOf('subitems') > -1 || req.query.expand.split(',').indexOf('children') > -1);
    var filters = create_filters(req);
    var response = get_content_packages(req.params.contentType, filters, expand);
    if (response) {
      res.json({ contentPackages: response });
    } else {
      res.status(404).json({ 'error': 'Unknown content type.' });
    }
  });


  // All exercises in the given content package
brokering_api.get(api_config.content_route, function(req, res) {
    var expand = req.query.expand && (req.query.expand.split(',').indexOf('subitems') > -1 || req.query.expand.split(',').indexOf('children') > -1);
    var expandProtocolUrls = req.query.expand && req.query.expand.split(',').indexOf('protocol_urls') > -1;
    var filters = create_filters(req);
    var response = get_contents(req.params.contentType, req.params.contentPackage, filters, expand, expandProtocolUrls);
    if (response) {
        res.json({ content: response });
    } else {
        res.status(404).json({ 'error': 'Unknown content package.' });
}
});

// Information about the given exercise
brokering_api.get(api_config.content_detail_route, function(req, res) {
    var expand = req.query.expand && (req.query.expand.split(',').indexOf('subitems') > -1 || req.query.expand.split(',').indexOf('children') > -1);
    var expandProtocolUrls = req.query.expand && req.query.expand.split(',').indexOf('protocol_urls') > -1;
    var filters = create_filters(req);
    var response = get_content_details(req.params.contentType, req.params.contentPackage, req.params.name, filters, expand, expandProtocolUrls);
    if (response) {
      res.json({ item: response });
    } else {
      res.status(404).json({ 'error': 'Unknown content item.' });
    }
  });


// ********************************************************************************
// Helper Functions
var fields = api_config.fields

var export_all_content = function() {
    if(!acos_handlers || !acos_handlers.contentPackages) {
        return []
    }

    var result = []

    Object.keys(acos_handlers.contentPackages).forEach(function(key){
        var package = acos_handlers.contentPackages[key]
        var lti_installed = Object.keys(acos_handlers.protocols).includes('lti')
        var all_content = package.meta.contents
        Object.keys(all_content).forEach(function(content){
            var concepts = all_content[content]['concepts'] || []
            var keywords = all_content[content]['keywords'] || []
            var author = all_content[content]['author'] || package.meta.author
            
            var catalog_object = {
                platform_name: 'ACOS server',
                url: config.serverAddress,
                lti_instructions_url: lti_installed ? config.serverAddress + '/lti_instructions':'LTI protocol not installed',
                exercise_type: package.meta.name,
                license:package.meta.license,
                description: all_content[content]['description'],
                author: author,
                institution: '',
                keywords: [].concat(keywords).concat(concepts),
                exercise_name: content,
                iframe_url: config.serverAddress + '/html/' + package.contentTypeNamespace + '/' + key + '/' + content,
                lti_url: lti_installed ? config.serverAddress + '/lti/' + package.contentTypeNamespace + '/' + key + '?resource_name=' + content :'LTI protocol not installed'
            }

            result.push(catalog_object)
        })
    })
    
    return result
}

var get_content_types = function(filters, expand) {
  var contentTypes = [];
  var allContentTypes = acos_handlers.contentTypes;

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

    currentContentType.url = api_endpoint_base + allContentTypes[key].meta.name;

    if (expand) {
      currentContentType.subitems = get_content_packages(key, filters, true);
    }

    contentTypes.push(currentContentType);

  });

  return contentTypes;

};

var get_content_packages = function(contentType, filters, expand) {
  if (acos_handlers.contentTypes[contentType]) {
    var contentPackages = [];
    var packages = acos_handlers.contentTypes[contentType].installedContentPackages;

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

      currentPackage.url = api_endpoint_base + contentType + '/' + package.meta.name;

      if (expand) {
        currentPackage.subitems = get_contents(contentType, package.meta.name, filters, true, false);
      }

      contentPackages.push(currentPackage);
    });
    return contentPackages;
  } else {
    return null;
  }
};

var get_contents = function(contentType, contentPackage, filters, expand, expandProtocolUrls) {
  if (acos_handlers.contentPackages[contentPackage]) {

    var allContent = acos_handlers.contentPackages[contentPackage].meta.contents || [];
    var content = [];

    Object.keys(allContent).forEach(function(key) {

      if (filters.keyword && (allContent[key].keywords || []).indexOf(filters.keyword) < 0) {
        return;
      }

      if (filters.author && (allContent[key].author || acos_handlers.contentPackages[contentPackage].meta.author) !== filters.author) {
        return;
      }

      var currentContent = {};

      fields.forEach(function(field) {
        if (allContent[key][field]) {
          currentContent[field] = allContent[key][field];
        }
      });

      currentContent.name = key;
      currentContent.url = api_endpoint_base + contentType + '/' + contentPackage + '/' + currentContent.name;

      if (expandProtocolUrls) {
        currentContent.protocol_urls = {};
        for (var protocol in acos_handlers.protocols) {
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

var get_content_details = function(contentType, contentPackage, content, filters, expand, expandProtocolUrls) {
  if (acos_handlers.contentPackages[contentPackage] && acos_handlers.contentPackages[contentPackage].meta.contents[content]) {

    var exercise = acos_handlers.contentPackages[contentPackage].meta.contents[content];

    var exerciseInfo = {};
    exerciseInfo.name = content;
    exerciseInfo.url = api_endpoint_base + contentType + '/' + contentPackage + '/' + content;

    fields.forEach(function(field) {
      if (exercise[field]) {
        exerciseInfo[field] = exercise[field];
      }
    });

    if (expandProtocolUrls) {
      exerciseInfo.protocol_urls = {};
      for (var protocol in acos_handlers.protocols) {
        exerciseInfo.protocol_urls[protocol] = config.serverAddress + '/' + protocol + '/' + contentType + '/' + contentPackage + '/' + content;
      }
    }

    return exerciseInfo;

  } else {
    return null;
  }
};

var create_filters = function(req) {
  var filters = {};
  var allowed = ['keyword', 'author'];
  allowed.forEach(function(item) {
    if (req.query[item]) {
      filters[item] = req.query[item];
    }
  });
  return filters;
};

module.exports = brokering_api;
module.exports.init = function(handlers) {
    acos_handlers = handlers
}