'use strict';

var grunt = require('grunt');

exports.docbase = {
  setUp: function(done) {
    // setup here if necessary
    done();
  },
  default_options: function(test) {
    //test.expect(1);
    test.done();
  },
};
