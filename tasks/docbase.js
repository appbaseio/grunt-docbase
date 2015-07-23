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
      linksVersions: '[ng-bind="version"]',
      rootDocument: 'html',
      startDocument: '<html>',
      endDocument: '</html>'
    });
    var util = require("./lib/util.js");
    var urlToFielName = util.urlToFielName;
    var getPageLinks = util.getPageLinks;
    var phantom = require('phantom');
    var pages = [];
    var links = [];
    var crawled = {};
    var fs = require('fs');
    var checkQueueProcess = function(page, ph) {
      page.close();
      pages.shift();
      if (pages.length === 0) {
        setTimeout(function() {
          ph.exit();
          done();
        }, 0);
      }
    };
    var replasePageLinks = function(documentContent) {
      links.forEach(function(link) {
        documentContent = documentContent.replace(new RegExp(link, 'g'), urlToFielName(link));
      });
      return documentContent;
    };
    var makeCrawler = function(findLinks, once) {
      return function(currentLinks) {
        currentLinks.forEach(function(link) {
          if (!once || !crawled[link]) {
            if(once){
              crawled[link] = true;
            }
            links.push(link);
            crawlPage(options.urlToAccess + link, findLinks);
          }
        });
      };
    };
    var crawlPage = function(url, findLinks) {
      pages.push(url);
      phantom.create(function(ph) {
        ph.createPage(function(page) {
          page.open(url, function() {
            if (findLinks) {
              getPageLinks(page, options.linksSelector, makeCrawler(false, false));
              getPageLinks(page, options.linksVersions, makeCrawler(true, true));
            };
            page.evaluate(function(rootDocument) {
              return $(rootDocument).html();
            }, function(documentContent) {
              documentContent = replasePageLinks(documentContent);
              grunt.file.write(options.generatePath + urlToFielName(url), options.startDocument + documentContent + options.endDocument, 'w');
              grunt.log.writeln("Generating:", options.generatePath + urlToFielName(url));
              checkQueueProcess(page, ph);
            }, options.rootDocument);
          });
        });
      });
    };
    crawlPage(options.urlToAccess, true);
  });

};