var _ = require('lodash');
var util = require('../core/util.js');
var config = util.getConfig();
var log = require('../core/log.js');

var indicatorsPath = '../methods/indicators/';

var Indicators = {
  MACD: require(indicatorsPath + 'MACD'),
  DEMA: require(indicatorsPath + 'DEMA'),
  PPO: require(indicatorsPath + 'PPO')
};

var allowedIndicators = _.keys(Indicators);

var Base = function() {
  _.bindAll(this);
  // properties
  this.age = 0;

  // defaults
  this.requiredHistory = 0;
  this.priceValue = 'c';
  this.indicators = {};

  // make sure we have all methods
  _.each(['init', 'check'], function(fn) {
    if(!this[fn])
      util.die('No ' + fn + ' function in this trading method found.')
  }, this);

  if(!this.update)
    this.update = function() {};

  // let's run the implemented starting point
  this.init();

  // create the indicator instances we need
  var realIndicators = {};
  _.each(this.indicators, function(indicator, name) {
    if(!_.contains(allowedIndicators, indicator.type))
      util.die('I do not know the indicator ' + indicator.type);

    realIndicators[name] = new Indicators[indicator.type](indicator.parameters);
  });
  this.indicators = realIndicators;

  // should be set up now, check some things
  // to make sure everything is implemented
  // correctly.
  if(!this.name)
    log.warn('Warning, trading method has no name');

  if(!config.debug || !this.log)
    this.log = function() {};
}

// teach our base trading method events
var Util = require('util');
var EventEmitter = require('events').EventEmitter;
Util.inherits(Base, EventEmitter);

Base.prototype.tick = function(candle) {
  this.age++;

  // update all indicators
  var price = candle[this.priceValue];
  _.each(this.indicators, function(i) {
    i.update(price);
  });

  this.update(candle);

  if(this.requiredHistory < this.age) {
    this.log();
    this.check();
  }

  // update previous price
  this.lastPrice = price;
}

Base.prototype.advice = function(newPosition) {
  if(!newPosition)
    return this.emit('soft advice');

  this.emit('advice', {
    recommandation: newPosition,
    portfolio: 1
  });
}

module.exports = Base;