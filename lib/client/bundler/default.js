// Default bundler implementation
'use strict';

function includeFlags(overrides) {
  var includes = {
    css: true,
    html: true,
    system: true,
    initCode: true
  };
  if (overrides) {
    for(var n in overrides) { includes[n] = overrides[n]; }
  }
  return includes;
}

/**
 * @typedef { name:string, path:string, dir:string, content:string, options:string, type:string } AssetEntry
 */

/**
 * @ngdoc service
 * @name bundler.default:default
 * @function
 *
 * @description
 *  The default bundler of HTML, CSS & JS
 *
 * @type {{define: define, load: load, toMinifiedCSS: toMinifiedCSS, toMinifiedJS: toMinifiedJS, asset: {
 *  entries: entries, loader: assetLoader, systemModule: systemModule, js: assetJS, worker: assetWorker, start: assetStart,
 *  css: assetCSS, html: assetHTML}}}
 */
module.exports = function(ss,client,options){

  var bundler = ss.bundler.create({
    define: define,
    module: systemModule,
    asset: asset
  });
  return bundler;


  function define(paths) {

    if (typeof paths.view !== 'string') {
      throw new Error('You may only define one HTML view per single-page client. Please pass a filename as a string, not an Array');
    }
    if (paths.view.lastIndexOf('.') <= 0) {
      throw new Error('The \'' + paths.view + '\' view must have a valid HTML extension (such as .html or .jade)');
    }

    // Define new client object
    client.paths = ss.bundler.sourcePaths(paths);
    client.includes = includeFlags(paths.includes);
    client.constants = paths.constants || paths.consts;
    client.locals = paths.locals;
    client.entryInitPath = ss.bundler.findEntryPoint(client);

    return ss.bundler.destsFor(client);
  }

  /**
   * @ngdoc method
   * @name bundler.default:default#system
   * @methodOf bundler.default:default
   * @function
   * @description
   * Return entries for the loader/start/module depending on includes.system client config and system assets.
   * Multiple arguments will attempt to add module for the name.
   * Special module names are 'loader' and 'start'.
   *
   * @returns {AssetEntry} Resource entries array
   */
  function systemModule(/* first_name */) {
    var entries = [];

    /*jshint -W084 */
    for(var i= 0,name; name = arguments[i]; ++i) {
      switch(name) {
        case 'loader':
          entries.push(ss.bundler.browserifyLoader());
          break;
        case 'libs':
          entries.push(ss.bundler.systemLibs());
          break;
        case 'start':
          entries = entries.concat(ss.bundler.constants(client));
          if (client.includes.initCode) {
            entries = entries.concat(ss.bundler.startCode(client));
          }
          break;

        //case "eventemitter2":
        //case "socketstream":
        default:
          entries.push(ss.bundler.systemModule(name));
          break;
      }
    }

    return entries;
  }

  //TODO callback(err,output) for pack to flag error
  function asset(entry, opts, cb) {
    ss.bundler.loadFile(entry, opts, null,
      function(output) {
        switch(entry.bundle) {
          case 'html':
            return cb(ss.bundler.injectTailIfNeeded(output,opts));
          case 'css':
            return cb( client.includes.css? output:'');
          case 'worker':
            //TODO
            if (opts.compress && entry.file.indexOf('.min') === -1) {
              output = ss.bundler.minifyJSFile(output, entry.file);
            }
            break;

          default:
            //TODO with options compress saved to avoid double compression
            output = bundler.wrapCode(output, entry, opts);
            if (opts.compress && entry.file.indexOf('.min') === -1) {
              output = ss.bundler.minifyJSFile(output, entry.file);
            }
            return cb(output);
        }
      },
      function(err) {
        ss.log.clientIssue(client,options,err,entry);
        switch(entry.ext) {
          case 'html':
            return cb('Couldn\'t format ' + entry.file + err.userInfoHTML);
          case 'css':
            return cb('/* couldn\'t format ' + entry.file + err.userInfoText+' */');
          default:
            return cb('// couldn\'t format ' + entry.file + err.userInfoText);
        }
      });
  }
};

