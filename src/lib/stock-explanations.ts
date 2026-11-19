import type {StockWaitBlocker} from './stock-forecast';
export const STOCK_WAIT_HELP:Record<StockWaitBlocker,string>={
 data:'We need more usable price history or a completed analysis for this forecast.',
 stale:'Prices or the forecast are out of date. Wait for the next update.',
 updating:'New prices have arrived. The forecast is being updated.',
 baseline:'In past tests, this model did not beat simply assuming the price would stay the same.',
 validation:'Past tests were not reliable enough to suggest a trade.',
 fees:'The expected move is too small to cover the selling fee and the model’s error allowance.',
 ownership:'No shares are recorded for this stock, so there is nothing to sell.',
 cost:'Add your average purchase price so we can check your profit before suggesting Sell.',
 profit:'Selling does not meet your rule of more than 0.1% profit after fees.',
 dip:'Waiting for a price drop below its recent average.',
 rebound:'Similar past price drops have not recovered often enough to suggest Buy.',
};
