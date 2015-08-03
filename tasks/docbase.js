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
      mapFile: 'map.json',
      baseUrl: '',
      checkLoadedSelector: "[role='flatdoc-menu']",
      urlToAccess: "http://localhost:9001/",
      assets: ['bower_components', 'styles', 'scripts', 'images'],
      linksSelector: '[ng-href]:not(.dropdown-toggle)',
      linksVersions: '.version-switcher a',
      rootDocument: 'html',
      startDocument: '<html>',
      endDocument: '</html>'
    });
    var util = require("./lib/util.js");
    var termsToBaseURLReplace = ['src="', 'href="', "src=", "href="];
    var urlToFielName = util.urlToFielName;
    var getPageLinks = util.getPageLinks;
    var inQuotes = util.inQuotes;
    var mapFile = grunt.file.readJSON(options.mapFile);
    var versionsLink = util.versionLinks(mapFile);
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
    var clearFolder = function(srcpath) {
      if (grunt.file.isDir(srcpath)) {
        var files = grunt.file.expand(srcpath + "/*");
        files.forEach(clearFolder);
      } else {
        grunt.file.delete(srcpath);
      }
    };
    var prepareAssets = function() {
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
    var replaceBaseUrl = function(documentContent) {
      var result = documentContent;
      termsToBaseURLReplace.forEach(function(term) {
        result = result.replace(new RegExp(term + '/', 'g'), term + options.baseUrl);
      });
      return result;
    }
    var replaceLink = function(documentContent, from, to) {
      documentContent = documentContent.replace(new RegExp(inQuotes(from), 'g'), to);
      documentContent = documentContent.replace(new RegExp(from + "\#", 'g'), to + "#");
      return documentContent;
    };
    var replacePageLinks = function(documentContent) {
      versionsLink.forEach(function(version) {
        documentContent = replaceLink(documentContent, version.link, urlToFielName(version.realLink));
        documentContent = replaceLink(documentContent, urlToFielName(version.link), urlToFielName(version.realLink));
      });
      links.forEach(function(link) {
        var url = urlToFielName(link);
        documentContent = replaceLink(documentContent, link, url);
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
            util.waitFor({
              debug: false,
              interval: 100,
              timeout: 1000,
              checkLoadedSelector: options.checkLoadedSelector,
              check: function(check) {
                return !!document.querySelector(check);
              },
              success: function() {
                if (findLinks) {
                  getPageLinks(page, options.linksSelector, makeCrawler(false, false));
                  getPageLinks(page, options.linksVersions, makeCrawler(true, true));
                };
                page.evaluate(function(rootDocument) {
                  return document.querySelector(rootDocument).innerHTML;
                }, function(documentContent) {
                  documentContent = replaceBaseUrl(replacePageLinks(documentContent));
                  grunt.file.write(options.generatePath + urlToFielName(url), options.startDocument + documentContent + options.endDocument, 'w');
                  grunt.log.writeln("Generating:", options.generatePath + urlToFielName(url));
                  checkQueueProcess(page, ph);
                }, options.rootDocument);
              },
              error: function() {
                  grunt.log.writeln("Erro generating page:", options.generatePath + urlToFielName(url));
                } // optional
            }, page);
          });
        });
      });
    };
    clearFolder(options.generatePath);
    crawlPage(options.urlToAccess, true);
  });

};