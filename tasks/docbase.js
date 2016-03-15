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
      //mapFile: 'docbase.json',
      configJsFile: 'docbase-config.js',
      baseUrl: '',
      checkLoadedSelector: "[role='flatdoc-menu']",
      urlToAccess: "http://localhost:9001/",
      assets: ['bower_components', 'styles', 'scripts', 'images'],
      linksSelector: '[ng-href]:not(.dropdown-toggle)',
      linksVersions: '.version-switcher a',
      rootDocument: 'html',
      generateSearchIndex: true,
      onlysearchIndex: false,
      generateHtml: true,
      startDocument: '<html>',
      endDocument: '</html>',
      searchIndexSelector: "h1, h2, h3, p, ul"
    });
    grunt.log.writeln("starting ");
    var util = require("./lib/util.js");
    var fs = require("fs");
    var termsToBaseURLReplace = ['src="', 'href="', "src=", "href="];
    var urlToFielName = util.urlToFielName;
    var getPageLinks = util.getPageLinks;
    var inQuotes = util.inQuotes;
    var mapFile = null;
    var configData = null;
    if (options.mapFile) {
      mapFile = grunt.file.readJSON(options.mapFile);
    } else {
      eval(fs.readFileSync(options.configJsFile) + " configData = docbaseConfig;");
    }
    if (configData.versions) {
      mapFile = configData.versions;
    }
    var versionsLink = util.versionLinks(mapFile);
    var phantom = require('phantom');
    var pages = [];
    var links = [];
    var crawled = {};
    var searchIndex = [];
    var indexdLinks = [];
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
      if (options.generateHtml) {
        options.assets.forEach(function(srcpath) {
          grunt.log.writeln("Moving:", srcpath);
          moveAssets(srcpath);
        });
      }
    }
    var checkQueueProcess = function(page, ph) {
      page.close();
      pages.shift();
      if (pages.length === 0) {
        if (!options.onlysearchIndex) {
          prepareAssets();
        }
        setTimeout(function() {
          ph.exit();
          done();
        }, 0);
      }
    };
    var replaceBaseUrl = function(documentContent, fileName) {
      var nPaths = (fileName.match(/\//g) || []).length;
      var baseUrl = "";
      for (var i = nPaths - 2; i >= 0; i--) {
        baseUrl += "../";
      }
      var result = documentContent;
      termsToBaseURLReplace.forEach(function(term) {
        result = result.replace(new RegExp(term + '/', 'g'), term + baseUrl);
      });
      return result;
    };
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
    var generateSearchIndex = function(page, url, ph, buildIndex) {
      page.evaluate(function(selector, url) {
        var HEADER = ['H2', 'H1', 'H3'];
        var elements = Array.prototype.slice.call(document.querySelectorAll(selector));
        var h2s = elements.filter(function(element) {
          return HEADER.indexOf(element.tagName) !== -1;
        });
        return h2s.map(function(element, index) {
          var h2Index = elements.indexOf(element);
          var nextH2 = h2s[index + 1];
          var nextH2Index = !!nextH2 ? elements.indexOf(nextH2) : elements.length;
          var elementsBetween = elements.slice(h2Index, nextH2Index);
          var path = url.substr(url.indexOf('#'));
          var spaLink = url.substr(url.indexOf('#'));
          var link = element.id ? path + "/#" + element.id : path;

          return {
            link: link,
            spaLink: spaLink,
            title: element.innerText,
            content: elementsBetween.reduce(function(text, current) {
              return text += current.outerHTML;
            }, "")
          }
        });
      }, function(elements) {
        var missingLinks = elements.filter(function(element) {
          var has = !!indexdLinks[element.link];
          if (!has) {
            indexdLinks[element.link] = true;
          }
          return !has;
        });
        searchIndex = searchIndex.concat(missingLinks.map(function(link) {
          link.link = options.generateHtml ? urlToFielName(link.link) : link.link;
          return link;
        }));
        if (buildIndex) {
          grunt.log.writeln("Creating index for : " + url);
          grunt.file.write("search-index.json", JSON.stringify(searchIndex), 'w');
          checkQueueProcess(page, ph);
        }
      }, options.searchIndexSelector, url);
    };
    var generatePage = function(page, url, ph) {
      page.evaluate(function(rootDocument) {
        return document.querySelector(rootDocument).innerHTML;
      }, function(documentContent) {
        var fileName = urlToFielName(url);
        documentContent = replaceBaseUrl(replacePageLinks(documentContent), fileName);
        if (options.generateHtml)
          grunt.file.write(options.generatePath + fileName, options.startDocument + documentContent + options.endDocument, 'w');
        var path = options.generateHtml ? options.generatePath : '';
        grunt.file.write(path + "search-index.json", JSON.stringify(searchIndex), 'w');
        grunt.log.writeln("Generating:", options.generatePath + urlToFielName(url));
        checkQueueProcess(page, ph);
      }, options.rootDocument);

    };
    var crawlPage = function(url, findLinks, settime) {
      pages.push(url);
      phantom.create(function(ph) {
        ph.createPage(function(page) {
          page.set('settings.userAgent', 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36');
          page.open(url, function() {
            grunt.log.writeln("Reading : " + url);
            util.waitFor({
              debug: true,
              interval: 100,
              timeout: 50000,
              checkLoadedSelector: options.checkLoadedSelector,
              check: function(check) {
                return !!document.querySelector(check);
              },
              success: function() {
                if (findLinks) {
                  getPageLinks(page, options.linksSelector, makeCrawler(false, false));
                  getPageLinks(page, options.linksVersions, makeCrawler(true, true));
                };
                if (!options.onlysearchIndex) {
                  generatePage(page, url, ph);
                  if (options.generateSearchIndex) {
                    generateSearchIndex(page, url);
                  }
                } else {
                  generateSearchIndex(page, url, ph, true);
                }
              },
              error: function(e) {
                  grunt.log.writeln("Erro generating page:", options.generatePath + urlToFielName(url));
                } // optional
            }, page);
          });
        });
      }, {
        parameters: {
          'ignore-ssl-errors': 'yes',
          'ssl-protocol': 'tlsv1',
          'web-security': false,
          //'debug' : 'true'
        }
      });
    };

    var getGitMap = function(url) {
      phantom.create(function(ph) {
        ph.createPage(function(page) {
          page.set('settings.userAgent', 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36');
          page.open(url, function() {
            readGitMap(page);
          });
        });
      }, {
        parameters: {
          'ignore-ssl-errors': 'yes',
          'ssl-protocol': 'tlsv1',
          'web-security': false,
          //'debug' : 'true'
        }
      });
    }

    function readGitMap(page) {
      setTimeout(function() {
        util.getGitMap(page, options.linksSelector, function(map_data) {
          if (map_data == "") {
            grunt.log.writeln('waiting for github response');
            readGitMap(page);
          } else {
            configData.versions = map_data;
            var docbaseConfigWrite = "var docbaseConfig = " + JSON.stringify(configData, null, 2) + ";";
            grunt.file.write(options.configJsFile, docbaseConfigWrite, 'w');
            mapFile = configData.versions;
            getPageLinks(page, options.linksSelector, makeCrawler(false, false));
          }
        });
      }, 500);
    }

    if (!options.onlysearchIndex) {
      clearFolder(options.generatePath);
    }

    if (configData.method == 'github') {
      getGitMap(options.urlToAccess + 'getGitMap.html');
    } else {
      crawlPage(options.urlToAccess, true);
    }
  });

};