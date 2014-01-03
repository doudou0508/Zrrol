/*

  Gekko is a Bitcoin trading bot for popular Bitcoin exchanges written 
  in node, it features multiple trading methods using technical analysis.

  Disclaimer:

  USE AT YOUR OWN RISK!

  The author of this project is NOT responsible for any damage or loss caused 
  by this software. There can be bugs and the bot may not perform as expected 
  or specified. Please consider testing it first with paper trading / 
  backtesting on historical data. Also look at the code to see what how 
  it's working.

*/

var coreDir = './core/';
var actorsDir = './actors/';

var moment = require('moment');
var _ = require('lodash');
var async = require('async');

var util = require(coreDir + 'util');
var log = require(coreDir + 'log');

var config = util.getConfig();

log.info('I\'m gonna make you rich, Bud Fox.', '\n\n');

var gekkoMode = 'realtime';

// currently we only support a single 
// market and a single advisor.

// make sure the monitoring exchange is configured correctly for monitoring

var exchangeChecker = require(coreDir + 'exchangeChecker');
var invalid = exchangeChecker.cantMonitor(config.watch);
if(invalid)
  throw invalid;

var actors = [];
var emitters = {};

var setupMarket = function(next) {
  var Market = require(coreDir + 'candleManager');
  emitters.market = new Market;
  next();
}

// load each actor
var loadActors = function(next) {
  var actorSettings = require('./actors');

  var iterator = function(actor, next) {
    if(!(actor.slug in config)) {
      log.warn('unable to find', actor.slug, 'in the config. Is your config up to date?')
      return next();
    }

    var actorConfig = config[actor.slug];

    // only load actors that are supported by
    // Gekko's current mode
    if(!_.contains(actor.modes, gekkoMode))
      return next();

    // if the actor is disabled skip as well
    if(!actorConfig.enabled)
      return next();

    var Actor = require(actorsDir + actor.slug);

    if(!actor.silent) {
      console.log();
      log.info('Setting up:');
      log.info('\t', actor.name);
      log.info('\t', actor.description);
    }

    if(actor.async) {
      var instance = new Actor(util.defer(next));

      instance.meta = actor;
      actors.push(instance);

    } else {
      var instance = new Actor;

      instance.meta = actor;
      actors.push(instance);

      _.defer(next);
    }

    if(!actor.silent)
      console.log();
  }

  async.eachSeries(
    actorSettings,
    iterator,
    next
  );
};

// advisor is a special actor in that it spawns an
// advice feed which everyone can subscribe to.
var setupAdvisor = function(next) {

  var settings;

  var actor = _.find(actors, function(advisor) {
    if(!advisor.meta.originates)
      return false;

    settings = _.find(
      advisor.meta.originates,
      function(o) {
        return o.feed === 'advice feed'
      }
    );
    return settings;
  });

  emitters.advisor = actor[settings.object];

  next();
}

var attachActors = function(next) {

  var subscriptions = [
    {
      emitter: 'market',
      event: 'candle',
      handler: 'processCandle'
    },
    {
      emitter: 'market',
      event: 'small candle',
      handler: 'processSmallCandle'
    },
    {
      emitter: 'market',
      event: 'trade',
      handler: 'processTrade'
    },
    {
      emitter: 'market',
      event: 'history',
      handler: 'init'
    },
    {
      emitter: 'advisor',
      event: 'advice',
      handler: 'processAdvice'
    }
  ];

  _.each(actors, function(actor) {
    _.each(subscriptions, function(sub) {

      // if this actor implements a handler
      // for this subscription add it as a listener.

      if(sub.handler in actor)
        emitters[sub.emitter]
          .on(sub.event, actor[sub.handler]);

    });
  });

  next();
}

log.info('Setting up Gekko in', gekkoMode, 'mode');

async.series(
  [
    loadActors,
    setupAdvisor,
    setupMarket,
    attachActors
  ],
  function() {
    // everything is setup!
    emitters.market.start();
  }
);