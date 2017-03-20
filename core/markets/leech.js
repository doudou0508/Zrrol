// a leech market is "semi-realtime" and pulls out candles of a
// database (which is expected to be updated reguraly, like with a
// realtime market running in parralel).

const _ = require('lodash');
const moment = require('moment');

const util = require('../util');
const dirs = util.dirs();
const config = util.getConfig();

const cp = require(dirs.core + 'cp');

const adapter = config[config.adapter];
const Reader = require(dirs.gekko + adapter.path + '/reader');

const TICKINTERVAL = 20 * 1000; // 20 seconds

const exchanges = require(dirs.gekko + 'exchanges');
const exchange = _.find(exchanges, function(e) {
  return e.slug === config.watch.exchange.toLowerCase();
});

if(!exchange)
  util.die(`Unsupported exchange: ${config.watch.exchange.toLowerCase()}`)

const exchangeChecker = require(util.dirs().core + 'exchangeChecker');

const error = exchangeChecker.cantMonitor(config.watch);
if(error)
  util.die(error, true);

if(config.market.from)
  var fromTs = moment.utc(config.market.from).unix();
else
  var fromTs = moment().startOf('minute').unix();


var Market = function() {

  _.bindAll(this);

  Readable.call(this, {objectMode: true});

  this.reader = new Reader();
  this.latestTs = fromTs;

  setInterval(
    this.get,
    TICKINTERVAL
  );
}

var Readable = require('stream').Readable;
Market.prototype = Object.create(Readable.prototype, {
  constructor: { value: Market }
});

Market.prototype._read = _.once(function() {
  this.get();
});

Market.prototype.get = function() {
  var future = moment().add(1, 'minute').unix();

  this.reader.get(
    this.latestTs,
    future,
    'full',
    this.processCandles
  )
}

Market.prototype.processCandles = function(err, candles) {
  var amount = _.size(candles);
  if(amount === 0) {
    // no new candles!
    return;
  }


  // TODO:
  // verify that the correct amount of candles was passed:
  //
  // if `this.latestTs` was at 10:00 and we receive 3 candles with the latest at 11:00
  // we know we are missing 57 candles...

  _.each(candles, function(c, i) {
    c.start = moment.unix(c.start).utc();
    this.push(c);
  }, this);

  console.log('processCandles', amount);

  this.sendStartAt(_.first(candles));
  cp.lastCandle(_.last(candles));

  this.latestTs = _.last(candles).start.unix() + 1;
}

Market.prototype.sendStartAt = _.once(function(candle) {
  console.log('sendStartAt');
  cp.firstCandle(candle);
});

module.exports = Market;
