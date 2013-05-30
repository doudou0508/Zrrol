var moment = require('moment');
var _ = require('underscore');

// helper functions
var util = {
  getConfig: function() {
    var path = require('path');
    var configFile = path.resolve(util.getArgument('config') || 'config.js');
    return require(configFile);
  },
  getArgument: function(argument) {
    var ret;
    _.each(process.argv, function(arg) {
      var pos = arg.indexOf(argument + '=');
      if(pos !== -1) {
        ret = arg.substr(argument.length + 1);
      }
    });
    return ret;
  },
  minToMs: function(min) {
    return min * 60 * 1000;
  },
  toMicro: function(moment) {
    return moment.format('X') * 1000 * 1000;
  },
  intervalsAgo: function(amount) {
    return moment().subtract('minutes', config.EMA.interval * amount);
  },
  average: function(list) {
    var total = _.reduce(list, function(m, n) { return m + n }, 0);
    return total / list.length;
  },
  // calculate the average trade price out of a sample of trades.
  // The sample consists of all trades that happened after the treshold.
  calculatePriceSince: function(treshold, trades) {
    var sample = [];
    _.every(trades, function(trade) {
      if(moment.unix(trade.date) < treshold)
        return false;

      var price = parseFloat(trade.price);
      sample.push(price);
      return true;
    });

    return util.average(sample);
  },
  // calculate the average trade price out of a sample of trades.
  // The sample consists of all trades that happened before the treshold.
  calculatePriceTill: function(treshold, trades) {
    var sample = [];
    _.every(trades, function(trade) {
      if(moment.unix(trade.date) > treshold)
        return false;

      var price = parseFloat(trade.price);
      sample.push(price);
      return true;
    });

    return util.average(sample);
  }
}

var config = util.getConfig();

module.exports = util;