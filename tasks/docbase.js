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
    var ProgressBar = require('progress');
    var done = this.async();
    var options = this.options({
      generatePath: 'html/',
      //mapFile: 'docbase.json',
      configJsFile: 'docbase-config.js',
      baseUrl: '',
      checkLoadedSelector: "[role='flatdoc-menu']",
      checkNavbar: ".map_folder",
      urlToAccess: "http://localhost:9001/",
      assets: ['bower_components', 'styles', 'scripts', 'images'],
      linksSelector: '[ng-href]',
      linksVersions: '.version-switcher a',
      rootDocument: 'html',
      generateSearchIndex: true,
      onlysearchIndex: false,
      generateHtml: true,
      startDocument: '<html>',
      endDocument: '</html>',
      searchIndexSelector: "h1, h2, h3, p, ul",
      operation: 'series'
    });
    grunt.log.writeln("starting ");
    var util = require("./lib/util.js");
    var fs = require("fs");
    var termsToBaseURLReplace = ['src="', 'href="', "src=", "href="];
    var baseReplace = ['base href="'];
    var urlToFielName = util.urlToFielName;
    var getPageLinks = util.getPageLinks;
    var inQuotes = util.inQuotes;
    var mapFile = null;
    var configData = null;
    var currentLinksIn = [];
    var currentId = 0;
    var makeCrawlercount = 0;
    var currentLinksTemp = [];
    var progressStart = false;
    var bar;
    var versionsLink = [];
    var pageInfo = {
      pageSize: 3,
      totalPage: 0,
      currentPage: 0,
      pageCounter: 0,
      totalCounter: 0
    };

    if (options.mapFile) {
      mapFile = grunt.file.readJSON(options.mapFile);
    } else {
      eval(fs.readFileSync(options.configJsFile) + " configData = docbaseConfig;");
    }
    if (configData.versions) {
      mapFile = configData.versions;
    }
    versionsLink = util.versionLinks(mapFile);
    var phantom = require('phantom');
    var pages = [];
    var links = [];
    var crawled = {};
    var searchIndex = [];
    var indexdLinks = [];
    var clearFolder = function(srcpath) {
      if (grunt.file.isDir(srcpath)) {
        var files = grunt.file.expand(srcpath + "/*");
        files.forEach(clearFolder);
      } else {
        grunt.file.delete(srcpath);
      }
    };
    var moveAssets = function(srcpath) {
      if (grunt.file.isDir(srcpath)) {
        var files = grunt.file.expand(srcpath + "/*");
        files.forEach(moveAssets);
        if(srcpath.indexOf(options.generatePath) === -1) {
          grunt.log.writeln("Moving:", srcpath);
        }
      } else {
        if(srcpath.indexOf(options.generatePath) === -1 && srcpath !== './index.html' && srcpath !== './search-index.json' && srcpath.indexOf('node_modules') === -1 ) {
          grunt.file.copy(srcpath, options.generatePath + srcpath)
        }
      }
    };var prepareAssets = function() {
      options.assets.forEach(function(srcpath) {
        moveAssets(srcpath);
      });
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
      baseReplace.forEach(function(term) {
        result = result.replace(new RegExp(term + './', 'g'), term + baseUrl);
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
      currentLinksIn.forEach(function(link) {
        var url = urlToFielName(link);
        documentContent = replaceLink(documentContent, link, url);
        documentContent = documentContent.replace(new RegExp(options.urlToAccess, 'g'), "");
      });
      return documentContent;
    };
    var makeCrawler = function(findLinks, once) {
      return function(currentLinks) {

        if (!findLinks) {
          currentLinksTemp = currentLinksTemp.concat(currentLinks);
          currentLinks.forEach(function(link) {
            links.push(link);
          });
          if (versionsLink.length == makeCrawlercount) {

            currentLinksTemp.forEach(function(v1, k1) {
              var flag = true;
              versionsLink.forEach(function(v2, k2) {
                if (v1 == v2.link) {
                  flag = false;
                }
              });
              if (flag && currentLinksIn.indexOf(v1) == -1) {
                currentLinksIn.push(v1);
              }
            });
            versionsLink.forEach(function(v2, k2) {
              currentLinksIn.push(v2.link);
            });
            crawlPage(options.urlToAccess, false, true, function(ph) {
              crawlChain(findLinks, once, ph);
            });
          }
        }
        if (findLinks) {
          makeCrawlercount++;
          currentLinks.forEach(function(link) {
            if (!once || !crawled[link]) {
              if (once) {
                crawled[link] = true;
              }
              links.push(link);
              crawlPage(options.urlToAccess + link, findLinks);
            }
          });
        }
      };
    };
    var makeGitCrawler = function(findLinks, once) {
      return function(currentLinks) {
        currentLinksIn = currentLinks;
        versionsLink.forEach(function(version) {
          currentLinksIn.push(version.link);
        });
        crawlPage(options.urlToAccess, false, true, function(ph) {
          crawlChain(findLinks, once, ph);
        });
      };
    };
    var chainEnd = function(ph) {
      prepareAssets();
      setTimeout(function() {
        ph.exit();
        if (configData.publish === 'local') {
          serveStaticBuild();
        } else {
          done();
        }
      }, 0);
    }
    var crawlChain = function(findLinks, once, ph) {
      if (!progressStart) {
        progressStart = true;
        bar = new ProgressBar('Progress ╢:bar╟ :percent :etas', {
          complete: '█',
          incomplete: '░',
          width: 50,
          total: currentLinksIn.length
        });

        pageInfo.totalPage = Math.floor(currentLinksIn.length / pageInfo.pageSize);
        pageInfo.totalCounter = currentLinksIn.length;
      }

      //Parallel Operaion
      if (options.operation == 'parallel') {
        if (pageInfo.currentPage <= pageInfo.totalPage) {
          var templLinks = currentLinksIn.slice(pageInfo.currentPage * pageInfo.pageSize, (pageInfo.currentPage + 1) * pageInfo.pageSize);
          templLinks.forEach(function(link, linkKey) {
            if (!once || !crawled[link]) {
              if (once) {
                crawled[link] = true;
              }
              links.push(link);

              var versionFlag = false;
              versionsLink.forEach(function(version) {
                if (version.link == link) {
                  versionFlag = true;
                }
              });
              if (!versionFlag) {
                versionFlag = link.indexOf('/index') == -1 ? false : true;
              }

              //if (linkKey == templLinks.length - 1) {
              crawlPage(options.urlToAccess + link, findLinks, versionFlag, function(ph, url, page) {
                pageInfo.pageCounter++;
                console.log(pageInfo.pageCounter, 'Done : ' + urlToFielName(url));
                if (pageInfo.pageCounter == (pageInfo.currentPage + 1) * pageInfo.pageSize) {
                  pageInfo.currentPage++;
                  crawlChain(findLinks, once, ph);
                }
                if (pageInfo.pageCounter == pageInfo.totalCounter) {
                  chainEnd(ph);
                }
                //page.close();
                setTimeout(function() {
                  ph.exit();
                }, 100);
              });

            }
          });
        }
      }

      //Series Operaion
      else if (options.operation == 'series') {
        var link = currentLinksIn[currentId];
        if (currentId < currentLinksIn.length) {
          if (!once || !crawled[link]) {
            if (once) {
              crawled[link] = true;
            }
            links.push(link);

            var versionFlag = false;
            versionsLink.forEach(function(version) {
              if (version.link == link) {
                versionFlag = true;
              }
            });
            if (!versionFlag) {
              versionFlag = link.indexOf('/index') == -1 ? false : true;
            }
            crawlPage(options.urlToAccess + link, findLinks, versionFlag, function(ph) {
              process.stdout.write("\u001b[2J\u001b[0;0H");
              bar.tick();
              setTimeout(function() {
                ph.exit();
              }, 100);
              crawlChain(findLinks, once, ph);
            });
          }
          currentId++;
        } else {
          chainEnd(ph);
        }
      }
    }
    var generateSearchIndex = function(page, url, ph, buildIndex, callback) {
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
          if (progressStart) {
            grunt.log.writeln("Creating index for: " + url);
          }
          grunt.file.write("search-index.json", JSON.stringify(searchIndex), 'w');
          setTimeout(function() {
            if (callback) {
              callback(ph, url);
            }
          });
        }
      }, options.searchIndexSelector, url);
    };
    var generatePage = function(page, url, ph, callback) {
      page.evaluate(function(rootDocument) {
        return document.querySelector(rootDocument).innerHTML;
      }, function(documentContent) {

        var fileName = urlToFielName(url);
        documentContent = replaceBaseUrl(replacePageLinks(documentContent), fileName);
        if (options.generateHtml)
          grunt.file.write(options.generatePath + fileName, options.startDocument + documentContent + options.endDocument, 'w');
        var path = options.generateHtml ? options.generatePath : '';
        grunt.file.write(path + "search-index.json", JSON.stringify(searchIndex), 'w');
        if (progressStart) {
          grunt.log.writeln("Generating:", options.generatePath + urlToFielName(url));
        }
        setTimeout(function() {
          if (callback) {
            callback(ph, url, page);
          }
        });
      }, options.rootDocument);

    };
    var crawlPage = function(url, findLinks, versionFlag, callback) {
      pages.push(url);
      phantom.create(function(ph) {
        ph.createPage(function(page) {
          page.set('settings.userAgent', 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36');
          page.open(url, function() {
            if (progressStart) {
              // process.stdout.write("\u001b[2J\u001b[0;0H");
              // bar.tick();
              console.log('\r\n');
              grunt.log.writeln("Reading: " + url);
            }
            util.waitFor({
              debug: false,
              interval: 100,
              timeout: 50000,
              checkLoadedSelector: options.checkLoadedSelector,
              checkNavbar: options.checkNavbar,
              check: function(check) {
                return !!document.querySelector(check);
              },
              success: function() {

                if (findLinks) {
                  getPageLinks(page, options.linksSelector, makeCrawler(false, false));
                  getPageLinks(page, options.linksVersions, makeCrawler(true, true));
                };
                if (!options.onlysearchIndex) {
                  if (options.generateSearchIndex) {
                    if (progressStart && !versionFlag)
                      generateSearchIndex(page, url);
                  }
                  generatePage(page, url, ph, callback);
                } else {
                  if (progressStart && !versionFlag) {
                    generateSearchIndex(page, url, ph, true, callback);
                  } else {
                    if (callback) {
                      callback(ph, url);
                    }
                  }
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
            versionsLink = util.versionLinks(mapFile);
            getPageLinks(page, options.linksSelector, makeGitCrawler(false, false));
          }
        });
      }, 500);
    }
    
  var manual_override = configData.hasOwnProperty('manual_override') ? configData.manual_override : false;
  if (configData.method == 'github' && !manual_override) {
      getGitMap(options.urlToAccess + 'getGitMap.html');
    } else {
      crawlPage(options.urlToAccess, true);
    }

    function serveStaticBuild() {
      var finalhandler = require('finalhandler');
      var http = require('http');
      var serveStatic = require('serve-static');      
      var serve = serveStatic(options.generatePath, {
        'index': ['index.html']
      });
      var server = http.createServer(function(req, res) {
        var done = finalhandler(req, res)
        serve(req, res, done)
      });
      server.listen(1234);
      grunt.log.writeln('Docbase is published in build_html/. Check it out live at:  http://127.0.0.1:1234');
    };

  });
};