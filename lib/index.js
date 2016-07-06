'use strict';

var Potrace = require('./Potrace');

// backwards compatibility
module.exports = new Potrace();
module.exports.process = function(callback) { callback(); };

module.exports.Potrace = Potrace; // exporting constructor