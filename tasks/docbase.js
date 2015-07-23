/*
 * grunt-docbase
 * https://github.com/mateus/DocbaseGrunt
 *
 * Copyright (c) 2015 Mateus Freira
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('docbase', 'Grunt plugin to generate html files from your docbase project.', function() {
    var done = this.async();
    var options = this.options({
      generatePath: 'html/',
      urlToAccess: 'http://localhost:8080/',
      linksSelector: '[ng-href]:not(.dropdown-toggle)',
      rootDocument: 'html',
      startDocument: '<html>',
      endDocument: '</html>'
    });
    var util = require("./lib/util.js");
    var urlToFielName = util.urlToFielName;
    var phantom = require('phantom');
    var pages = [];
    var links = [];
    var fs = require('fs');
    var crawlPage = function(url, fildPages) {
      pages.push(url);
      phantom.create(function(ph) {
        ph.createPage(function(page) {
          page.open(url, function() {
            if (fildPages) {
              page.evaluate(function(linksSelector) {
                var data = $(linksSelector);
                return data.toArray().map(function(a) {
                  return $(a).attr('href');
                });
              }, function(currentLinks) {
                links = links.concat(currentLinks);
                currentLinks.forEach(function(link) {
                  crawlPage(url + link, false);
                });
              }, options.linksSelector);
            };
            page.evaluate(function(rootDocument) {
              return $(rootDocument).html();
            }, function(documentContent) {
              links.forEach(function(link) {
                documentContent = documentContent.replace(new RegExp(link, 'g'), urlToFielName(link));
              });
              grunt.file.write(options.generatePath + urlToFielName(url), options.startDocument + documentContent + options.endDocument, 'w');
              grunt.log.writeln("Generating:", options.generatePath + urlToFielName(url));
              page.close();
              pages.shift();
              if (pages.length === 0) {
                setTimeout(function() {
                  ph.exit();
                  done();
                }, 0);
              }
            }, options.rootDocument);
          });
        });
      });
    };
    crawlPage(options.urlToAccess, true);
  });

};