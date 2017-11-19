const binance = require('node-binance-api');
const moment = require('moment');
const util = require('../core/util');
const _ = require('lodash');
const log = require('../core/log');

var Trader = function(config) {
  _.bindAll(this);

  if(_.isObject(config)) {
    this.key = config.key;
    this.secret = config.secret;
    this.currency = config.currency.toUpperCase()
    this.asset = config.asset.toUpperCase();
  }

  this.pair = this.asset + this.currency;
  this.name = 'binance';

  binance.options({
    'APIKEY': this.key,
    'APISECRET': this.secret,
    'recvWindow': 60000
  });
}

var recoverableErrors = new RegExp(/(SOCKETTIMEDOUT|TIMEDOUT|CONNRESET|CONNREFUSED|NOTFOUND|API:Invalid nonce|between Cloudflare and the origin web server)/)

Trader.prototype.retry = function(method, args, error) {
  if (!error || !error.message.match(recoverableErrors)) {
    log.error('[kraken.js] ', this.name, 'returned an irrecoverable error');
    return;
  }

  // 5 -> 10s to avoid more rejection
  var wait = +moment.duration(10, 'seconds');
  log.debug('[kraken.js] (retry) ', this.name, 'returned an error, retrying..');

  var self = this;

  // make sure the callback (and any other fn)
  // is bound to Trader
  _.each(args, function(arg, i) {
    if(_.isFunction(arg))
      args[i] = _.bind(arg, self);
  });

  // run the failed method again with the same
  // arguments after wait
  setTimeout(
    function() { method.apply(self, args) },
    wait
  );
};

Trader.prototype.getTrades = function(since, callback, descending) {
  var args = _.toArray(arguments);
  var startTs = since ? moment(since).valueOf() : null;

  var process = function(err, trades) {
    if (err || !trades || trades.length === 0) {
      log.error('error getting trades', err);
      return this.retry(this.getTrades, args, err);
    }

    var parsedTrades = [];
    _.each(trades.result[this.pair], function(trade) {
      // Even when you supply 'since' you can still get more trades than you asked for, it needs to be filtered
      if (_.isNull(startTs) || startTs < moment.unix(trade[2]).valueOf()) {
        parsedTrades.push({
          tid: moment.unix(trade[2]).valueOf() * 1000000,
          date: parseInt(Math.round(trade[2]), 10),
          price: parseFloat(trade[0]),
          amount: parseFloat(trade[1])
        });
      }
    }, this);

    if(descending)
      callback(null, parsedTrades.reverse());
    else
      callback(null, parsedTrades);
  };

  var reqData = {
    pair: this.pair
  };

  if(since) {
    // Kraken wants a tid, which is found to be timestamp_ms * 1000000 in practice. No clear documentation on this though
    reqData.since = startTs * 1000000;
  }

  this.kraken.api('Trades', reqData, _.bind(process, this));
};

Trader.prototype.getPortfolio = function(callback) {
  var args = _.toArray(arguments);
  var setBalance = function(err, data) {
    log.debug('[kraken.js] entering "setBalance" callback after kraken-api call, err:', err, ' data:' , data);

    if(_.isEmpty(data))
      err = new Error('no data (getPortfolio)');

    else if(!_.isEmpty(data.error))
      err = new Error(data.error);

    if (err || !data.result) {
      log.error('[kraken.js] ' , err);
      return this.retry(this.getPortfolio, args, err);
    }

    // When using the prefix-less assets, you remove the prefix from the assset but leave
    // it on the curreny in this case. An undocumented Kraken quirk.
    var assetId = _.contains(assets_without_prefix, this.asset) ? this.asset : addPrefix(this.asset);
    var assetAmount = parseFloat( data.result[assetId] );
    var currencyAmount = parseFloat( data.result[addPrefix(this.currency)] );

    if(!_.isNumber(assetAmount) || _.isNaN(assetAmount)) {
      log.error(`Kraken did not return portfolio for ${this.asset}, assuming 0.`);
      assetAmount = 0;
    }

    if(!_.isNumber(currencyAmount) || _.isNaN(currencyAmount)) {
      log.error(`Kraken did not return portfolio for ${this.currency}, assuming 0.`);
      currencyAmount = 0;
    }

    var portfolio = [
      { name: this.asset, amount: assetAmount },
      { name: this.currency, amount: currencyAmount }
    ];

    return callback(err.message, portfolio);
  };

  this.kraken.api('Balance', {}, _.bind(setBalance, this));
};

// This assumes that only limit orders are being placed with standard assets pairs
// It does not take into account volume discounts.
// Base maker fee is 0.16%, taker fee is 0.26%.
Trader.prototype.getFee = function(callback) {
  var makerFee = 0.16;
  callback(false, makerFee / 100);
};

Trader.prototype.getTicker = function(callback) {
  var setTicker = function(err, data) {

    if(!err && _.isEmpty(data))
      err = new Error('no data (getTicker)');

    else if(!err && !_.isEmpty(data.error))
      err = new Error(data.error);

    if (err)
      return log.error('unable to get ticker', JSON.stringify(err));

    var result = data.result[this.pair];
    var ticker = {
      ask: result.a[0],
      bid: result.b[0]
    };
    callback(err.message, ticker);
  };

  this.kraken.api('Ticker', {pair: this.pair}, _.bind(setTicker, this));
};

Trader.prototype.roundAmount = function(amount) {
  // Prevent "You incorrectly entered one of fields."
  // because of more than 8 decimals.
  // Specific precision by pair https://blog.kraken.com/post/1278/announcement-reducing-price-precision-round-2

  var precision = 100000000;
  var parent = this;
  var market = Trader.getCapabilities().markets.find(function(market){ return market.pair[0] === parent.currency && market.pair[1] === parent.asset });

  if(Number.isInteger(market.precision))
    precision = Math.pow(10, market.precision);

  amount *= precision;
  amount = Math.floor(amount);
  amount /= precision;
  return amount;
};

Trader.prototype.addOrder = function(tradeType, amount, price, callback) {
  var args = _.toArray(arguments);

  amount = this.roundAmount(amount);
  price = this.roundAmount(price); // but the link talks about rounding price... And I had the bug

  log.debug('[kraken.js] (addOrder)', tradeType.toUpperCase(), amount, this.asset, '@', price, this.currency);

  var setOrder = function(err, data) {

    // console.log('blap', err, data);

    if(!err && _.isEmpty(data))
      err = new Error('no data (addOrder)');
    else if(!err && !_.isEmpty(data.error))
      err = new Error(data.error);

    if(err) {
      log.error('unable to ' + tradeType.toLowerCase(), err);
      return this.retry(this.addOrder, args, err);
    }

    var txid = data.result.txid[0];
    log.debug('added order with txid:', txid);

    callback(undefined, txid);
  };

  this.kraken.api('AddOrder', {
    pair: this.pair,
    type: tradeType.toLowerCase(),
    ordertype: 'limit',
    price: price,
    volume: amount.toString()
  }, _.bind(setOrder, this));
};


Trader.prototype.getOrder = function(order, callback) {

  var get = function(err, data) {
    if(!err && _.isEmpty(data) && _.isEmpty(data.result))
      err = new Error('no data (getOrder)');

    else if(!err && !_.isEmpty(data.error))
      err = new Error(data.error);

    if(err)
      return log.error('Unable to get order', order, JSON.stringify(err));

    var price = parseFloat( data.result[ order ].price );
    var amount = parseFloat( data.result[ order ].vol_exec );
    var date = moment.unix( data.result[ order ].closetm );

    callback(undefined, {price, amount, date});
  }.bind(this);

  this.kraken.api('QueryOrders', {txid: order}, get);
}

Trader.prototype.buy = function(amount, price, callback) {
  this.addOrder('buy', amount, price, callback);
};

Trader.prototype.sell = function(amount, price, callback) {
  this.addOrder('sell', amount, price, callback);
};

Trader.prototype.checkOrder = function(order, callback) {
  var check = function(err, data) {
    if(_.isEmpty(data))
      err = new Error('no data (checkOrder)');

    if(!_.isEmpty(data.error))
      err = new Error(data.error);

    if(err)
      return log.error('Unable to check order', order, JSON.stringify(err));

    var result = data.result[order];
    var stillThere = result.status === 'open' || result.status === 'pending';
    callback(err.message, !stillThere);
  };

  this.kraken.api('QueryOrders', {txid: order}, _.bind(check, this));
};

Trader.prototype.cancelOrder = function(order, callback) {
  var args = _.toArray(arguments);
  var cancel = function(err, data) {
    if(!err && _.isEmpty(data))
      err = new Error('no data (cancelOrder)');
    else if(!err && !_.isEmpty(data.error))
      err = new Error(data.error);

    if(err) {
      log.error('unable to cancel order', order, '(', err, JSON.stringify(err), ')');
      return this.retry(this.cancelOrder, args, err);
    }

    callback();
  };

  this.kraken.api('CancelOrder', {txid: order}, _.bind(cancel, this));
};

Trader.getCapabilities = function () {
  return {
    name: 'Binance',
    slug: 'binance',
    currencies: ['USD', 'BTC', 'ETH', 'BNB'],
    assets: ['XBT', 'LTC', 'GNO', 'ICN', 'MLN', 'REP', 'XDG', 'XLM', 'XMR', 'XRP', 'ZEC', 'ETH', 'BCH', 'DASH', 'EOS', 'ETC'],
    markets: [
      //Tradeable againt ETH
      { pair: ['XBT', 'ETH'], minimalOrder: { amount: 0.01, unit: 'asset' }, precision: 5 },
      { pair: ['CAD', 'ETH'], minimalOrder: { amount: 0.01, unit: 'asset' }, precision: 2 },
      { pair: ['EUR', 'ETH'], minimalOrder: { amount: 0.01, unit: 'asset' }, precision: 2 },
      { pair: ['GBP', 'ETH'], minimalOrder: { amount: 0.01, unit: 'asset' } },
      { pair: ['JPY', 'ETH'], minimalOrder: { amount: 1, unit: 'asset' }, precision: 0 },
      { pair: ['USD', 'ETH'], minimalOrder: { amount: 0.01, unit: 'asset' }, precision: 2 },
    ],
    requires: ['key', 'secret'],
    providesHistory: 'date',
    providesFullHistory: true,
    tid: 'tid',
    tradable: true
  };
}

module.exports = Trader;
