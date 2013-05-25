var config = {};

// Gekko currently only supports Exponential Moving Averages
config.tradingMethod =  'Exponential Moving Averages';

// On trades at which exchange should Gekko base its analysis on?
config.watch =  {
  exchange: 'MtGox', // either 'BTCe', 'MtGox' or 'Bitstamp'

  // if you filled in BTCe uncomment and fill in the following
  // currency: 'USD' // either USD, EUR or RUR
} 

// Exponential Moving Averages settings:
config.EMA = {
  // timeframe per candle
  interval: 60, // in minutes
  // EMA weight (α)
  // the higher the weight, the more smooth (and delayed) the line 
  shortEMA: 10,
  longEMA: 21,
  // amount of samples to remember and base initial EMAs on
  ticks: 100,
  // max difference between first and last trade to base price calculation on
  sampleSize: 10, // in seconds
  // the difference between the EMAs (to act as triggers)
  sellTreshold: -0.25,
  buyTreshold: 0.25
};

//    DANGER ZONE
//    
// enable real trading BTC for real USD
//
// fill in you public and private key from mtgox or btc-e, if you enable 
// btc-e also set a currency.
//
// == if you set `enabled` to true Gekko will trade automatically! ==
config.traders = [
  {
    exchange: 'MtGox',
    key: '',
    secret: '',
    enabled: false
  },
  {
    exchange: 'BTCe',
    key: '',
    secret: '',
    currency: 'USD', // either USD, EUR or RUR
    enabled: false
  },
  {
    exchange: 'Bitstamp',
    user: '',
    password: '',
    enabled: false
  }
];

// do you want Gekko to calculate the profit of its own advice?
// This is done via a simulation and has nothing to do with auto trading
config.profitCalculator = {
  enabled: true,
  // in what currency do you want Gekko to report?
  // Either BTC or the currency the watcher is monitoring
  reportInBTC: false,
  // start balance, on what the current balance is compared with
  simulationBalance: {
    btc: 1,
    foreign: 100, // foreign is the currency of the price reported by watcher
  }
}

// want Gekko to send a mail on buy or sell advice?
config.mail = {
  enabled: false,
  email: '', // only works for Gmail or Google apps accounts at the moment

  // You don't have to set your password here, if you leave it blank we will ask it 
  // when Gekko's starts.
  //
  // NOTE: Gekko is an open source project < https://github.com/askmike/gekko >,
  // make sure you looked at the code or trust the maintainer of this bot when you
  // fill in your email and password.
  //
  // WARNING: If you have NOT downloaded Gekko from the github page above we CANNOT 
  // garantuee that your email address & password are safe!
  password: ''
}

config.debug = false; // for additional logging / debugging

module.exports = config;