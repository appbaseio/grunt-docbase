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
      baseUrl: '',
      urlToAccess: 'http://localhost:8080/',
      assets: ['bower_components', 'styles', 'scripts'],
      linksSelector: '[ng-href]:not(.dropdown-toggle)',
      linksVersions: '[ng-bind="version"]',
      rootDocument: 'html',
      startDocument: '<html>',
      endDocument: '</html>'
    });
    var util = require("./lib/util.js");
    var urlToFielName = util.urlToFielName;
    var getPageLinks = util.getPageLinks;
    var inQuotes = util.inQuotes;
    var phantom = require('phantom');
    var pages = [];
    var links = [];
    var crawled = {};
    var fs = require('fs');
    var moveAssets = function(srcpath) {
      if (grunt.file.isDir(srcpath)) {
        var files = grunt.file.expand(srcpath + "/*");
        files.forEach(moveAssets);
      } else {
        grunt.file.copy(srcpath, options.generatePath + srcpath)
      }
    };
    var clearFolder = function(srcpath){
      if (grunt.file.isDir(srcpath)) {
        var files = grunt.file.expand(srcpath + "/*");
        files.forEach(clearFolder);
      } else {
        grunt.file.delete(srcpath);
      }      
    };
    var prepareAssets = function(){
        options.assets.forEach(function(srcpath) {
          grunt.log.writeln("Moving:", srcpath);
          moveAssets(srcpath);
        });          
    }
    var checkQueueProcess = function(page, ph) {
      page.close();
      pages.shift();
      if (pages.length === 0) {
        prepareAssets();
        setTimeout(function() {
          ph.exit();
          done();
        }, 0);
      }
    };
    var replacePageLinks = function(documentContent) {
      links.forEach(function(link) {
        var url = options.baseUrl+urlToFielName(link);
        documentContent = documentContent.replace(new RegExp(inQuotes(link), 'g'), url);
        documentContent = documentContent.replace(new RegExp(link+"\#", 'g'), url+"#");
        console.log(inQuotes(link));
        documentContent = documentContent.replace(new RegExp(options.urlToAccess, 'g'), "");
      });
      return documentContent;
    };
    var makeCrawler = function(findLinks, once) {
      return function(currentLinks) {
        currentLinks.forEach(function(link) {
          if (!once || !crawled[link]) {
            if (once) {
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
              documentContent = replacePageLinks(documentContent);
              grunt.file.write(options.generatePath + urlToFielName(url, options.baseUrl), options.startDocument + documentContent + options.endDocument, 'w');
              grunt.log.writeln("Generating:", options.generatePath + urlToFielName(url, options.baseUrl));
              checkQueueProcess(page, ph);
            }, options.rootDocument);
          });
        });
      });
    };
    clearFolder(options.generatePath);
    crawlPage(options.urlToAccess, true);
  });

};