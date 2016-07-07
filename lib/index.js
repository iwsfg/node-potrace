'use strict';

var Potrace = require('./Potrace');

module.exports = new Potrace(); // exporting instance for backwards compatibility
module.exports.Potrace = Potrace; // exporting constructor