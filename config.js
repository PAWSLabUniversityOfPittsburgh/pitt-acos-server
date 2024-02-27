var CONFIG = {
    // The address for the server
    serverAddress: 'http://localhost:4003',
	//ltiKeys: {consumerKey: process.env.CONSUMER_KEY, consumerSecret: process.env.CONSUMER_SECRET},
    ltiKeys: {consumerKey: 'kaa108@pitt.edu', consumerSecret: 'abcd'},
    //$2a$10$DU9AhVQc5KuSQbMPT7o5Q.FyIl0WfcMcEJPpphEJleLHbqEinG3zm
	
    // Location for log files. The path will be relative to this directory.
    // If the path starts with a slash, it will be considered as an absolute path.
    logDirectory: 'logs',
    publicLogDirectory: 'public_logs',

    // This secret key is used to create the secret logging keys based on
    // the public logging key.
    // IMPORTANT: Change this value! It can be any string.
    logKey: 'abcdabcdabcdabcd',

    // Path for the Python 3 executable.
    // This is used, for example, by acos-python-parser
    pythonPath: '/usr/bin/python3',


    // If this is enabled, all installed packages are automatically
    // searched when the server starts. In order to be auto-discovered,
    // the package name must start with 'acos-'.
    autoDiscovery: true,

    //Content Brokering
    brokering_api: {
        api_route_base: '/api/v1',
        export_content_route: '/export_content',
        content_types_route: '/content',
        content_packages_route: '/content/:contentType([a-zA-Z0-9_-]+)',
        content_route: '/content/:contentType([a-zA-Z0-9_-]+)/:contentPackage([a-zA-Z0-9_-]+)',
        content_detail_route: '/content/:contentType([a-zA-Z0-9_-]+)/:contentPackage([a-zA-Z0-9_-]+)/:name([a-zA-Z0-9_-]+)',
        //These fields will be in the response, if the field is available
        fields: ['name', 'title', 'description', 'author', 'license', 'version', 'created', 'modified', 'keywords', 'concepts']
    },

    // Insert all the installed package names here to use them
    // These are ignored if autoDiscovery is true!
    installedPackages: [
        // Installed protocols
        'acos-html',
		'acos-lti',
		'acos-pitt',
		// Installed content types
        'acos-annotated',
		'acos-jsparsons',
		'acos-jsvee',
        // Installed content packages
        'acos-annotated-demo',
		'acos-jsparsons-python',
		'acos-jsvee-java',
        // Tools
        'acos-logging-keygenerator',
        // Libraries
        
        // Other packages
        
    ]

};

module.exports = CONFIG;
