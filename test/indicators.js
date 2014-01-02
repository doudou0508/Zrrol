var EMA = require('../methods/indicators/exponantial-moving-average.js');
var _ = require('lodash');

var prices = [ 
  81, 24, 75, 21,
  34, 25, 72, 92,
  99, 2, 86, 80,
  76, 8, 87, 75,
  32, 65, 41, 9,
  13, 26, 56, 28,
  65, 58, 17, 90,
  87, 86, 99, 3,
  70, 1, 27, 9,
  92, 68, 9 
];

var emaResults = [ 
  81,
  70.63636363636363,
  71.4297520661157,
  62.26070623591284,
  57.12239601120141,
  51.28196037280115,
  55.04887666865549,
  61.767262728899944,
  68.53685132364541,
  56.43924199207351,
  61.81392526624197,
  65.12048430874341,
  67.09857807079005,
  56.35338205791913,
  61.92549441102474,
  64.30267724538388,
  58.42946320076862,
  59.624106255174325,
  56.2379051178699,
  47.649195096439,
  41.349341442541004,
  38.55855208935173,
  41.72972443674232,
  39.233410902789174,
  43.91824528410023,
  46.47856432335473,
  41.118825355472055,
  50.00631165447713,
  56.73243680820856,
  62.053811933988825,
  68.77130067326358,
  56.81288236903384,
  59.21054012011859,
  48.626805552824294,
  44.69465908867441,
  38.204721072551784,
  47.985680877542364,
  51.62464799071648,
  43.874711992404386,
];

module.exports = {
  ema: function(test) {
    var ema = new EMA(10);
    _.each(prices, function(p, i) {
      ema.update(p);
      test.equals(ema.result, emaResults[i]);
    });
    test.done();
  }
};